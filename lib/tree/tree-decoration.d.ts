import { Disposable, TreeView } from "coc.nvim";
/**
 * Applies common indent-guide and disclosure decorations to a coc.nvim
 * TreeView buffer. Attached automatically from CocUi.createTreeView.
 */
export declare class TreeViewDecoration implements Disposable {
    private readonly tree;
    private readonly disposables;
    private namespace;
    private timer;
    private revision;
    private disposed;
    constructor(tree: TreeView<unknown>);
    dispose(): void;
    private schedule;
    private render;
    private getNamespace;
}
export declare function attachTreeViewDecoration<T>(tree: TreeView<T>): Disposable;
