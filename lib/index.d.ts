import { Disposable, ExtensionContext, TreeView, TreeViewOptions } from "coc.nvim";
/**
 * Mirrors VS Code's workbench surfaces. A container occupies one surface and
 * switches between the views registered to it.
 */
export type ViewLocation = "primarySidebar" | "secondarySidebar" | "panel";
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
    location?: ViewLocation;
    order?: number;
}
export interface ViewRegistration<T> extends TreeViewOptions<T> {
    id: string;
    containerId: string;
    title?: string;
    description?: string;
    order?: number;
}
export interface ShowViewOptions {
    focus?: boolean;
}
export interface CocUiApi {
    registerViewContainer(registration: ViewContainerRegistration): Disposable;
    createTreeView<T>(registration: ViewRegistration<T>): TreeView<T>;
    showContainer(id: string, options?: ShowViewOptions): Promise<void>;
    switchLocation(location: ViewLocation): Promise<void>;
    showView(id: string, options?: ShowViewOptions): Promise<void>;
    closeContainer(id: string): Promise<void>;
    toggleTreeItem(id: string): Promise<void>;
    openLocation(uri: string, line: number, character: number): Promise<void>;
}
export declare function activate(context: ExtensionContext): Promise<CocUiApi>;
