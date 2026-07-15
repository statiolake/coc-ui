"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  ViewContainerLocation: () => ViewContainerLocation,
  activate: () => activate
});
module.exports = __toCommonJS(index_exports);
var import_coc = require("coc.nvim");
var ViewContainerLocation = {
  Sidebar: "primarySidebar",
  AuxiliaryBar: "secondarySidebar",
  Panel: "panel"
};
var CocUi = class {
  containers = /* @__PURE__ */ new Map();
  views = /* @__PURE__ */ new Map();
  editorWindowId;
  registerViewContainer(registration) {
    if (this.containers.has(registration.id)) {
      throw new Error(`View container already registered: ${registration.id}`);
    }
    this.containers.set(registration.id, {
      title: registration.title,
      location: registration.location ?? "primarySidebar",
      order: registration.order ?? 0,
      viewIds: [],
      activeViewId: void 0
    });
    return import_coc.Disposable.create(() => {
      void this.closeContainer(registration.id);
      this.containers.delete(registration.id);
    });
  }
  createTreeView(registration) {
    if (this.views.has(registration.id)) {
      throw new Error(`View already registered: ${registration.id}`);
    }
    const container = this.containers.get(registration.containerId);
    if (!container) {
      throw new Error(`Unknown view container: ${registration.containerId}`);
    }
    const tree = import_coc.window.createTreeView(registration.id, {
      ...registration,
      bufhidden: registration.bufhidden ?? "hide"
    });
    tree.title = registration.title ?? registration.id;
    tree.description = registration.description;
    const registered = {
      containerId: registration.containerId,
      order: registration.order ?? 0,
      tree,
      disposables: []
    };
    registered.disposables.push(
      tree.onDidChangeVisibility(({ visible }) => {
        if (!visible && container.activeViewId === registration.id) {
          container.activeViewId = void 0;
        }
      })
    );
    this.views.set(registration.id, registered);
    container.viewIds.push(registration.id);
    this.sortViews(container);
    return tree;
  }
  async showContainer(id, options) {
    const container = this.requireContainer(id);
    const viewId = container.activeViewId ?? container.viewIds[0];
    if (!viewId) {
      throw new Error(`View container has no views: ${id}`);
    }
    await this.showView(viewId, options);
  }
  async switchLocation(location) {
    const containers = [...this.containers.entries()].filter(([, container]) => container.location === location).sort(([, left], [, right]) => left.order - right.order);
    if (!containers.length) return;
    const index = await import_coc.window.showQuickpick(
      containers.map(([id, container]) => `${container.title} (${id})`),
      "Select view container"
    );
    if (index >= 0) await this.showContainer(containers[index][0]);
  }
  async showView(id, options = {}) {
    const view = this.requireView(id);
    const container = this.requireContainer(view.containerId);
    const editorWindowId = await this.findEditorWindow();
    if (editorWindowId) this.editorWindowId = editorWindowId;
    const activeViewId = container.activeViewId;
    if (activeViewId && activeViewId !== id) {
      await this.closeView(activeViewId);
    }
    if (editorWindowId) {
      await import_coc.workspace.nvim.call("win_gotoid", [editorWindowId]);
    }
    await view.tree.show(this.splitCommand(container.location));
    await this.installViewKeymaps(id, view.containerId, view.tree.windowId);
    await this.resizeVisibleViews();
    container.activeViewId = id;
    if (options.focus === false && editorWindowId) {
      await import_coc.workspace.nvim.call("win_gotoid", [editorWindowId]);
    }
  }
  async closeContainer(id) {
    const container = this.requireContainer(id);
    if (container.activeViewId) {
      await this.closeView(container.activeViewId);
    }
    container.activeViewId = void 0;
  }
  async toggleTreeItem(id) {
    const view = this.requireView(id);
    if (!view.tree.windowId) return;
    await import_coc.workspace.nvim.call("win_gotoid", [view.tree.windowId]);
    const key = import_coc.workspace.getConfiguration("tree").get("key.toggle", "t");
    await import_coc.workspace.nvim.input(key);
  }
  async openLocation(uri, line, character) {
    const editorWindowId = await this.findEditorWindow();
    if (editorWindowId) {
      this.editorWindowId = editorWindowId;
      await import_coc.workspace.nvim.call("win_gotoid", [editorWindowId]);
    }
    await import_coc.workspace.jumpTo(uri, import_coc.Position.create(line, character), "edit");
  }
  dispose() {
    for (const view of this.views.values()) {
      for (const disposable of view.disposables) disposable.dispose();
      view.tree.dispose();
    }
    this.views.clear();
    this.containers.clear();
  }
  requireContainer(id) {
    const container = this.containers.get(id);
    if (!container) throw new Error(`Unknown view container: ${id}`);
    return container;
  }
  requireView(id) {
    const view = this.views.get(id);
    if (!view) throw new Error(`Unknown view: ${id}`);
    return view;
  }
  sortViews(container) {
    container.viewIds.sort((left, right) => {
      return this.requireView(left).order - this.requireView(right).order;
    });
  }
  async closeView(id) {
    const winid = this.views.get(id)?.tree.windowId;
    if (!winid) return;
    const valid = await import_coc.workspace.nvim.call("nvim_win_is_valid", [
      winid
    ]);
    if (valid) await import_coc.workspace.nvim.call("nvim_win_close", [winid, true]);
  }
  async findEditorWindow() {
    const viewWindowIds = new Set(
      [...this.views.values()].map((view) => view.tree.windowId).filter((winid) => winid != null)
    );
    const currentWindowId = await import_coc.workspace.nvim.call("win_getid");
    if (!viewWindowIds.has(currentWindowId)) return currentWindowId;
    if (this.editorWindowId) {
      const valid = await import_coc.workspace.nvim.call("nvim_win_is_valid", [
        this.editorWindowId
      ]);
      if (valid) return this.editorWindowId;
    }
    const windowIds = await import_coc.workspace.nvim.call("nvim_list_wins");
    return windowIds.find((winid) => !viewWindowIds.has(winid));
  }
  splitCommand(location) {
    const config = import_coc.workspace.getConfiguration("coc-ui");
    if (location === "panel") {
      const height = Math.max(3, config.get("panel.height", 12));
      return `botright ${height}split`;
    }
    const primary = location === "primarySidebar";
    const position = config.get(
      primary ? "primarySidebar.position" : "secondarySidebar.position",
      primary ? "left" : "right"
    );
    const width = Math.max(
      10,
      config.get(
        primary ? "primarySidebar.width" : "secondarySidebar.width",
        40
      )
    );
    return `${position === "left" ? "topleft" : "botright"} ${width}vsplit`;
  }
  async resizeView(location, windowId) {
    if (!windowId) return;
    const valid = await import_coc.workspace.nvim.call("nvim_win_is_valid", [
      windowId
    ]);
    if (!valid) return;
    const config = import_coc.workspace.getConfiguration("coc-ui");
    if (location === "panel") {
      const height = Math.max(3, config.get("panel.height", 12));
      await import_coc.workspace.nvim.call("nvim_win_set_height", [windowId, height]);
      return;
    }
    const primary = location === "primarySidebar";
    const width = Math.max(
      10,
      config.get(
        primary ? "primarySidebar.width" : "secondarySidebar.width",
        40
      )
    );
    await import_coc.workspace.nvim.call("nvim_win_set_width", [windowId, width]);
  }
  async resizeVisibleViews() {
    for (const view of this.views.values()) {
      const container = this.containers.get(view.containerId);
      if (container)
        await this.resizeView(container.location, view.tree.windowId);
    }
  }
  async installViewKeymaps(viewId, containerId, windowId) {
    if (!windowId) return;
    const bufferId = await import_coc.workspace.nvim.call("nvim_win_get_buf", [
      windowId
    ]);
    const rhs = `<Cmd>CocCommand coc-ui.closeContainer ${containerId}<CR>`;
    const options = { noremap: true, silent: true, nowait: true };
    await import_coc.workspace.nvim.call("nvim_buf_set_keymap", [
      bufferId,
      "n",
      "q",
      rhs,
      options
    ]);
    await import_coc.workspace.nvim.call("nvim_buf_set_keymap", [
      bufferId,
      "n",
      "<Esc>",
      rhs,
      options
    ]);
    if (import_coc.workspace.getConfiguration("coc-ui").get("mouse.enable", true)) {
      const contextMenu = `<Cmd>CocCommand coc-ui.contextMenu ${viewId}<CR>`;
      await import_coc.workspace.nvim.call("nvim_buf_set_keymap", [
        bufferId,
        "n",
        "<RightMouse>",
        contextMenu,
        options
      ]);
      await import_coc.workspace.nvim.call("nvim_buf_set_keymap", [
        bufferId,
        "n",
        "<RightRelease>",
        "<Nop>",
        options
      ]);
    }
  }
  async showContextMenu(id) {
    const view = this.requireView(id);
    const windowId = view.tree.windowId;
    if (!windowId) return;
    const [mouseWindowId, line, column] = await import_coc.workspace.nvim.call(
      "coc#ui#get_mouse"
    );
    if (mouseWindowId !== windowId || line < 1) return;
    await import_coc.workspace.nvim.call("win_gotoid", [windowId]);
    await import_coc.workspace.nvim.call("nvim_win_set_cursor", [
      windowId,
      [line, Math.max(0, column - 1)]
    ]);
    const key = import_coc.workspace.getConfiguration("tree").get("key.actions", "<Tab>");
    await import_coc.workspace.nvim.input(key);
  }
  async routeRightClick() {
    const [mouseWindowId] = await import_coc.workspace.nvim.call("coc#ui#get_mouse");
    const view = [...this.views.entries()].find(
      ([, registered]) => registered.tree.windowId === mouseWindowId
    );
    if (view) {
      await this.showContextMenu(view[0]);
      return;
    }
    const termcodes = await import_coc.workspace.nvim.call("nvim_replace_termcodes", [
      "<RightMouse>",
      true,
      false,
      true
    ]);
    await import_coc.workspace.nvim.feedKeys(termcodes, "n", false);
  }
};
async function activate(context) {
  const ui = new CocUi();
  context.subscriptions.push(
    ui,
    import_coc.commands.registerCommand("coc-ui.showContainer", (id) => {
      return ui.showContainer(String(id));
    }),
    import_coc.commands.registerCommand("coc-ui.showView", (id) => {
      return ui.showView(String(id));
    }),
    import_coc.commands.registerCommand("coc-ui.closeContainer", (id) => {
      return ui.closeContainer(String(id));
    }),
    import_coc.commands.registerCommand("coc-ui.contextMenu", (id) => {
      return ui.showContextMenu(String(id));
    }),
    import_coc.commands.registerCommand("coc-ui.routeRightMouse", () => {
      return ui.routeRightClick();
    }),
    import_coc.commands.registerCommand("coc-ui.switchPrimarySidebar", () => {
      return ui.switchLocation("primarySidebar");
    }),
    import_coc.commands.registerCommand("coc-ui.switchSecondarySidebar", () => {
      return ui.switchLocation("secondarySidebar");
    }),
    import_coc.commands.registerCommand(
      "coc-ui.switchPanel",
      () => ui.switchLocation("panel")
    )
  );
  if (import_coc.workspace.getConfiguration("coc-ui").get("mouse.enable", true)) {
    import_coc.workspace.nvim.setKeymap(
      "n",
      "<RightMouse>",
      "<Cmd>CocCommand coc-ui.routeRightMouse<CR>",
      { noremap: true, silent: true, nowait: true }
    );
    context.subscriptions.push(
      import_coc.Disposable.create(() => import_coc.workspace.nvim.deleteKeymap("n", "<RightMouse>"))
    );
  }
  return ui;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  ViewContainerLocation,
  activate
});
//# sourceMappingURL=index.js.map
