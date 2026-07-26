import { Disposable, ExtensionContext, TreeView, TreeViewOptions } from "coc.nvim";
/** Mirrors VS Code's workbench surfaces. */
export type ViewLocation = "primarySidebar" | "secondarySidebar" | "panel";
export type ViewVisibility = "visible" | "collapsed" | "hidden";
/**
 * Coc equivalent of VS Code's ViewContainerLocation. The string values are
 * intentionally stable because they are also suitable for configuration.
 */
export declare const ViewContainerLocation: {
    readonly Sidebar: "primarySidebar";
    readonly AuxiliaryBar: "secondarySidebar";
    readonly Panel: "panel";
};
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
/**
 * Options for {@link CocUiApi.createTreeView}. Extends coc.nvim TreeViewOptions
 * except `disableLeafIndent`, which coc-ui always applies internally so
 * same-depth disclosure markers and leaf icons share one column.
 */
export interface CocTreeViewOptions<T> extends Omit<TreeViewOptions<T>, "disableLeafIndent"> {
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
    pickList(name: string, args?: string[]): Promise<void>;
}
export declare function activate(context: ExtensionContext): Promise<CocUiApi>;
