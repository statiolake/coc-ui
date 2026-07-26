import type { TreeView } from "coc.nvim";
import { type DecoratableTreeEntry } from "./tree-decoration-model";
/**
 * Columns of leading indent coc.nvim writes per tree level
 * (`"  ".repeat(level)` in current BasicTreeView).
 */
export declare const NATIVE_TREE_INDENT_COLUMNS = 2;
/**
 * Stable, read-only view of whatever BasicTreeView currently has rendered.
 * Collapsible state comes from the TreeItem already held in nodesMap (which
 * BasicTreeView mutates before expand/collapse events), not from re-calling
 * the provider.
 */
export type NativeTreeDecorationSnapshot = {
    readonly startLnum: number;
    readonly filtering: boolean;
    readonly indentColumns: number;
    readonly entries: ReadonlyArray<DecoratableTreeEntry>;
};
/**
 * Returns a decoration snapshot from BasicTreeView private state, or
 * `undefined` when the tree does not expose the expected native fields.
 */
export declare function getNativeTreeDecorationSnapshot<T>(tree: TreeView<T>): NativeTreeDecorationSnapshot | undefined;
export declare function onNativeTreeDidRender<T>(tree: TreeView<T>, listener: () => void): {
    dispose(): void;
} | undefined;
