/** Default minimum editor columns before a side preview is allowed. */
export const PREVIEW_MIN_COLUMNS = 120;

/** Horizontal editor chrome reserved outside the picker (2 cols each side). */
export const LAYOUT_HORIZONTAL_PADDING = 4;
/** Vertical space reserved for cmdline / status when sizing height. */
export const LAYOUT_VERTICAL_PADDING = 7;
/** Narrow-mode (and list-pane) width ratio of editor columns. */
export const LAYOUT_WIDTH_RATIO = 0.72;
/** Combined list+preview width ratio when preview is shown. */
export const LAYOUT_WIDTH_RATIO_WITH_PREVIEW = 0.88;
export const LAYOUT_HEIGHT_RATIO = 0.55;
export const LAYOUT_MIN_WIDTH = 20;
export const LAYOUT_MIN_HEIGHT = 5;
/** List pane share of the combined content span when previewing. */
export const LAYOUT_LIST_RATIO = 0.4;
export const LAYOUT_MIN_LIST_WIDTH = 24;
export const LAYOUT_MIN_PREVIEW_WIDTH = 30;
/**
 * Content-column gap between list and preview so borders do not overlap.
 * List right border sits at listCol+listWidth; preview content starts at
 * listCol+listWidth+LAYOUT_PREVIEW_GAP (preview left border in between).
 */
export const LAYOUT_PREVIEW_GAP = 2;

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

function clampWidth(columns: number, ratio: number): number {
  return Math.min(
    Math.max(1, columns - LAYOUT_HORIZONTAL_PADDING),
    Math.max(LAYOUT_MIN_WIDTH, Math.floor(columns * ratio)),
  );
}

function clampHeight(lines: number): number {
  return Math.min(
    Math.max(1, lines - LAYOUT_VERTICAL_PADDING),
    Math.max(LAYOUT_MIN_HEIGHT, Math.floor(lines * LAYOUT_HEIGHT_RATIO)),
  );
}

/**
 * Compute centered picker geometry.
 * Narrow / no-preview mode matches the historical single-column picker exactly.
 * Wide preview mode reflows the list left and places a framed preview to its right.
 */
export function computePickerLayout(input: LayoutInput): PickerLayout {
  const minColumns = input.minColumns ?? PREVIEW_MIN_COLUMNS;
  const height = clampHeight(input.lines);
  const row = Math.max(0, Math.floor((input.lines - height - 1) / 3));
  const available = Math.max(1, input.columns - LAYOUT_HORIZONTAL_PADDING);
  const minPreviewSpan =
    LAYOUT_MIN_LIST_WIDTH + LAYOUT_PREVIEW_GAP + LAYOUT_MIN_PREVIEW_WIDTH;

  const allowPreview =
    input.showPreview &&
    input.columns >= minColumns &&
    available >= minPreviewSpan;

  if (!allowPreview) {
    const width = clampWidth(input.columns, LAYOUT_WIDTH_RATIO);
    const col = Math.max(0, Math.floor((input.columns - width) / 2));
    return {
      prompt: { row, col, width, height: 1 },
      results: { row: row + 2, col, width, height },
    };
  }

  const totalWidth = Math.max(
    minPreviewSpan,
    clampWidth(input.columns, LAYOUT_WIDTH_RATIO_WITH_PREVIEW),
  );
  const listWidth = Math.max(
    LAYOUT_MIN_LIST_WIDTH,
    Math.min(
      totalWidth - LAYOUT_PREVIEW_GAP - LAYOUT_MIN_PREVIEW_WIDTH,
      Math.floor(totalWidth * LAYOUT_LIST_RATIO),
    ),
  );
  const previewWidth = totalWidth - listWidth - LAYOUT_PREVIEW_GAP;
  const span = listWidth + LAYOUT_PREVIEW_GAP + previewWidth;
  const col = Math.max(0, Math.floor((input.columns - span) / 2));
  // Single float covering prompt+results visual height (shared separator row).
  const previewHeight = height + 2;

  return {
    prompt: { row, col, width: listWidth, height: 1 },
    results: { row: row + 2, col, width: listWidth, height },
    preview: {
      row,
      col: col + listWidth + LAYOUT_PREVIEW_GAP,
      width: previewWidth,
      height: previewHeight,
    },
  };
}

/** Whether the editor is wide enough for a preview pane under current settings. */
export function canShowPreviewPane(
  columns: number,
  minColumns: number = PREVIEW_MIN_COLUMNS,
): boolean {
  const available = columns - LAYOUT_HORIZONTAL_PADDING;
  const minPreviewSpan =
    LAYOUT_MIN_LIST_WIDTH + LAYOUT_PREVIEW_GAP + LAYOUT_MIN_PREVIEW_WIDTH;
  return columns >= minColumns && available >= minPreviewSpan;
}

function paneGeometryEqual(
  a: PaneGeometry | undefined,
  b: PaneGeometry | undefined,
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return (
    a.row === b.row &&
    a.col === b.col &&
    a.width === b.width &&
    a.height === b.height
  );
}

/** True when prompt/results/preview geometries are identical. */
export function pickerLayoutsEqual(a: PickerLayout, b: PickerLayout): boolean {
  return (
    paneGeometryEqual(a.prompt, b.prompt) &&
    paneGeometryEqual(a.results, b.results) &&
    paneGeometryEqual(a.preview, b.preview)
  );
}
