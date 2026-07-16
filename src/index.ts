import {
  Disposable,
  ExtensionContext,
  Position,
  TreeDataProvider,
  TreeItemAction,
  TreeView,
  TreeViewOptions,
  commands,
  window,
  workspace,
} from "coc.nvim";

/**
 * Mirrors VS Code's workbench surfaces. A container occupies one surface and
 * switches between the views registered to it.
 */
export type ViewLocation = "primarySidebar" | "secondarySidebar" | "panel";

/**
 * Coc equivalent of VS Code's ViewContainerLocation. The string values are
 * intentionally stable because they are also suitable for configuration.
 */
export const ViewContainerLocation = {
  Sidebar: "primarySidebar",
  AuxiliaryBar: "secondarySidebar",
  Panel: "panel",
} as const;

export interface ViewContainerRegistration {
  id: string;
  title: string;
  location?: ViewLocation;
  order?: number;
}

export interface ViewRegistration<T> extends TreeViewOptions<T> {
  id: string;
  containerId: string;
  title?: string;
  description?: string;
  order?: number;
  actions?: ViewAction<T>[];
}

export interface ViewAction<T> {
  id: string;
  title: string;
  keys?: string[];
  when?: (element: T) => boolean;
  handler: (element: T) => void | Promise<void>;
}

export interface ShowViewOptions {
  focus?: boolean;
}

export interface CocUiApi {
  registerViewContainer(registration: ViewContainerRegistration): Disposable;
  createTreeView<T>(registration: ViewRegistration<T>): TreeView<T>;
  showContainer(id: string, options?: ShowViewOptions): Promise<void>;
  switchLocation(location: ViewLocation): Promise<void>;
  showView(id: string, options?: ShowViewOptions): Promise<void>;
  closeContainer(id: string): Promise<void>;
  toggleTreeItem(id: string): Promise<void>;
  openLocation(uri: string, line: number, character: number): Promise<void>;
}

type RegisteredView = {
  containerId: string;
  order: number;
  tree: TreeView<unknown>;
  disposables: Disposable[];
};

type RegisteredContainer = {
  title: string;
  location: ViewLocation;
  order: number;
  viewIds: string[];
  activeViewId: string | undefined;
};

interface KeymappableTreeView<T> extends TreeView<T> {
  registerLocalKeymap(
    mode: "n",
    key: string,
    handler: (element: T | undefined) => void | Promise<void>,
    notify?: boolean,
  ): void;
}

class CocUi implements CocUiApi, Disposable {
  private readonly containers = new Map<string, RegisteredContainer>();
  private readonly views = new Map<string, RegisteredView>();
  private editorWindowId: number | undefined;

  registerViewContainer(registration: ViewContainerRegistration): Disposable {
    if (this.containers.has(registration.id)) {
      throw new Error(`View container already registered: ${registration.id}`);
    }

    this.containers.set(registration.id, {
      title: registration.title,
      location: registration.location ?? "primarySidebar",
      order: registration.order ?? 0,
      viewIds: [],
      activeViewId: undefined,
    });

    return Disposable.create(() => {
      void this.closeContainer(registration.id);
      this.containers.delete(registration.id);
    });
  }

  createTreeView<T>(registration: ViewRegistration<T>): TreeView<T> {
    if (this.views.has(registration.id)) {
      throw new Error(`View already registered: ${registration.id}`);
    }

    const container = this.containers.get(registration.containerId);
    if (!container) {
      throw new Error(`Unknown view container: ${registration.containerId}`);
    }

    const {
      id,
      containerId,
      title,
      description,
      order,
      actions = [],
      ...options
    } = registration;
    const treeDataProvider = withViewActions(options.treeDataProvider, actions);
    const tree = window.createTreeView(id, {
      ...options,
      treeDataProvider,
      bufhidden: options.bufhidden ?? "hide",
    });
    const keymappableTree = tree as KeymappableTreeView<T>;
    if (typeof keymappableTree.registerLocalKeymap !== "function") {
      throw new Error(
        "Installed coc.nvim does not support TreeView keybindings",
      );
    }
    for (const action of actions) {
      for (const key of action.keys ?? []) {
        keymappableTree.registerLocalKeymap(
          "n",
          key,
          (element) => {
            if (element && (!action.when || action.when(element))) {
              return action.handler(element);
            }
          },
          true,
        );
      }
    }
    tree.title = title ?? id;
    tree.description = description;

    const registered: RegisteredView = {
      containerId,
      order: order ?? 0,
      tree: tree as TreeView<unknown>,
      disposables: [],
    };
    registered.disposables.push(
      tree.onDidChangeVisibility(({ visible }) => {
        if (!visible && container.activeViewId === id) {
          container.activeViewId = undefined;
        }
      }),
    );

    this.views.set(id, registered);
    container.viewIds.push(id);
    this.sortViews(container);

    return tree;
  }

