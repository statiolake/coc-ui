import type { Event, TreeItem, TreeView } from "coc.nvim";
import {
  CollapsibleState,
  type DecoratableTreeEntry,
} from "./tree-decoration-model";

/**
 * Non-public coc.nvim TreeView surface used for post-render decoration.
 * These fields exist on BasicTreeView but are omitted from the public
 * TreeView typings; keep all reads behind this adapter.
 */
type NativeRenderedItem<T> = {
  readonly level: number;
  readonly node: T;
};

type NativeNodeRecord = {
  readonly item?: TreeItem;
};

type NativeTreeViewSurface<T> = TreeView<T> & {
  readonly onDidRefrash?: Event<void>;
  readonly filtering?: boolean;
  readonly startLnum?: number;
  readonly renderedItems?: ReadonlyArray<NativeRenderedItem<T>>;
  readonly nodesMap?: ReadonlyMap<T, NativeNodeRecord>;
};

/**
 * Columns of leading indent coc.nvim writes per tree level
 * (`"  ".repeat(level)` in current BasicTreeView).
 */
export const NATIVE_TREE_INDENT_COLUMNS = 2;

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

function collapsibleStateOf(item: TreeItem | undefined): CollapsibleState {
  const state = item?.collapsibleState;
  if (state === CollapsibleState.Expanded) return CollapsibleState.Expanded;
  if (state === CollapsibleState.Collapsed) return CollapsibleState.Collapsed;
  return CollapsibleState.None;
}

/**
 * Returns a decoration snapshot from BasicTreeView private state, or
 * `undefined` when the tree does not expose the expected native fields.
 */
export function getNativeTreeDecorationSnapshot<T>(
  tree: TreeView<T>,
): NativeTreeDecorationSnapshot | undefined {
  const surface = tree as NativeTreeViewSurface<T>;
  if (!Array.isArray(surface.renderedItems)) return undefined;

  const nodesMap = surface.nodesMap;
  const entries: DecoratableTreeEntry[] = surface.renderedItems.map(
    ({ level, node }) => ({
      level,
      collapsibleState: collapsibleStateOf(nodesMap?.get(node)?.item),
    }),
  );

  return {
    startLnum:
      typeof surface.startLnum === "number" && surface.startLnum >= 0
        ? surface.startLnum
        : 0,
    filtering: surface.filtering === true,
    indentColumns: NATIVE_TREE_INDENT_COLUMNS,
    entries,
  };
}

export function onNativeTreeDidRender<T>(
  tree: TreeView<T>,
  listener: () => void,
): { dispose(): void } | undefined {
  const event = (tree as NativeTreeViewSurface<T>).onDidRefrash;
  if (!event) return undefined;
  return event(listener);
}
