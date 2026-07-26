/**
 * Mirrors coc.nvim TreeItemCollapsibleState values so decoration planning can
 * stay free of a coc.nvim runtime dependency (needed for unit tests).
 */
export const CollapsibleState = {
  None: 0,
  Collapsed: 1,
  Expanded: 2,
} as const;

export type CollapsibleState =
  (typeof CollapsibleState)[keyof typeof CollapsibleState];

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

export const TREE_INDENT_GUIDE_HL = "CocUiTreeIndentGuide";
export const TREE_DISCLOSURE_HL = "CocTreeOpenClose";

export function isCollapsible(state: CollapsibleState | undefined): boolean {
  return (
    state === CollapsibleState.Collapsed || state === CollapsibleState.Expanded
  );
}

export function disclosureMarkerFor(
  state: CollapsibleState,
  settings: TreeDecorationSettings,
): string | undefined {
  if (state === CollapsibleState.Expanded) {
    return settings.disclosureExpanded || undefined;
  }
  if (state === CollapsibleState.Collapsed) {
    return settings.disclosureCollapsed || undefined;
  }
  return undefined;
}

/**
 * Pure decoration plan for indent guides and collapsible disclosure markers.
 * `indentColumns` is the renderer-specific width owned by the native adapter.
 */
export function planTreeDecorations(
  entries: readonly DecoratableTreeEntry[],
  startLine: number,
  settings: TreeDecorationSettings,
  filtering: boolean,
  indentColumns: number,
): TreeExtmark[] {
  const marks: TreeExtmark[] = [];
  const guide = settings.indentGuidesEnabled
    ? settings.indentGuideCharacter
    : "";
  const width = Math.max(0, indentColumns);

  for (let index = 0; index < entries.length; index += 1) {
    const { level, collapsibleState } = entries[index];
    const line = startLine + index;

    if (guide) {
      for (let ancestor = 0; ancestor < level; ancestor += 1) {
        marks.push({
          line,
          col: ancestor * width,
          text: guide,
          hlGroup: TREE_INDENT_GUIDE_HL,
        });
      }
    }

    if (filtering || !isCollapsible(collapsibleState)) continue;
    const marker = disclosureMarkerFor(collapsibleState, settings);
    if (!marker) continue;
    marks.push({
      line,
      col: level * width,
      text: marker,
      hlGroup: TREE_DISCLOSURE_HL,
    });
  }

  return marks;
}