  async showContainer(id: string, options?: ShowViewOptions): Promise<void> {
    const container = this.requireContainer(id);
    const viewId = container.activeViewId ?? container.viewIds[0];
    if (!viewId) {
      throw new Error(`View container has no views: ${id}`);
    }
    await this.showView(viewId, options);
  }

  async switchLocation(location: ViewLocation): Promise<void> {
    const containers = [...this.containers.entries()]
      .filter(([, container]) => container.location === location)
      .sort(([, left], [, right]) => left.order - right.order);
    if (!containers.length) return;

    const index = await window.showQuickpick(
      containers.map(([id, container]) => `${container.title} (${id})`),
      "Select view container",
    );
    if (index >= 0) await this.showContainer(containers[index][0]);
  }

  async showView(id: string, options: ShowViewOptions = {}): Promise<void> {
    const view = this.requireView(id);
    const container = this.requireContainer(view.containerId);
    const editorWindowId = await this.findEditorWindow();
    if (editorWindowId) this.editorWindowId = editorWindowId;

    const activeViewId = container.activeViewId;
    if (activeViewId && activeViewId !== id) {
      await this.closeView(activeViewId);
    }

    if (editorWindowId) {
      await workspace.nvim.call("win_gotoid", [editorWindowId]);
    }
    await view.tree.show(this.splitCommand(container.location));
    await this.installViewKeymaps(id, view.containerId, view.tree.windowId);
    await this.resizeVisibleViews();
    container.activeViewId = id;

    if (options.focus === false && editorWindowId) {
      await workspace.nvim.call("win_gotoid", [editorWindowId]);
    }
  }

  async closeContainer(id: string): Promise<void> {
    const container = this.requireContainer(id);
    if (container.activeViewId) {
      await this.closeView(container.activeViewId);
    }
    container.activeViewId = undefined;
  }

  async toggleTreeItem(id: string): Promise<void> {
    const view = this.requireView(id);
    if (!view.tree.windowId) return;
    await workspace.nvim.call("win_gotoid", [view.tree.windowId]);
    const key = workspace
      .getConfiguration("tree")
      .get<string>("key.toggle", "t");
    await workspace.nvim.input(key);
  }

  async openLocation(
    uri: string,
    line: number,
    character: number,
  ): Promise<void> {
    const editorWindowId = await this.findEditorWindow();
    if (editorWindowId) {
      this.editorWindowId = editorWindowId;
      await workspace.nvim.call("win_gotoid", [editorWindowId]);
    }
    await workspace.jumpTo(uri, Position.create(line, character), "edit");
  }

  dispose(): void {
    for (const view of this.views.values()) {
      for (const disposable of view.disposables) disposable.dispose();
      view.tree.dispose();
    }
    this.views.clear();
    this.containers.clear();
  }

  private requireContainer(id: string): RegisteredContainer {
    const container = this.containers.get(id);
    if (!container) throw new Error(`Unknown view container: ${id}`);
    return container;
  }

  private requireView(id: string): RegisteredView {
    const view = this.views.get(id);
    if (!view) throw new Error(`Unknown view: ${id}`);
    return view;
  }

  private sortViews(container: RegisteredContainer): void {
    container.viewIds.sort((left, right) => {
      return this.requireView(left).order - this.requireView(right).order;
    });
  }

