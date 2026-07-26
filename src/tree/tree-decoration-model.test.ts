import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CollapsibleState,
  disclosureMarkerFor,
  isCollapsible,
  planTreeDecorations,
  TREE_DISCLOSURE_HL,
  TREE_INDENT_GUIDE_HL,
  TreeDecorationSettings,
} from "./tree-decoration-model";

const settings: TreeDecorationSettings = {
  indentGuidesEnabled: true,
  indentGuideCharacter: "│",
  disclosureCollapsed: ">",
  disclosureExpanded: "v",
};

describe("tree-decoration-model", () => {
  it("treats collapsed and expanded as collapsible", () => {
    assert.equal(isCollapsible(CollapsibleState.None), false);
    assert.equal(isCollapsible(CollapsibleState.Collapsed), true);
    assert.equal(isCollapsible(CollapsibleState.Expanded), true);
  });

  it("picks disclosure markers from collapsible state", () => {
    assert.equal(
      disclosureMarkerFor(CollapsibleState.Collapsed, settings),
      ">",
    );
    assert.equal(
      disclosureMarkerFor(CollapsibleState.Expanded, settings),
      "v",
    );
    assert.equal(
      disclosureMarkerFor(CollapsibleState.None, settings),
      undefined,
    );
  });

  it("plans indent guides using the supplied indent width", () => {
    const marks = planTreeDecorations(
      [
        { level: 0, collapsibleState: CollapsibleState.Expanded },
        { level: 1, collapsibleState: CollapsibleState.None },
        { level: 2, collapsibleState: CollapsibleState.Collapsed },
      ],
      1,
      settings,
      false,
      2,
    );

    assert.deepEqual(
      marks.filter((mark) => mark.hlGroup === TREE_INDENT_GUIDE_HL),
      [
        { line: 2, col: 0, text: "│", hlGroup: TREE_INDENT_GUIDE_HL },
        { line: 3, col: 0, text: "│", hlGroup: TREE_INDENT_GUIDE_HL },
        { line: 3, col: 2, text: "│", hlGroup: TREE_INDENT_GUIDE_HL },
      ],
    );
  });

  it("honors a configurable indent width", () => {
    const marks = planTreeDecorations(
      [
        { level: 1, collapsibleState: CollapsibleState.Collapsed },
        { level: 2, collapsibleState: CollapsibleState.None },
      ],
      0,
      settings,
      false,
      4,
    );

    assert.deepEqual(marks, [
      { line: 0, col: 0, text: "│", hlGroup: TREE_INDENT_GUIDE_HL },
      { line: 0, col: 4, text: ">", hlGroup: TREE_DISCLOSURE_HL },
      { line: 1, col: 0, text: "│", hlGroup: TREE_INDENT_GUIDE_HL },
      { line: 1, col: 4, text: "│", hlGroup: TREE_INDENT_GUIDE_HL },
    ]);
  });

  it("plans disclosure overlays for collapsible rows only", () => {
    const marks = planTreeDecorations(
      [
        { level: 0, collapsibleState: CollapsibleState.Expanded },
        { level: 1, collapsibleState: CollapsibleState.None },
        { level: 1, collapsibleState: CollapsibleState.Collapsed },
      ],
      0,
      { ...settings, indentGuidesEnabled: false },
      false,
      2,
    );

    assert.deepEqual(marks, [
      { line: 0, col: 0, text: "v", hlGroup: TREE_DISCLOSURE_HL },
      { line: 2, col: 2, text: ">", hlGroup: TREE_DISCLOSURE_HL },
    ]);
  });

  it("skips disclosure markers while the native tree is filtering", () => {
    const marks = planTreeDecorations(
      [{ level: 0, collapsibleState: CollapsibleState.Collapsed }],
      0,
      { ...settings, indentGuidesEnabled: false },
      true,
      2,
    );
    assert.deepEqual(marks, []);
  });

  it("omits indent guides when disabled", () => {
    const marks = planTreeDecorations(
      [{ level: 2, collapsibleState: CollapsibleState.None }],
      0,
      { ...settings, indentGuidesEnabled: false },
      false,
      2,
    );
    assert.deepEqual(marks, []);
  });
});
