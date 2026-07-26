/** Default minimum editor columns before a side preview is allowed. */
export declare const PREVIEW_MIN_COLUMNS = 120;
/** Horizontal editor chrome reserved outside the picker (2 cols each side). */
export declare const LAYOUT_HORIZONTAL_PADDING = 4;
/** Vertical space reserved for cmdline / status when sizing height. */
export declare const LAYOUT_VERTICAL_PADDING = 7;
/** Narrow-mode (and list-pane) width ratio of editor columns. */
export declare const LAYOUT_WIDTH_RATIO = 0.72;
/** Combined list+preview width ratio when preview is shown. */
export declare const LAYOUT_WIDTH_RATIO_WITH_PREVIEW = 0.88;
export declare const LAYOUT_HEIGHT_RATIO = 0.55;
export declare const LAYOUT_MIN_WIDTH = 20;
export declare const LAYOUT_MIN_HEIGHT = 5;
/** List pane share of the combined content span when previewing. */
export declare const LAYOUT_LIST_RATIO = 0.4;
export declare const LAYOUT_MIN_LIST_WIDTH = 24;
export declare const LAYOUT_MIN_PREVIEW_WIDTH = 30;
/**
 * Content-column gap between list and preview so borders do not overlap.
 * List right border sits at listCol+listWidth; preview content starts at
 * listCol+listWidth+LAYOUT_PREVIEW_GAP (preview left border in between).
 */
export declare const LAYOUT_PREVIEW_GAP = 2;
export type PaneGeometry = {
    row: number;
    col: number;
    width: number;
    height: number;
};
export type PickerLayout = {
    prompt: PaneGeometry;
    results: PaneGeometry;
    /** Present only when a side preview pane should be mounted. */
    preview?: PaneGeometry;
};
export type LayoutInput = {
    columns: number;
    lines: number;
    /** True when a selected local file should take a side preview pane. */
    showPreview: boolean;
    /** Column threshold; preview is suppressed below this. */
    minColumns?: number;
};
/**
 * Compute centered picker geometry.
 * Narrow / no-preview mode matches the historical single-column picker exactly.
 * Wide preview mode reflows the list left and places a framed preview to its right.
 */
export declare function computePickerLayout(input: LayoutInput): PickerLayout;
/** Whether the editor is wide enough for a preview pane under current settings. */
export declare function canShowPreviewPane(columns: number, minColumns?: number): boolean;
/** True when prompt/results/preview geometries are identical. */
export declare function pickerLayoutsEqual(a: PickerLayout, b: PickerLayout): boolean;