  private async closeView(id: string): Promise<void> {
    const winid = this.views.get(id)?.tree.windowId;
    if (!winid) return;
    const valid = (await workspace.nvim.call("nvim_win_is_valid", [
      winid,
    ])) as boolean;
    if (valid) await workspace.nvim.call("nvim_win_close", [winid, true]);
  }

  private async findEditorWindow(): Promise<number | undefined> {
    const viewWindowIds = new Set(
      [...this.views.values()]
        .map((view) => view.tree.windowId)
        .filter((winid): winid is number => winid != null),
    );
    const currentWindowId = (await workspace.nvim.call("win_getid")) as number;
    if (!viewWindowIds.has(currentWindowId)) return currentWindowId;

    if (this.editorWindowId) {
      const valid = (await workspace.nvim.call("nvim_win_is_valid", [
        this.editorWindowId,
      ])) as boolean;
      if (valid) return this.editorWindowId;
    }

    const windowIds = (await workspace.nvim.call("nvim_list_wins")) as number[];
    return windowIds.find((winid) => !viewWindowIds.has(winid));
  }

  private splitCommand(location: ViewLocation): string {
    const config = workspace.getConfiguration("coc-ui");
    if (location === "panel") {
      const height = Math.max(3, config.get<number>("panel.height", 12));
      return `botright ${height}split`;
    }

    const primary = location === "primarySidebar";
    const position = config.get<"left" | "right">(
      primary ? "primarySidebar.position" : "secondarySidebar.position",
      primary ? "left" : "right",
    );
    const width = Math.max(
      10,
      config.get<number>(
        primary ? "primarySidebar.width" : "secondarySidebar.width",
        40,
      ),
    );
    return `${position === "left" ? "topleft" : "botright"} ${width}vsplit`;
  }

  private async resizeView(
    location: ViewLocation,
    windowId: number | undefined,
  ): Promise<void> {
    if (!windowId) return;
    const valid = (await workspace.nvim.call("nvim_win_is_valid", [
      windowId,
    ])) as boolean;
    if (!valid) return;

    const config = workspace.getConfiguration("coc-ui");
    if (location === "panel") {
      const height = Math.max(3, config.get<number>("panel.height", 12));
      await workspace.nvim.call("nvim_win_set_height", [windowId, height]);
      return;
    }

    const primary = location === "primarySidebar";
    const width = Math.max(
      10,
      config.get<number>(
        primary ? "primarySidebar.width" : "secondarySidebar.width",
        40,
      ),
    );
    await workspace.nvim.call("nvim_win_set_width", [windowId, width]);
  }

  private async resizeVisibleViews(): Promise<void> {
    for (const view of this.views.values()) {
      const container = this.containers.get(view.containerId);
      if (container)
        await this.resizeView(container.location, view.tree.windowId);
    }
  }

  private async installViewKeymaps(
    viewId: string,
    containerId: string,
    windowId: number | undefined,
  ): Promise<void> {
    if (!windowId) return;
    const bufferId = (await workspace.nvim.call("nvim_win_get_buf", [
      windowId,
    ])) as number;
    const rhs = `<Cmd>CocCommand coc-ui.closeContainer ${containerId}<CR>`;
    const options = { noremap: true, silent: true, nowait: true };
    await workspace.nvim.call("nvim_buf_set_keymap", [
      bufferId,
      "n",
      "q",
      rhs,
      options,
    ]);
    await workspace.nvim.call("nvim_buf_set_keymap", [
      bufferId,
      "n",
      "<Esc>",
      rhs,
      options,
    ]);
    if (workspace.getConfiguration("coc-ui").get("mouse.enable", true)) {
      const contextMenu = `<Cmd>CocCommand coc-ui.contextMenu ${viewId}<CR>`;
      await workspace.nvim.call("nvim_buf_set_keymap", [
        bufferId,
        "n",
        "<RightMouse>",
        contextMenu,
        options,
      ]);
      await workspace.nvim.call("nvim_buf_set_keymap", [
        bufferId,
        "n",
        "<RightRelease>",
        "<Nop>",
        options,
      ]);
    }
  }

