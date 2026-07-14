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
  activate: () => activate
});
module.exports = __toCommonJS(index_exports);
var import_coc = require("coc.nvim");
var ViewContainer = class {
  views = /* @__PURE__ */ new Map();
  activeViewId;
  targetWindowId;
  registerView(registration) {
    if (this.views.has(registration.id)) {
      throw new Error(`View already registered: ${registration.id}`);
    }
    const tree = import_coc.window.createTreeView(registration.id, registration);
    tree.title = registration.title ?? registration.id;
    tree.description = registration.description;
    this.views.set(registration.id, {
      placement: registration.placement ?? "sidebar",
      tree
    });
    return import_coc.Disposable.create(() => {
      if (this.activeViewId === registration.id) this.activeViewId = void 0;
      this.views.delete(registration.id);
      tree.dispose();
    });
  }
  async showView(id) {
    const view = this.views.get(id);
    if (!view) throw new Error(`Unknown view: ${id}`);
    const currentWindowId = await import_coc.workspace.nvim.call("win_getid");
    const activeWindowId = this.activeViewId ? this.views.get(this.activeViewId)?.tree.windowId : void 0;
    if (currentWindowId !== activeWindowId) this.targetWindowId = currentWindowId;
    if (activeWindowId && activeWindowId !== view.tree.windowId) {
      await import_coc.workspace.nvim.call("nvim_win_close", [activeWindowId, true]);
    }
    await view.tree.show(this.splitCommand(view.placement));
    this.activeViewId = id;
  }
  async closeView() {
    if (!this.activeViewId) return;
    const winid = this.views.get(this.activeViewId)?.tree.windowId;
    if (winid) await import_coc.workspace.nvim.call("nvim_win_close", [winid, true]);
    this.activeViewId = void 0;
  }
  async openLocation(uri, line, character) {
    if (this.targetWindowId) {
      const valid = await import_coc.workspace.nvim.call("nvim_win_is_valid", [this.targetWindowId]);
      if (valid) await import_coc.workspace.nvim.call("win_gotoid", [this.targetWindowId]);
    }
    await import_coc.workspace.jumpTo(uri, import_coc.Position.create(line, character), "edit");
  }
  dispose() {
    for (const view of this.views.values()) view.tree.dispose();
    this.views.clear();
  }
  splitCommand(placement) {
    const config = import_coc.workspace.getConfiguration("coc-ui");
    if (placement === "panel") {
      const height = Math.max(3, config.get("panel.height", 12));
      return `botright ${height}split`;
    }
    const width = Math.max(10, config.get("sidebar.width", 40));
    const side = config.get("sidebar.position", "left");
    return `${side === "left" ? "topleft" : "botright"} ${width}vsplit`;
  }
};
async function activate(context) {
  const container = new ViewContainer();
  context.subscriptions.push(
    container,
    import_coc.commands.registerCommand("coc-ui.show", (id) => container.showView(String(id))),
    import_coc.commands.registerCommand("coc-ui.close", () => container.closeView())
  );
  return container;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  activate
});
//# sourceMappingURL=index.js.map
