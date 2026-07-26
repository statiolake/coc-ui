/**
 * Mirrors coc.nvim TreeItemCollapsibleState values so decoration planning can
 * stay free of a coc.nvim runtime dependency (needed for unit tests).
 */
export declare const CollapsibleState: {
    readonly None: 0;
    readonly Collapsed: 1;
    readonly Expanded: 2;
};
export type CollapsibleState = (typeof CollapsibleState)[keyof typeof CollapsibleState];
export type TreeDecorationSettings = {
    indentGuidesEnabled: boolean;
    indentGuideCharacter: string;
    disclosureCollapsed: string;
    disclosureExpanded: string;
};
export type DecoratableTreeEntry = {
    level: number;
    collapsibleState: CollapsibleState;
};
export type TreeExtmark = {
    /** 0-based buffer line */
    line: number;
    /** 0-based byte column */
    col: number;
    text: string;
    hlGroup: string;
};
export declare const TREE_INDENT_GUIDE_HL = "CocUiTreeIndentGuide";
export declare const TREE_DISCLOSURE_HL = "CocTreeOpenClose";
export declare function isCollapsible(state: CollapsibleState | undefined): boolean;
export declare function disclosureMarkerFor(state: CollapsibleState, settings: TreeDecorationSettings): string | undefined;
/**
 * Pure decoration plan for indent guides and collapsible disclosure markers.
 * `indentColumns` is the renderer-specific width owned by the native adapter.
 */
export declare function planTreeDecorations(entries: readonly DecoratableTreeEntry[], startLine: number, settings: TreeDecorationSettings, filtering: boolean, indentColumns: number): TreeExtmark[];