  async showContextMenu(id: string): Promise<void> {
    const view = this.requireView(id);
    const windowId = view.tree.windowId;
    if (!windowId) return;

    const [mouseWindowId, line, column] = (await workspace.nvim.call(
      "coc#ui#get_mouse",
    )) as [number, number, number];
    if (mouseWindowId !== windowId || line < 1) return;

    await workspace.nvim.call("win_gotoid", [windowId]);
    await workspace.nvim.call("nvim_win_set_cursor", [
      windowId,
      [line, Math.max(0, column - 1)],
    ]);
    const key = workspace
      .getConfiguration("tree")
      .get<string>("key.actions", "<Tab>");
    await workspace.nvim.input(key);
  }

  async routeRightClick(): Promise<void> {
    const [mouseWindowId] = (await workspace.nvim.call("coc#ui#get_mouse")) as [
      number,
      number,
      number,
    ];
    const view = [...this.views.entries()].find(
      ([, registered]) => registered.tree.windowId === mouseWindowId,
    );
    if (view) {
      await this.showContextMenu(view[0]);
      return;
    }

    const termcodes = (await workspace.nvim.call("nvim_replace_termcodes", [
      "<RightMouse>",
      true,
      false,
      true,
    ])) as string;
    await workspace.nvim.feedKeys(termcodes, "n", false);
  }
}

function withViewActions<T>(
  provider: TreeDataProvider<T>,
  actions: ViewAction<T>[],
): TreeDataProvider<T> {
  if (!actions.length) return provider;

  return {
    onDidChangeTreeData: provider.onDidChangeTreeData,
    getTreeItem: (element) => provider.getTreeItem(element),
    getChildren: (element) => provider.getChildren(element),
    getParent: provider.getParent
      ? (element) => provider.getParent?.(element)
      : undefined,
    resolveTreeItem: provider.resolveTreeItem
      ? (item, element, token) =>
          provider.resolveTreeItem?.(item, element, token)
      : undefined,
    resolveActions: async (item, element) => {
      const inherited = provider.resolveActions
        ? ((await provider.resolveActions(item, element)) ?? [])
        : [];
      const contributed: TreeItemAction<T>[] = actions
        .filter((action) => !action.when || action.when(element))
        .map((action) => ({
          title: action.title,
          handler: action.handler,
        }));
      return [...inherited, ...contributed];
    },
  };
}

export async function activate(context: ExtensionContext): Promise<CocUiApi> {
  const ui = new CocUi();
  context.subscriptions.push(
    ui,
    commands.registerCommand("coc-ui.showContainer", (id: unknown) => {
      return ui.showContainer(String(id));
    }),
    commands.registerCommand("coc-ui.showView", (id: unknown) => {
      return ui.showView(String(id));
    }),
    commands.registerCommand("coc-ui.closeContainer", (id: unknown) => {
      return ui.closeContainer(String(id));
    }),
    commands.registerCommand("coc-ui.contextMenu", (id: unknown) => {
      return ui.showContextMenu(String(id));
    }),
    commands.registerCommand("coc-ui.routeRightMouse", () => {
      return ui.routeRightClick();
    }),
    commands.registerCommand("coc-ui.switchPrimarySidebar", () => {
      return ui.switchLocation("primarySidebar");
    }),
    commands.registerCommand("coc-ui.switchSecondarySidebar", () => {
      return ui.switchLocation("secondarySidebar");
    }),
    commands.registerCommand("coc-ui.switchPanel", () =>
      ui.switchLocation("panel"),
    ),
  );
  if (workspace.getConfiguration("coc-ui").get("mouse.enable", true)) {
    workspace.nvim.setKeymap(
      "n",
      "<RightMouse>",
      "<Cmd>CocCommand coc-ui.routeRightMouse<CR>",
      { noremap: true, silent: true, nowait: true },
    );
    context.subscriptions.push(
      Disposable.create(() => workspace.nvim.deleteKeymap("n", "<RightMouse>")),
    );
  }
  return ui;
}
