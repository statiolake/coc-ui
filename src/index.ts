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

/** Mirrors VS Code's workbench surfaces. */
export type ViewLocation = "primarySidebar" | "secondarySidebar" | "panel";
export type ViewVisibility = "visible" | "collapsed" | "hidden";

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
  icon?: string;
  location?: ViewLocation;
  order?: number;
}

export interface ViewRegistration {
  id: string;
  containerId: string;
  name: string;
  contextualTitle?: string;
  order?: number;
  visibility?: ViewVisibility;
}

export interface CocTreeViewOptions<T> extends TreeViewOptions<T> {
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
  registerView(registration: ViewRegistration): Disposable;
  createTreeView<T>(id: string, options: CocTreeViewOptions<T>): TreeView<T>;
  showContainer(id: string, options?: ShowViewOptions): Promise<void>;
  showLocation(location: ViewLocation): Promise<void>;
  hideLocation(location: ViewLocation): Promise<void>;
  toggleLocation(location: ViewLocation): Promise<void>;
  switchLocation(location: ViewLocation): Promise<void>;
  showView(id: string, options?: ShowViewOptions): Promise<void>;
  closeContainer(id: string): Promise<void>;
  toggleView(id: string): Promise<void>;
  toggleTreeItem(id: string): Promise<void>;
  openLocation(uri: string, line: number, character: number): Promise<void>;
}

type RegisteredView = {
  containerId: string;
  name: string;
  order: number;
  visibility: ViewVisibility;
  tree: TreeView<unknown>;
  disposables: Disposable[];
};

type RegisteredContainer = {
  title: string;
  icon: string;
  location: ViewLocation;
  order: number;
  viewIds: string[];
};

type ActivityBarState = {
  bufnr: number;
  winid: number;
  containerIds: string[];
};

type PlaceholderState = {
  bufnr: number;
  winid: number;
};

