import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TreeDataProvider } from "coc.nvim";
import { toNativeTreeViewOptions } from "./tree-view-options";

const provider = {} as TreeDataProvider<unknown>;

describe("toNativeTreeViewOptions", () => {
  it("always disables leaf indent for the common column layout", () => {
    const native = toNativeTreeViewOptions({
      treeDataProvider: provider,
      enableFilter: true,
    });
    assert.equal(native.disableLeafIndent, true);
    assert.equal(native.enableFilter, true);
    assert.equal(native.treeDataProvider, provider);
  });

  it("defaults bufhidden to hide and preserves an explicit value", () => {
    assert.equal(
      toNativeTreeViewOptions({ treeDataProvider: provider }).bufhidden,
      "hide",
    );
    assert.equal(
      toNativeTreeViewOptions({
        treeDataProvider: provider,
        bufhidden: "wipe",
      }).bufhidden,
      "wipe",
    );
  });

  it("preserves remaining native options", () => {
    const native = toNativeTreeViewOptions({
      treeDataProvider: provider,
      winfixwidth: false,
      canSelectMany: true,
    });
    assert.equal(native.winfixwidth, false);
    assert.equal(native.canSelectMany, true);
    assert.equal(native.disableLeafIndent, true);
  });
});
