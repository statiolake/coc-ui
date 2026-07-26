import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TreeView } from "coc.nvim";
import {
  getNativeTreeDecorationSnapshot,
  NATIVE_TREE_INDENT_COLUMNS,
  onNativeTreeDidRender,
} from "./native-tree-view";
import { CollapsibleState } from "./tree-decoration-model";

function asTree(value: unknown): TreeView<unknown> {
  return value as TreeView<unknown>;
}

describe("native-tree-view adapter", () => {
  it("returns undefined when renderedItems is absent", () => {
    assert.equal(getNativeTreeDecorationSnapshot(asTree({})), undefined);
  });

  it("returns undefined when renderedItems is not an array", () => {
    assert.equal(
      getNativeTreeDecorationSnapshot(asTree({ renderedItems: null })),
      undefined,
    );
  });

  it("builds a snapshot from nodesMap, startLnum, and filtering", () => {
    const root = { id: "root" };
    const child = { id: "child" };
    const nodesMap = new Map([
      [root, { item: { collapsibleState: CollapsibleState.Expanded } }],
      [child, { item: { collapsibleState: CollapsibleState.Collapsed } }],
    ]);

    assert.deepEqual(
      getNativeTreeDecorationSnapshot(
        asTree({
          renderedItems: [
            { level: 0, node: root },
            { level: 1, node: child },
          ],
          nodesMap,
          startLnum: 2,
          filtering: true,
        }),
      ),
      {
        startLnum: 2,
        filtering: true,
        indentColumns: NATIVE_TREE_INDENT_COLUMNS,
        entries: [
          { level: 0, collapsibleState: CollapsibleState.Expanded },
          { level: 1, collapsibleState: CollapsibleState.Collapsed },
        ],
      },
    );
  });

  it("falls back to None and startLnum 0 when node state is missing", () => {
    const node = { id: "orphan" };
    assert.deepEqual(
      getNativeTreeDecorationSnapshot(
        asTree({
          renderedItems: [{ level: 3, node }],
          nodesMap: new Map(),
        }),
      ),
      {
        startLnum: 0,
        filtering: false,
        indentColumns: NATIVE_TREE_INDENT_COLUMNS,
        entries: [{ level: 3, collapsibleState: CollapsibleState.None }],
      },
    );
  });

  it("subscribes to onDidRefrash when present", () => {
    let called = 0;
    const listeners: Array<() => void> = [];
    const dispose = onNativeTreeDidRender(
      asTree({
        onDidRefrash: (listener: () => void) => {
          listeners.push(listener);
          return { dispose() {} };
        },
      }),
      () => {
        called += 1;
      },
    );

    assert.ok(dispose);
    listeners[0]();
    assert.equal(called, 1);
  });

  it("returns undefined from onNativeTreeDidRender without onDidRefrash", () => {
    assert.equal(onNativeTreeDidRender(asTree({}), () => {}), undefined);
  });
});