type SurfaceState = {
  activeContainerId?: string;
  activityBar?: ActivityBarState;
  placeholder?: PlaceholderState;
  visible: boolean;
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
  private readonly viewRegistrations = new Map<string, ViewRegistration>();
  private readonly views = new Map<string, RegisteredView>();
  private readonly surfaces = new Map<ViewLocation, SurfaceState>();
  private readonly unmountingContainers = new Set<string>();
  private editorWindowId: number | undefined;

  constructor(private readonly context: ExtensionContext) {}

  registerViewContainer(registration: ViewContainerRegistration): Disposable {
    if (this.containers.has(registration.id)) {
      throw new Error(`View container already registered: ${registration.id}`);
    }

    this.containers.set(registration.id, {
      title: registration.title,
      icon: registration.icon ?? "•",
      location: registration.location ?? "primarySidebar",
      order: registration.order ?? 0,
      viewIds: [],
    });
    void this.renderActivityBar(registration.location ?? "primarySidebar");

    return Disposable.create(() => {
      void this.closeContainer(registration.id);
      this.containers.delete(registration.id);
    });
  }

  registerView(registration: ViewRegistration): Disposable {
    if (
      this.viewRegistrations.has(registration.id) ||
      this.views.has(registration.id)
    ) {
      throw new Error(`View already registered: ${registration.id}`);
    }
    const container = this.containers.get(registration.containerId);
    if (!container) {
      throw new Error(`Unknown view container: ${registration.containerId}`);
    }
    this.viewRegistrations.set(registration.id, registration);

    return Disposable.create(() => {
      this.viewRegistrations.delete(registration.id);
      this.views.delete(registration.id);
      container.viewIds = container.viewIds.filter(
        (id) => id !== registration.id,
      );
    });
  }

  createTreeView<T>(id: string, options: CocTreeViewOptions<T>): TreeView<T> {
    if (this.views.has(id)) {
      throw new Error(`TreeView already created: ${id}`);
    }
    const registration = this.viewRegistrations.get(id);
    if (!registration) {
      throw new Error(`View contribution not registered: ${id}`);
    }
    const container = this.requireContainer(registration.containerId);

    const { actions = [], ...treeOptions } = options;
    const treeDataProvider = withViewActions(
      treeOptions.treeDataProvider,
      actions,
    );
    const tree = window.createTreeView(id, {
      ...treeOptions,
      treeDataProvider,
      bufhidden: treeOptions.bufhidden ?? "hide",
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
    tree.title = registration.name;

    const registered: RegisteredView = {
      containerId: registration.containerId,
      name: registration.name,
      order: registration.order ?? 0,
      visibility: this.context.workspaceState.get<ViewVisibility>(
        this.viewStateKey(id),
        registration.visibility ?? "visible",
      ),
      tree: tree as TreeView<unknown>,
      disposables: [],
    };

    this.views.set(id, registered);
    container.viewIds.push(id);
    this.sortViews(container);
    registered.disposables.push(
      tree.onDidChangeVisibility(({ visible }) => {
        if (!visible) void this.onViewHidden(id);
      }),
    );

    return tree;
  }

  async showContainer(id: string, options?: ShowViewOptions): Promise<void> {
    const container = this.requireContainer(id);
    const visibleViews = this.containerViews(container).filter(
      (view) => view.visibility !== "hidden",
    );
    if (!visibleViews.length) {
      throw new Error(`View container has no views: ${id}`);
    }

    const editorWindowId = await this.findEditorWindow();
    if (editorWindowId) this.editorWindowId = editorWindowId;

    const surface = this.surface(container.location);
    if (surface.activeContainerId && surface.activeContainerId !== id) {
      await this.unmountContainer(surface.activeContainerId);
    }
    surface.activeContainerId = id;
    surface.visible = true;

    await this.closePlaceholder(container.location);
    await this.ensureActivityBar(container.location);
    await this.mountContainer(id);
    await this.layoutContainer(id);
    await this.renderActivityBar(container.location);

    if (options?.focus !== false) {
      const target =
        visibleViews.find((view) => view.visibility === "visible") ??
        visibleViews[0];
      if (target?.tree.windowId) {
        await workspace.nvim.call("win_gotoid", [target.tree.windowId]);
      }
    } else if (editorWindowId) {
      await workspace.nvim.call("win_gotoid", [editorWindowId]);
    }
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

  async showLocation(location: ViewLocation): Promise<void> {
    const surface = this.surface(location);
    const containerId =
      surface.activeContainerId ?? this.firstContainerId(location);
    if (containerId) await this.showContainer(containerId);
    else await this.showEmptyLocation(location);
  }

  async hideLocation(location: ViewLocation): Promise<void> {
    const surface = this.surface(location);
    if (surface.activeContainerId) {
      await this.unmountContainer(surface.activeContainerId);
    }
    await this.closePlaceholder(location);
    surface.visible = false;
    await this.closeActivityBar(location);
  }

  async toggleLocation(location: ViewLocation): Promise<void> {
    const surface = this.surface(location);
    if (
      surface.visible &&
      !surface.activeContainerId &&
      !(await this.isValidWindow(surface.placeholder?.winid))
    ) {
      surface.visible = false;
    }
    if (surface.visible) await this.hideLocation(location);
    else await this.showLocation(location);
  }

  async selectActivityBar(location: ViewLocation): Promise<void> {
    const activityBar = this.surface(location).activityBar;
    if (!activityBar || !(await this.isValidWindow(activityBar.winid))) return;
    const [line] = (await workspace.nvim.call("nvim_win_get_cursor", [
      activityBar.winid,
    ])) as [number, number];
    const containerId = activityBar.containerIds[line - 1];
    if (containerId) await this.showContainer(containerId);
  }

  async closeLocation(location: ViewLocation): Promise<void> {
    const containerId = this.surface(location).activeContainerId;
    if (containerId) await this.closeContainer(containerId);
    else await this.hideLocation(location);
  }

  async toggleViewAtMouse(id: string): Promise<void> {
    const view = this.requireView(id);
    const [mouseWindowId, line] = (await workspace.nvim.call(
      "coc#ui#get_mouse",
    )) as [number, number, number];
    if (mouseWindowId === view.tree.windowId && line === 1) {
      await this.toggleView(id);
    }
  }

  async showView(id: string, options: ShowViewOptions = {}): Promise<void> {
    const view = this.requireView(id);
    view.visibility = "visible";
    await this.context.workspaceState.update(
      this.viewStateKey(id),
      view.visibility,
    );
    await this.showContainer(view.containerId, { focus: false });
    await this.layoutContainer(view.containerId);
    if (options.focus !== false && view.tree.windowId) {
      await workspace.nvim.call("win_gotoid", [view.tree.windowId]);
    }
  }

  async closeContainer(id: string): Promise<void> {
    const container = this.requireContainer(id);
    await this.unmountContainer(id);
    const surface = this.surface(container.location);
    if (surface.activeContainerId === id) {
      surface.activeContainerId = undefined;
      surface.visible = false;
      await this.closeActivityBar(container.location);
    }
  }

  async toggleView(id: string): Promise<void> {
    const view = this.requireView(id);
    view.visibility = view.visibility === "collapsed" ? "visible" : "collapsed";
    await this.context.workspaceState.update(
      this.viewStateKey(id),
      view.visibility,
    );
    await this.showContainer(view.containerId, { focus: false });
    await this.layoutContainer(view.containerId);
    if (view.tree.windowId) {
      await workspace.nvim.call("win_gotoid", [view.tree.windowId]);
    }
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
    this.viewRegistrations.clear();
    this.containers.clear();
    for (const surface of this.surfaces.values()) {
      if (surface.activityBar) {
        workspace.nvim.call(
          "nvim_buf_delete",
          [surface.activityBar.bufnr, { force: true }],
          true,
        );
      }
      if (surface.placeholder) {
        workspace.nvim.call(
          "nvim_buf_delete",
          [surface.placeholder.bufnr, { force: true }],
          true,
        );
      }
    }
    this.surfaces.clear();
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

  private viewStateKey(id: string): string {
    return `view.${id}.visibility`;
  }

  private sortViews(container: RegisteredContainer): void {
    container.viewIds.sort((left, right) => {
      return this.requireView(left).order - this.requireView(right).order;
    });
  }

  private containerViews(container: RegisteredContainer): RegisteredView[] {
    return container.viewIds.map((id) => this.requireView(id));
  }

  private surface(location: ViewLocation): SurfaceState {
    let surface = this.surfaces.get(location);
    if (!surface) {
      surface = { visible: false };
      this.surfaces.set(location, surface);
    }
    return surface;
  }

  private firstContainerId(location: ViewLocation): string | undefined {
    return [...this.containers.entries()]
      .filter(([, container]) => container.location === location)
      .sort(([, left], [, right]) => left.order - right.order)[0]?.[0];
  }

  private async mountContainer(id: string): Promise<void> {
    const container = this.requireContainer(id);
    const entries = container.viewIds
      .map((viewId) => [viewId, this.requireView(viewId)] as const)
      .filter(([, view]) => view.visibility !== "hidden");
    let anchorWindowId: number | undefined;

    for (const [viewId, view] of entries) {
      if (await this.isValidWindow(view.tree.windowId)) {
        anchorWindowId = view.tree.windowId;
        continue;
      }

      const targetWindowId = anchorWindowId ?? (await this.findEditorWindow());
      if (targetWindowId) {
        await workspace.nvim.call("win_gotoid", [targetWindowId]);
      }
      await view.tree.show(
        anchorWindowId
          ? this.stackSplitCommand(container.location)
          : this.splitCommand(container.location),
      );
      await this.installViewKeymaps(
        viewId,
        view.containerId,
        view.tree.windowId,
      );
      anchorWindowId = view.tree.windowId;
    }
  }

  private async unmountContainer(id: string): Promise<void> {
    const container = this.requireContainer(id);
    this.unmountingContainers.add(id);
    try {
      for (const view of this.containerViews(container)) {
        const winid = view.tree.windowId;
        if (await this.isValidWindow(winid)) {
          await workspace.nvim.call("nvim_win_close", [winid, true]);
        }
      }
    } finally {
      this.unmountingContainers.delete(id);
    }
  }

  private async onViewHidden(id: string): Promise<void> {
    const view = this.views.get(id);
    if (!view || this.unmountingContainers.has(view.containerId)) return;
    const container = this.containers.get(view.containerId);
    if (!container) return;
    const surface = this.surface(container.location);
    if (surface.activeContainerId !== view.containerId) return;

    for (const sibling of this.containerViews(container)) {
      if (await this.isValidWindow(sibling.tree.windowId)) {
        await this.layoutContainer(view.containerId);
        return;
      }
    }
    surface.visible = false;
    await this.closeActivityBar(container.location);
  }

  private async isValidWindow(winid: number | undefined): Promise<boolean> {
    if (!winid) return false;
    return (await workspace.nvim.call("nvim_win_is_valid", [winid])) as boolean;
  }

  private async findEditorWindow(): Promise<number | undefined> {
    const uiWindowIds = new Set(
      [...this.views.values()]
        .map((view) => view.tree.windowId)
        .filter((winid): winid is number => winid != null),
    );
    for (const surface of this.surfaces.values()) {
      if (surface.activityBar?.winid)
        uiWindowIds.add(surface.activityBar.winid);
      if (surface.placeholder?.winid)
        uiWindowIds.add(surface.placeholder.winid);
    }
    const currentWindowId = (await workspace.nvim.call("win_getid")) as number;
    if (!uiWindowIds.has(currentWindowId)) return currentWindowId;

    if (this.editorWindowId) {
      const valid = (await workspace.nvim.call("nvim_win_is_valid", [
        this.editorWindowId,
      ])) as boolean;
      if (valid) return this.editorWindowId;
    }

    const windowIds = (await workspace.nvim.call("nvim_list_wins")) as number[];
    return windowIds.find((winid) => !uiWindowIds.has(winid));
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
    return `${position === "left" ? "leftabove" : "rightbelow"} ${width}vsplit`;
  }

  private async showEmptyLocation(location: ViewLocation): Promise<void> {
    const surface = this.surface(location);
    if (await this.isValidWindow(surface.placeholder?.winid)) {
      surface.visible = true;
      await workspace.nvim.call("win_gotoid", [surface.placeholder?.winid]);
      return;
    }

    const editorWindowId = await this.findEditorWindow();
    if (!editorWindowId) return;
    this.editorWindowId = editorWindowId;
    await workspace.nvim.call("win_gotoid", [editorWindowId]);
    await workspace.nvim.command(this.splitCommand(location));

    const winid = (await workspace.nvim.call("win_getid")) as number;
    const bufnr = (await workspace.nvim.call("nvim_create_buf", [
      false,
      true,
    ])) as number;
    await workspace.nvim.call("nvim_buf_set_name", [
      bufnr,
      `coc-ui-placeholder://${location}`,
    ]);
    await workspace.nvim.call("nvim_win_set_buf", [winid, bufnr]);
    for (const [name, value] of [
      ["buftype", "nofile"],
      ["bufhidden", "wipe"],
      ["swapfile", false],
      ["filetype", "cocui-placeholder"],
    ] as const) {
      await workspace.nvim.call("nvim_buf_set_option", [bufnr, name, value]);
    }
    for (const [name, value] of [
      ["number", false],
      ["relativenumber", false],
      ["wrap", false],
      ["winfixwidth", location !== "panel"],
      ["winfixheight", location === "panel"],
      ["signcolumn", "no"],
      ["statusline", "%!repeat('─',winwidth(g:statusline_winid))"],
    ] as const) {
      await workspace.nvim.call("nvim_win_set_option", [winid, name, value]);
    }

    const rhs = `<Cmd>CocCommand coc-ui.hideLocation ${location}<CR>`;
    const options = { noremap: true, silent: true, nowait: true };
    for (const key of ["q", "<Esc>"]) {
      await workspace.nvim.call("nvim_buf_set_keymap", [
        bufnr,
        "n",
        key,
        rhs,
        options,
      ]);
    }

    surface.placeholder = { bufnr, winid };
    surface.visible = true;
  }

  private async closePlaceholder(location: ViewLocation): Promise<void> {
    const surface = this.surface(location);
    const placeholder = surface.placeholder;
    if (!placeholder) return;
    surface.placeholder = undefined;
    const valid = (await workspace.nvim.call("nvim_buf_is_valid", [
      placeholder.bufnr,
    ])) as boolean;
    if (valid) {
      await workspace.nvim.call("nvim_buf_delete", [
        placeholder.bufnr,
        { force: true },
      ]);
    }
  }

  private stackSplitCommand(location: ViewLocation): string {
    return location === "panel" ? "rightbelow vsplit" : "belowright split";
  }

  private async layoutContainer(id: string): Promise<void> {
    const container = this.requireContainer(id);
    const entries: Array<[RegisteredView, number]> = [];
    for (const view of this.containerViews(container)) {
      if (view.visibility === "hidden" || !view.tree.windowId) continue;
      if (await this.isValidWindow(view.tree.windowId)) {
        entries.push([view, view.tree.windowId]);
      }
    }
    if (!entries.length) return;

    const config = workspace.getConfiguration("coc-ui");
    if (container.location === "panel") {
      const height = Math.max(3, config.get<number>("panel.height", 12));
      for (const [, winid] of entries) {
        await workspace.nvim.call("nvim_win_set_height", [winid, height]);
      }
      const widths = (await Promise.all(
        entries.map(([, winid]) =>
          workspace.nvim.call("nvim_win_get_width", [winid]),
        ),
      )) as number[];
      const totalWidth = widths.reduce((sum, value) => sum + value, 0);
      const expanded = entries.filter(
        ([view]) => view.visibility !== "collapsed",
      );
      const collapsed = entries.filter(
        ([view]) => view.visibility === "collapsed",
      );
      const collapsedWidth = 12;
      for (const [, winid] of collapsed) {
        await workspace.nvim.call("nvim_win_set_width", [
          winid,
          collapsedWidth,
        ]);
      }
      if (expanded.length) {
        const width = Math.max(
          12,
          Math.floor(
            (totalWidth - collapsed.length * collapsedWidth) / expanded.length,
          ),
        );
        for (const [, winid] of expanded) {
          await workspace.nvim.call("nvim_win_set_width", [winid, width]);
        }
      }
      return;
    }

    const primary = container.location === "primarySidebar";
    const width = Math.max(
      10,
      config.get<number>(
        primary ? "primarySidebar.width" : "secondarySidebar.width",
        40,
      ),
    );
    for (const [, winid] of entries) {
      await workspace.nvim.call("nvim_win_set_width", [winid, width]);
    }

    const heights = (await Promise.all(
      entries.map(([, winid]) =>
        workspace.nvim.call("nvim_win_get_height", [winid]),
      ),
    )) as number[];
    const totalHeight = heights.reduce((sum, height) => sum + height, 0);
    const expanded = entries.filter(
      ([view]) => view.visibility !== "collapsed",
    );
    const collapsed = entries.filter(
      ([view]) => view.visibility === "collapsed",
    );
    for (const [, winid] of collapsed) {
      await workspace.nvim.call("nvim_win_set_height", [winid, 1]);
    }
    if (expanded.length) {
      const height = Math.max(
        2,
        Math.floor((totalHeight - collapsed.length) / expanded.length),
      );
      for (const [, winid] of expanded) {
        await workspace.nvim.call("nvim_win_set_height", [winid, height]);
      }
    }
  }

  private async ensureActivityBar(location: ViewLocation): Promise<void> {
    if (location === "panel") return;
    if (
      !workspace
        .getConfiguration("coc-ui")
        .get<boolean>("activityBar.enable", true)
    ) {
      return;
    }

    const surface = this.surface(location);
    if (await this.isValidWindow(surface.activityBar?.winid)) {
      await this.renderActivityBar(location);
      return;
    }

    const editorWindowId = await this.findEditorWindow();
    if (!editorWindowId) return;
    await workspace.nvim.call("win_gotoid", [editorWindowId]);

    const config = workspace.getConfiguration("coc-ui");
    const primary = location === "primarySidebar";
    const position = config.get<"left" | "right">(
      primary ? "primarySidebar.position" : "secondarySidebar.position",
      primary ? "left" : "right",
    );
    const width = Math.max(2, config.get<number>("activityBar.width", 3));
    await workspace.nvim.command(
      `${position === "left" ? "leftabove" : "rightbelow"} ${width}vsplit`,
    );
    const winid = (await workspace.nvim.call("win_getid")) as number;
    const bufnr = (await workspace.nvim.call("nvim_create_buf", [
      false,
      true,
    ])) as number;
    await workspace.nvim.call("nvim_buf_set_name", [
      bufnr,
      `coc-ui-activitybar://${location}`,
    ]);
    await workspace.nvim.call("nvim_win_set_buf", [winid, bufnr]);
    await workspace.nvim.call("nvim_buf_set_option", [
      bufnr,
      "buftype",
      "nofile",
    ]);
    await workspace.nvim.call("nvim_buf_set_option", [
      bufnr,
      "bufhidden",
      "wipe",
    ]);
    await workspace.nvim.call("nvim_buf_set_option", [
      bufnr,
      "swapfile",
      false,
    ]);
    await workspace.nvim.call("nvim_buf_set_option", [
      bufnr,
      "filetype",
      "cocui-activitybar",
    ]);
    for (const [name, value] of [
      ["number", false],
      ["relativenumber", false],
      ["cursorline", true],
      ["wrap", false],
      ["winfixwidth", true],
      ["signcolumn", "no"],
      ["statusline", "─".repeat(width)],
    ] as const) {
      await workspace.nvim.call("nvim_win_set_option", [winid, name, value]);
    }
    await workspace.nvim.call("nvim_win_set_width", [winid, width]);

    const options = { noremap: true, silent: true, nowait: true };
    const select = `<Cmd>CocCommand coc-ui.selectActivityBar ${location}<CR>`;
    await workspace.nvim.call("nvim_buf_set_keymap", [
      bufnr,
      "n",
      "<CR>",
      select,
      options,
    ]);
    await workspace.nvim.call("nvim_buf_set_keymap", [
      bufnr,
      "n",
      "<LeftRelease>",
      select,
      options,
    ]);
    await workspace.nvim.call("nvim_buf_set_keymap", [
      bufnr,
      "n",
      "<RightMouse>",
      `<Cmd>CocCommand coc-ui.switch${primary ? "PrimarySidebar" : "SecondarySidebar"}<CR>`,
      options,
    ]);
    await workspace.nvim.call("nvim_buf_set_keymap", [
      bufnr,
      "n",
      "q",
      `<Cmd>CocCommand coc-ui.hideLocation ${location}<CR>`,
      options,
    ]);
    surface.activityBar = { bufnr, winid, containerIds: [] };
    await this.renderActivityBar(location);
  }

  private async closeActivityBar(location: ViewLocation): Promise<void> {
    const surface = this.surface(location);
    const activityBar = surface.activityBar;
    if (!activityBar) return;
    surface.activityBar = undefined;
    const valid = (await workspace.nvim.call("nvim_buf_is_valid", [
      activityBar.bufnr,
    ])) as boolean;
    if (valid) {
      await workspace.nvim.call("nvim_buf_delete", [
        activityBar.bufnr,
        { force: true },
      ]);
    }
  }

  private async renderActivityBar(location: ViewLocation): Promise<void> {
    if (location === "panel") return;
    const surface = this.surface(location);
    const activityBar = surface.activityBar;
    if (!activityBar || !(await this.isValidWindow(activityBar.winid))) return;

    const width = Math.max(
      2,
      workspace.getConfiguration("coc-ui").get<number>("activityBar.width", 3),
    );
    await workspace.nvim.call("nvim_win_set_width", [activityBar.winid, width]);

    const containers = [...this.containers.entries()]
      .filter(([, container]) => container.location === location)
      .sort(([, left], [, right]) => left.order - right.order);
    activityBar.containerIds = containers.map(([id]) => id);
    const lines = containers.map(([, container]) => ` ${container.icon}`);
    await workspace.nvim.call("nvim_buf_set_option", [
      activityBar.bufnr,
      "modifiable",
      true,
    ]);
    await workspace.nvim.call("nvim_buf_set_lines", [
      activityBar.bufnr,
      0,
      -1,
      false,
      lines.length ? lines : [""],
    ]);
    await workspace.nvim.call("nvim_buf_set_option", [
      activityBar.bufnr,
      "modifiable",
      false,
    ]);
    await workspace.nvim.call("nvim_buf_clear_namespace", [
      activityBar.bufnr,
      -1,
      0,
      -1,
    ]);
    const activeLine = activityBar.containerIds.indexOf(
      surface.activeContainerId ?? "",
    );
    if (activeLine >= 0) {
      await workspace.nvim.call("nvim_win_set_cursor", [
        activityBar.winid,
        [activeLine + 1, 0],
      ]);
      await workspace.nvim.call("nvim_buf_add_highlight", [
        activityBar.bufnr,
        -1,
        "CocUiActivityBarActive",
        activeLine,
        0,
        -1,
      ]);
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
    const location = this.requireContainer(containerId).location;
    const rhs = `<Cmd>CocCommand coc-ui.hideLocation ${location}<CR>`;
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
      "za",
      `<Cmd>CocCommand coc-ui.toggleView ${viewId}<CR>`,
      options,
    ]);
    await workspace.nvim.call("nvim_buf_set_keymap", [
      bufferId,
      "n",
      "<2-LeftMouse>",
      `<Cmd>CocCommand coc-ui.toggleViewAtMouse ${viewId}<CR>`,
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
  const ui = new CocUi(context);
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
    commands.registerCommand("coc-ui.closeLocation", (location: unknown) => {
      return ui.closeLocation(String(location) as ViewLocation);
    }),
    commands.registerCommand("coc-ui.showLocation", (location: unknown) => {
      return ui.showLocation(String(location) as ViewLocation);
    }),
    commands.registerCommand("coc-ui.hideLocation", (location: unknown) => {
      return ui.hideLocation(String(location) as ViewLocation);
    }),
    commands.registerCommand("coc-ui.toggleLocation", (location: unknown) => {
      return ui.toggleLocation(String(location) as ViewLocation);
    }),
    commands.registerCommand("coc-ui.togglePrimarySidebar", () => {
      return ui.toggleLocation("primarySidebar");
    }),
    commands.registerCommand("coc-ui.toggleSecondarySidebar", () => {
      return ui.toggleLocation("secondarySidebar");
    }),
    commands.registerCommand("coc-ui.togglePanel", () => {
      return ui.toggleLocation("panel");
    }),
    commands.registerCommand("coc-ui.toggleView", (id: unknown) => {
      return ui.toggleView(String(id));
    }),
    commands.registerCommand("coc-ui.toggleViewAtMouse", (id: unknown) => {
      return ui.toggleViewAtMouse(String(id));
    }),
    commands.registerCommand(
      "coc-ui.selectActivityBar",
      (location: unknown) => {
        return ui.selectActivityBar(String(location) as ViewLocation);
      },
    ),
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
  await workspace.nvim.command(
    "highlight default link CocUiActivityBarActive CursorLine",
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
