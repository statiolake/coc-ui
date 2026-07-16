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
  constructor(context) {
    this.context = context;
  }
  containers = /* @__PURE__ */ new Map();
  viewRegistrations = /* @__PURE__ */ new Map();
  views = /* @__PURE__ */ new Map();
  surfaces = /* @__PURE__ */ new Map();
  unmountingContainers = /* @__PURE__ */ new Set();
  editorWindowId;
  registerViewContainer(registration) {
    if (this.containers.has(registration.id)) {
      throw new Error(`View container already registered: ${registration.id}`);
    }
    this.containers.set(registration.id, {
      title: registration.title,
      icon: registration.icon ?? "\u2022",
      location: registration.location ?? "primarySidebar",
      order: registration.order ?? 0,
      viewIds: []
    });
    void this.renderActivityBar(registration.location ?? "primarySidebar");
    return import_coc.Disposable.create(() => {
      void this.closeContainer(registration.id);
      this.containers.delete(registration.id);
    });
  }
  registerView(registration) {
    if (this.viewRegistrations.has(registration.id) || this.views.has(registration.id)) {
      throw new Error(`View already registered: ${registration.id}`);
    }
    const container = this.containers.get(registration.containerId);
    if (!container) {
      throw new Error(`Unknown view container: ${registration.containerId}`);
    }
    this.viewRegistrations.set(registration.id, registration);
    return import_coc.Disposable.create(() => {
      this.viewRegistrations.delete(registration.id);
      this.views.delete(registration.id);
      container.viewIds = container.viewIds.filter(
        (id) => id !== registration.id
      );
    });
  }
  createTreeView(id, options) {
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
      actions
    );
    const tree = import_coc.window.createTreeView(id, {
      ...treeOptions,
      treeDataProvider,
      bufhidden: treeOptions.bufhidden ?? "hide"
    });
    const keymappableTree = tree;
    if (typeof keymappableTree.registerLocalKeymap !== "function") {
      throw new Error(
        "Installed coc.nvim does not support TreeView keybindings"
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
          true
        );
      }
    }
    tree.title = registration.name;
    const registered = {
      containerId: registration.containerId,
      name: registration.name,
      order: registration.order ?? 0,
      visibility: this.context.workspaceState.get(
        this.viewStateKey(id),
        registration.visibility ?? "visible"
      ),
      tree,
      disposables: []
    };
    this.views.set(id, registered);
    container.viewIds.push(id);
    this.sortViews(container);
    registered.disposables.push(
      tree.onDidChangeVisibility(({ visible }) => {
        if (!visible) void this.onViewHidden(id);
      })
    );
    return tree;
  }
  async showContainer(id, options) {
    const container = this.requireContainer(id);
    const visibleViews = this.containerViews(container).filter(
      (view) => view.visibility !== "hidden"
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
    await this.ensureActivityBar(container.location);
    await this.mountContainer(id);
    await this.layoutContainer(id);
    await this.renderActivityBar(container.location);
    if (options?.focus !== false) {
      const target = visibleViews.find((view) => view.visibility === "visible") ?? visibleViews[0];
      if (target?.tree.windowId) {
        await import_coc.workspace.nvim.call("win_gotoid", [target.tree.windowId]);
      }
    } else if (editorWindowId) {
      await import_coc.workspace.nvim.call("win_gotoid", [editorWindowId]);
    }
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
  async showLocation(location) {
    const surface = this.surface(location);
    const containerId = surface.activeContainerId ?? this.firstContainerId(location);
    if (containerId) await this.showContainer(containerId);
  }
  async hideLocation(location) {
    const surface = this.surface(location);
    if (surface.activeContainerId) {
      await this.unmountContainer(surface.activeContainerId);
    }
    surface.visible = false;
    await this.closeActivityBar(location);
  }
  async toggleLocation(location) {
    const surface = this.surface(location);
    if (surface.visible) await this.hideLocation(location);
    else await this.showLocation(location);
  }
  async selectActivityBar(location) {
    const activityBar = this.surface(location).activityBar;
    if (!activityBar || !await this.isValidWindow(activityBar.winid)) return;
    const [line] = await import_coc.workspace.nvim.call("nvim_win_get_cursor", [
      activityBar.winid
    ]);
    const containerId = activityBar.containerIds[line - 1];
    if (containerId) await this.showContainer(containerId);
  }
  async closeLocation(location) {
    const containerId = this.surface(location).activeContainerId;
    if (containerId) await this.closeContainer(containerId);
  }
  async toggleViewAtMouse(id) {
    const view = this.requireView(id);
    const [mouseWindowId, line] = await import_coc.workspace.nvim.call(
      "coc#ui#get_mouse"
    );
    if (mouseWindowId === view.tree.windowId && line === 1) {
      await this.toggleView(id);
    }
  }
  async showView(id, options = {}) {
    const view = this.requireView(id);
    view.visibility = "visible";
    await this.context.workspaceState.update(
      this.viewStateKey(id),
      view.visibility
    );
    await this.showContainer(view.containerId, { focus: false });
    await this.layoutContainer(view.containerId);
    if (options.focus !== false && view.tree.windowId) {
      await import_coc.workspace.nvim.call("win_gotoid", [view.tree.windowId]);
    }
  }
  async closeContainer(id) {
    const container = this.requireContainer(id);
    await this.unmountContainer(id);
    const surface = this.surface(container.location);
    if (surface.activeContainerId === id) {
      surface.activeContainerId = void 0;
      surface.visible = false;
      await this.closeActivityBar(container.location);
    }
  }
  async toggleView(id) {
    const view = this.requireView(id);
    view.visibility = view.visibility === "collapsed" ? "visible" : "collapsed";
    await this.context.workspaceState.update(
      this.viewStateKey(id),
      view.visibility
    );
    await this.showContainer(view.containerId, { focus: false });
    await this.layoutContainer(view.containerId);
    if (view.tree.windowId) {
      await import_coc.workspace.nvim.call("win_gotoid", [view.tree.windowId]);
    }
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
    this.viewRegistrations.clear();
    this.containers.clear();
    for (const surface of this.surfaces.values()) {
      if (surface.activityBar) {
        import_coc.workspace.nvim.call(
          "nvim_buf_delete",
          [surface.activityBar.bufnr, { force: true }],
          true
        );
      }
    }
    this.surfaces.clear();
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
  viewStateKey(id) {
    return `view.${id}.visibility`;
  }
  sortViews(container) {
    container.viewIds.sort((left, right) => {
      return this.requireView(left).order - this.requireView(right).order;
    });
  }
  containerViews(container) {
    return container.viewIds.map((id) => this.requireView(id));
  }
  surface(location) {
    let surface = this.surfaces.get(location);
    if (!surface) {
      surface = { visible: false };
      this.surfaces.set(location, surface);
    }
    return surface;
  }
  firstContainerId(location) {
    return [...this.containers.entries()].filter(([, container]) => container.location === location).sort(([, left], [, right]) => left.order - right.order)[0]?.[0];
  }
  async mountContainer(id) {
    const container = this.requireContainer(id);
    const entries = container.viewIds.map((viewId) => [viewId, this.requireView(viewId)]).filter(([, view]) => view.visibility !== "hidden");
    let anchorWindowId;
    for (const [viewId, view] of entries) {
      if (await this.isValidWindow(view.tree.windowId)) {
        anchorWindowId = view.tree.windowId;
        continue;
      }
      const targetWindowId = anchorWindowId ?? await this.findEditorWindow();
      if (targetWindowId) {
        await import_coc.workspace.nvim.call("win_gotoid", [targetWindowId]);
      }
      await view.tree.show(
        anchorWindowId ? this.stackSplitCommand(container.location) : this.splitCommand(container.location)
      );
      await this.installViewKeymaps(
        viewId,
        view.containerId,
        view.tree.windowId
      );
      anchorWindowId = view.tree.windowId;
    }
  }
  async unmountContainer(id) {
    const container = this.requireContainer(id);
    this.unmountingContainers.add(id);
    try {
      for (const view of this.containerViews(container)) {
        const winid = view.tree.windowId;
        if (await this.isValidWindow(winid)) {
          await import_coc.workspace.nvim.call("nvim_win_close", [winid, true]);
        }
      }
    } finally {
      this.unmountingContainers.delete(id);
    }
  }
  async onViewHidden(id) {
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
  async isValidWindow(winid) {
    if (!winid) return false;
    return await import_coc.workspace.nvim.call("nvim_win_is_valid", [winid]);
  }
  async findEditorWindow() {
    const uiWindowIds = new Set(
      [...this.views.values()].map((view) => view.tree.windowId).filter((winid) => winid != null)
    );
    for (const surface of this.surfaces.values()) {
      if (surface.activityBar?.winid)
        uiWindowIds.add(surface.activityBar.winid);
    }
    const currentWindowId = await import_coc.workspace.nvim.call("win_getid");
    if (!uiWindowIds.has(currentWindowId)) return currentWindowId;
    if (this.editorWindowId) {
      const valid = await import_coc.workspace.nvim.call("nvim_win_is_valid", [
        this.editorWindowId
      ]);
      if (valid) return this.editorWindowId;
    }
    const windowIds = await import_coc.workspace.nvim.call("nvim_list_wins");
    return windowIds.find((winid) => !uiWindowIds.has(winid));
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
    return `${position === "left" ? "leftabove" : "rightbelow"} ${width}vsplit`;
  }
  stackSplitCommand(location) {
    return location === "panel" ? "rightbelow vsplit" : "belowright split";
  }
  async layoutContainer(id) {
    const container = this.requireContainer(id);
    const entries = [];
    for (const view of this.containerViews(container)) {
      if (view.visibility === "hidden" || !view.tree.windowId) continue;
      if (await this.isValidWindow(view.tree.windowId)) {
        entries.push([view, view.tree.windowId]);
      }
    }
    if (!entries.length) return;
    const config = import_coc.workspace.getConfiguration("coc-ui");
    if (container.location === "panel") {
      const height = Math.max(3, config.get("panel.height", 12));
      for (const [, winid] of entries) {
        await import_coc.workspace.nvim.call("nvim_win_set_height", [winid, height]);
      }
      const widths = await Promise.all(
        entries.map(
          ([, winid]) => import_coc.workspace.nvim.call("nvim_win_get_width", [winid])
        )
      );
      const totalWidth = widths.reduce((sum, value) => sum + value, 0);
      const expanded2 = entries.filter(
        ([view]) => view.visibility !== "collapsed"
      );
      const collapsed2 = entries.filter(
        ([view]) => view.visibility === "collapsed"
      );
      const collapsedWidth = 12;
      for (const [, winid] of collapsed2) {
        await import_coc.workspace.nvim.call("nvim_win_set_width", [
          winid,
          collapsedWidth
        ]);
      }
      if (expanded2.length) {
        const width2 = Math.max(
          12,
          Math.floor(
            (totalWidth - collapsed2.length * collapsedWidth) / expanded2.length
          )
        );
        for (const [, winid] of expanded2) {
          await import_coc.workspace.nvim.call("nvim_win_set_width", [winid, width2]);
        }
      }
      return;
    }
    const primary = container.location === "primarySidebar";
    const width = Math.max(
      10,
      config.get(
        primary ? "primarySidebar.width" : "secondarySidebar.width",
        40
      )
    );
    for (const [, winid] of entries) {
      await import_coc.workspace.nvim.call("nvim_win_set_width", [winid, width]);
    }
    const heights = await Promise.all(
      entries.map(
        ([, winid]) => import_coc.workspace.nvim.call("nvim_win_get_height", [winid])
      )
    );
    const totalHeight = heights.reduce((sum, height) => sum + height, 0);
    const expanded = entries.filter(
      ([view]) => view.visibility !== "collapsed"
    );
    const collapsed = entries.filter(
      ([view]) => view.visibility === "collapsed"
    );
    for (const [, winid] of collapsed) {
      await import_coc.workspace.nvim.call("nvim_win_set_height", [winid, 1]);
    }
    if (expanded.length) {
      const height = Math.max(
        2,
        Math.floor((totalHeight - collapsed.length) / expanded.length)
      );
      for (const [, winid] of expanded) {
        await import_coc.workspace.nvim.call("nvim_win_set_height", [winid, height]);
      }
    }
  }
  async ensureActivityBar(location) {
    if (location === "panel") return;
    if (!import_coc.workspace.getConfiguration("coc-ui").get("activityBar.enable", true)) {
      return;
    }
    const surface = this.surface(location);
    if (await this.isValidWindow(surface.activityBar?.winid)) {
      await this.renderActivityBar(location);
      return;
    }
    const editorWindowId = await this.findEditorWindow();
    if (!editorWindowId) return;
    await import_coc.workspace.nvim.call("win_gotoid", [editorWindowId]);
    const config = import_coc.workspace.getConfiguration("coc-ui");
    const primary = location === "primarySidebar";
    const position = config.get(
      primary ? "primarySidebar.position" : "secondarySidebar.position",
      primary ? "left" : "right"
    );
    const width = Math.max(2, config.get("activityBar.width", 3));
    await import_coc.workspace.nvim.command(
      `${position === "left" ? "leftabove" : "rightbelow"} ${width}vsplit`
    );
    const winid = await import_coc.workspace.nvim.call("win_getid");
    const bufnr = await import_coc.workspace.nvim.call("nvim_create_buf", [
      false,
      true
    ]);
    await import_coc.workspace.nvim.call("nvim_buf_set_name", [
      bufnr,
      `coc-ui-activitybar://${location}`
    ]);
    await import_coc.workspace.nvim.call("nvim_win_set_buf", [winid, bufnr]);
    await import_coc.workspace.nvim.call("nvim_buf_set_option", [
      bufnr,
      "buftype",
      "nofile"
    ]);
    await import_coc.workspace.nvim.call("nvim_buf_set_option", [
      bufnr,
      "bufhidden",
      "wipe"
    ]);
    await import_coc.workspace.nvim.call("nvim_buf_set_option", [
      bufnr,
      "swapfile",
      false
    ]);
    await import_coc.workspace.nvim.call("nvim_buf_set_option", [
      bufnr,
      "filetype",
      "cocui-activitybar"
    ]);
    for (const [name, value] of [
      ["number", false],
      ["relativenumber", false],
      ["cursorline", true],
      ["wrap", false],
      ["winfixwidth", true],
      ["signcolumn", "no"],
      ["statusline", " "]
    ]) {
      await import_coc.workspace.nvim.call("nvim_win_set_option", [winid, name, value]);
    }
    await import_coc.workspace.nvim.call("nvim_win_set_width", [winid, width]);
    const options = { noremap: true, silent: true, nowait: true };
    const select = `<Cmd>CocCommand coc-ui.selectActivityBar ${location}<CR>`;
    await import_coc.workspace.nvim.call("nvim_buf_set_keymap", [
      bufnr,
      "n",
      "<CR>",
      select,
      options
    ]);
    await import_coc.workspace.nvim.call("nvim_buf_set_keymap", [
      bufnr,
      "n",
      "<LeftRelease>",
      select,
      options
    ]);
    await import_coc.workspace.nvim.call("nvim_buf_set_keymap", [
      bufnr,
      "n",
      "<RightMouse>",
      `<Cmd>CocCommand coc-ui.switch${primary ? "PrimarySidebar" : "SecondarySidebar"}<CR>`,
      options
    ]);
    await import_coc.workspace.nvim.call("nvim_buf_set_keymap", [
      bufnr,
      "n",
      "q",
      `<Cmd>CocCommand coc-ui.hideLocation ${location}<CR>`,
      options
    ]);
    surface.activityBar = { bufnr, winid, containerIds: [] };
    await this.renderActivityBar(location);
  }
  async closeActivityBar(location) {
    const surface = this.surface(location);
    const activityBar = surface.activityBar;
    if (!activityBar) return;
    surface.activityBar = void 0;
    const valid = await import_coc.workspace.nvim.call("nvim_buf_is_valid", [
      activityBar.bufnr
    ]);
    if (valid) {
      await import_coc.workspace.nvim.call("nvim_buf_delete", [
        activityBar.bufnr,
        { force: true }
      ]);
    }
  }
  async renderActivityBar(location) {
    if (location === "panel") return;
    const surface = this.surface(location);
    const activityBar = surface.activityBar;
    if (!activityBar || !await this.isValidWindow(activityBar.winid)) return;
    const width = Math.max(
      2,
      import_coc.workspace.getConfiguration("coc-ui").get("activityBar.width", 3)
    );
    await import_coc.workspace.nvim.call("nvim_win_set_width", [activityBar.winid, width]);
    const containers = [...this.containers.entries()].filter(([, container]) => container.location === location).sort(([, left], [, right]) => left.order - right.order);
    activityBar.containerIds = containers.map(([id]) => id);
    const lines = containers.map(([, container]) => ` ${container.icon}`);
    await import_coc.workspace.nvim.call("nvim_buf_set_option", [
      activityBar.bufnr,
      "modifiable",
      true
    ]);
    await import_coc.workspace.nvim.call("nvim_buf_set_lines", [
      activityBar.bufnr,
      0,
      -1,
      false,
      lines.length ? lines : [""]
    ]);
    await import_coc.workspace.nvim.call("nvim_buf_set_option", [
      activityBar.bufnr,
      "modifiable",
      false
    ]);
    await import_coc.workspace.nvim.call("nvim_buf_clear_namespace", [
      activityBar.bufnr,
      -1,
      0,
      -1
    ]);
    const activeLine = activityBar.containerIds.indexOf(
      surface.activeContainerId ?? ""
    );
    if (activeLine >= 0) {
      await import_coc.workspace.nvim.call("nvim_buf_add_highlight", [
        activityBar.bufnr,
        -1,
        "CocUiActivityBarActive",
        activeLine,
        0,
        -1
      ]);
    }
  }
  async installViewKeymaps(viewId, containerId, windowId) {
    if (!windowId) return;
    const bufferId = await import_coc.workspace.nvim.call("nvim_win_get_buf", [
      windowId
    ]);
    const location = this.requireContainer(containerId).location;
    const rhs = `<Cmd>CocCommand coc-ui.hideLocation ${location}<CR>`;
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
      "za",
      `<Cmd>CocCommand coc-ui.toggleView ${viewId}<CR>`,
      options
    ]);
    await import_coc.workspace.nvim.call("nvim_buf_set_keymap", [
      bufferId,
      "n",
      "<2-LeftMouse>",
      `<Cmd>CocCommand coc-ui.toggleViewAtMouse ${viewId}<CR>`,
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
function withViewActions(provider, actions) {
  if (!actions.length) return provider;
  return {
    onDidChangeTreeData: provider.onDidChangeTreeData,
    getTreeItem: (element) => provider.getTreeItem(element),
    getChildren: (element) => provider.getChildren(element),
    getParent: provider.getParent ? (element) => provider.getParent?.(element) : void 0,
    resolveTreeItem: provider.resolveTreeItem ? (item, element, token) => provider.resolveTreeItem?.(item, element, token) : void 0,
    resolveActions: async (item, element) => {
      const inherited = provider.resolveActions ? await provider.resolveActions(item, element) ?? [] : [];
      const contributed = actions.filter((action) => !action.when || action.when(element)).map((action) => ({
        title: action.title,
        handler: action.handler
      }));
      return [...inherited, ...contributed];
    }
  };
}
async function activate(context) {
  const ui = new CocUi(context);
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
    import_coc.commands.registerCommand("coc-ui.closeLocation", (location) => {
      return ui.closeLocation(String(location));
    }),
    import_coc.commands.registerCommand("coc-ui.showLocation", (location) => {
      return ui.showLocation(String(location));
    }),
    import_coc.commands.registerCommand("coc-ui.hideLocation", (location) => {
      return ui.hideLocation(String(location));
    }),
    import_coc.commands.registerCommand("coc-ui.toggleLocation", (location) => {
      return ui.toggleLocation(String(location));
    }),
    import_coc.commands.registerCommand("coc-ui.togglePrimarySidebar", () => {
      return ui.toggleLocation("primarySidebar");
    }),
    import_coc.commands.registerCommand("coc-ui.toggleSecondarySidebar", () => {
      return ui.toggleLocation("secondarySidebar");
    }),
    import_coc.commands.registerCommand("coc-ui.togglePanel", () => {
      return ui.toggleLocation("panel");
    }),
    import_coc.commands.registerCommand("coc-ui.toggleView", (id) => {
      return ui.toggleView(String(id));
    }),
    import_coc.commands.registerCommand("coc-ui.toggleViewAtMouse", (id) => {
      return ui.toggleViewAtMouse(String(id));
    }),
    import_coc.commands.registerCommand(
      "coc-ui.selectActivityBar",
      (location) => {
        return ui.selectActivityBar(String(location));
      }
    ),
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
  await import_coc.workspace.nvim.command(
    "highlight default link CocUiActivityBarActive CursorLine"
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
