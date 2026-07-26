import type { TreeViewOptions } from "coc.nvim";

/**
 * Public createTreeView options exclude coc.nvim's leaf-indent escape hatch.
 * coc-ui owns a single VS Code-compatible column layout for every TreeView.
 */
export type PublicTreeViewOptions<T> = Omit<
  TreeViewOptions<T>,
  "disableLeafIndent"
>;

/**
 * Adapts public TreeView options to native `window.createTreeView` options.
 *
 * Always sets `disableLeafIndent: true` so same-depth collapsible disclosure
 * markers and leaf/file icons share one column. Defaults `bufhidden` to
 * `"hide"` so hiding a surface preserves TreeView buffers.
 */
export function toNativeTreeViewOptions<T>(
  options: PublicTreeViewOptions<T>,
): TreeViewOptions<T> {
  return {
    ...options,
    bufhidden: options.bufhidden ?? "hide",
    disableLeafIndent: true,
  };
}
