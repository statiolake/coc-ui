import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, it } from "node:test";
import {
  guessFiletype,
  isBinaryBuffer,
  previewStatusLines,
  readPreviewContent,
  resolvePreviewFiletype,
  splitPreviewLines,
  PREVIEW_MAX_LINES,
} from "./preview-content";
import {
  canShowPreviewPane,
  computePickerLayout,
  pickerLayoutsEqual,
  LAYOUT_HORIZONTAL_PADDING,
  LAYOUT_MIN_LIST_WIDTH,
  LAYOUT_MIN_PREVIEW_WIDTH,
  LAYOUT_PREVIEW_GAP,
  LAYOUT_WIDTH_RATIO,
  PREVIEW_MIN_COLUMNS,
} from "./preview-layout";
import {
  findMatchLine,
  isSamePreviewIdentity,
  previewIdentity,
  resolvePreviewTarget,
  uriToLocalPath,
} from "./preview-location";

describe("preview-location", () => {
  it("accepts bare paths and file URIs", () => {
    assert.equal(uriToLocalPath("/tmp/a.ts"), "/tmp/a.ts");
    assert.equal(
      uriToLocalPath(pathToFileURL("/tmp/a.ts").href),
      path.resolve("/tmp/a.ts"),
    );
  });

  it("rejects non-file schemes", () => {
    assert.equal(uriToLocalPath("http://example.com/a.ts"), undefined);
    assert.equal(uriToLocalPath("fugitive://repo/file"), undefined);
    assert.equal(uriToLocalPath("untitled:foo"), undefined);
  });

  it("resolves relative bare paths against workspace cwd", () => {
    const cwd = "/workspace/project";
    assert.equal(uriToLocalPath("src/a.ts", cwd), path.resolve(cwd, "src/a.ts"));
    assert.equal(
      uriToLocalPath("./src/a.ts", cwd),
      path.resolve(cwd, "./src/a.ts"),
    );
    assert.equal(
      uriToLocalPath("../sibling/b.ts", cwd),
      path.resolve(cwd, "../sibling/b.ts"),
    );
    // Absolute and file: URIs stay absolute regardless of cwd.
    assert.equal(uriToLocalPath("/tmp/a.ts", cwd), "/tmp/a.ts");
    assert.equal(
      uriToLocalPath(pathToFileURL("/tmp/a.ts").href, cwd),
      path.resolve("/tmp/a.ts"),
    );
  });

  it("leaves relative paths unchanged when cwd is omitted", () => {
    assert.equal(uriToLocalPath("src/a.ts"), "src/a.ts");
  });

  it("resolves string, Location, and LocationWithLine", () => {
    assert.deepEqual(resolvePreviewTarget("/tmp/x.ts"), { path: "/tmp/x.ts" });
    assert.deepEqual(
      resolvePreviewTarget({
        uri: pathToFileURL("/tmp/x.ts").href,
        range: { start: { line: 3, character: 1 }, end: { line: 3, character: 5 } },
      }),
      { path: path.resolve("/tmp/x.ts"), line: 4 },
    );
    assert.deepEqual(
      resolvePreviewTarget({
        uri: "/tmp/x.ts",
        line: "const x = 1",
        text: "x",
      }),
      { path: "/tmp/x.ts", matchLine: "const x = 1", matchText: "x" },
    );
  });

  it("resolves relative Location paths against cwd", () => {
    const cwd = "/ws";
    assert.deepEqual(resolvePreviewTarget("lib/x.ts", cwd), {
      path: path.resolve(cwd, "lib/x.ts"),
    });
    assert.deepEqual(
      resolvePreviewTarget(
        {
          uri: "lib/x.ts",
          range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } },
        },
        cwd,
      ),
      { path: path.resolve(cwd, "lib/x.ts"), line: 2 },
    );
    assert.deepEqual(
      resolvePreviewTarget(
        { uri: "lib/x.ts", line: "foo", text: "f" },
        cwd,
      ),
      {
        path: path.resolve(cwd, "lib/x.ts"),
        matchLine: "foo",
        matchText: "f",
      },
    );
  });

  it("ignores missing location and unknown shapes", () => {
    assert.equal(resolvePreviewTarget(undefined), undefined);
    assert.equal(resolvePreviewTarget(null), undefined);
    assert.equal(resolvePreviewTarget({ uri: "file:///tmp/x" }), undefined);
  });

  it("finds LocationWithLine matches", () => {
    const lines = ["one", "const x = 1", "two"];
    assert.equal(findMatchLine(lines, "const x = 1"), 2);
    assert.equal(findMatchLine(lines, "x = 1"), 2);
    assert.equal(findMatchLine(lines, "missing"), undefined);
  });

  it("builds a stable preview identity from path and focus", () => {
    const base = { path: "/tmp/a.ts" };
    const withLine = { path: "/tmp/a.ts", line: 4 };
    const withMatch = {
      path: "/tmp/a.ts",
      matchLine: "const x = 1",
      matchText: "x",
    };
    assert.equal(previewIdentity(base), previewIdentity({ path: "/tmp/a.ts" }));
    assert.equal(isSamePreviewIdentity(base, { path: "/tmp/a.ts" }), true);
    assert.equal(isSamePreviewIdentity(base, withLine), false);
    assert.equal(isSamePreviewIdentity(withLine, { path: "/tmp/a.ts", line: 4 }), true);
    assert.equal(isSamePreviewIdentity(withLine, { path: "/tmp/a.ts", line: 5 }), false);
    assert.equal(isSamePreviewIdentity(withMatch, {
      path: "/tmp/a.ts",
      matchLine: "const x = 1",
      matchText: "x",
    }), true);
    assert.equal(isSamePreviewIdentity(withMatch, {
      path: "/tmp/a.ts",
      matchLine: "const x = 1",
      matchText: "y",
    }), false);
    assert.equal(isSamePreviewIdentity(base, { path: "/tmp/b.ts" }), false);
  });
});

describe("preview-layout", () => {
  it("preserves historical narrow geometry exactly", () => {
    const columns = 80;
    const lines = 40;
    const layout = computePickerLayout({
      columns,
      lines,
      showPreview: false,
    });
    const width = Math.min(
      Math.max(1, columns - 4),
      Math.max(20, Math.floor(columns * LAYOUT_WIDTH_RATIO)),
    );
    const height = Math.min(
      Math.max(1, lines - 7),
      Math.max(5, Math.floor(lines * 0.55)),
    );
    const col = Math.max(0, Math.floor((columns - width) / 2));
    const row = Math.max(0, Math.floor((lines - height - 1) / 3));
    assert.deepEqual(layout.prompt, { row, col, width, height: 1 });
    assert.deepEqual(layout.results, { row: row + 2, col, width, height });
    assert.equal(layout.preview, undefined);
  });

  it("does not create preview below the column threshold", () => {
    const layout = computePickerLayout({
      columns: PREVIEW_MIN_COLUMNS - 1,
      lines: 50,
      showPreview: true,
    });
    assert.equal(layout.preview, undefined);
    assert.equal(canShowPreviewPane(PREVIEW_MIN_COLUMNS - 1), false);
    assert.equal(canShowPreviewPane(PREVIEW_MIN_COLUMNS), true);
  });

  it("reflows to a left list and right preview when wide", () => {
    const layout = computePickerLayout({
      columns: 160,
      lines: 50,
      showPreview: true,
    });
    assert.ok(layout.preview);
    assert.equal(layout.prompt.col, layout.results.col);
    assert.equal(layout.prompt.width, layout.results.width);
    assert.equal(
      layout.preview!.col,
      layout.prompt.col + layout.prompt.width + LAYOUT_PREVIEW_GAP,
    );
    assert.equal(layout.preview!.row, layout.prompt.row);
    assert.equal(layout.preview!.height, layout.results.height + 2);
    const span =
      layout.prompt.width + LAYOUT_PREVIEW_GAP + layout.preview!.width;
    assert.ok(layout.prompt.col + span <= 160);
  });

  it("falls back when available width cannot fit both panes", () => {
    const minSpan =
      LAYOUT_MIN_LIST_WIDTH + LAYOUT_PREVIEW_GAP + LAYOUT_MIN_PREVIEW_WIDTH;
    const columns = minSpan + LAYOUT_HORIZONTAL_PADDING - 1;
    assert.equal(canShowPreviewPane(columns, columns), false);
    const layout = computePickerLayout({
      columns,
      lines: 40,
      showPreview: true,
      minColumns: columns,
    });
    assert.equal(layout.preview, undefined);
  });

  it("compares layouts for preview dedup reflow decisions", () => {
    const a = computePickerLayout({
      columns: 160,
      lines: 50,
      showPreview: true,
    });
    const b = computePickerLayout({
      columns: 160,
      lines: 50,
      showPreview: true,
    });
    const c = computePickerLayout({
      columns: 180,
      lines: 50,
      showPreview: true,
    });
    assert.equal(pickerLayoutsEqual(a, b), true);
    assert.equal(pickerLayoutsEqual(a, c), false);
  });
});

describe("preview-content", () => {
  it("detects binary NUL content and guesses filetype", () => {
    assert.equal(isBinaryBuffer(Buffer.from("hello")), false);
    assert.equal(isBinaryBuffer(Buffer.from([1, 0, 2])), true);
    assert.equal(guessFiletype("/x/y.ts"), "typescript");
    assert.equal(guessFiletype("/x/y.unknown"), undefined);
  });

  it("always resolves a filetype option so prior ft can be cleared", () => {
    assert.equal(
      resolvePreviewFiletype({
        kind: "text",
        lines: ["x"],
        truncated: false,
        filetype: "typescript",
      }),
      "typescript",
    );
    assert.equal(
      resolvePreviewFiletype({
        kind: "text",
        lines: ["x"],
        truncated: false,
      }),
      "",
    );
    assert.equal(
      resolvePreviewFiletype(
        {
          kind: "text",
          lines: ["x"],
          truncated: false,
        },
        "zig",
      ),
      "zig",
    );
    // Binary / unavailable must clear — never leave the previous text filetype.
    assert.equal(resolvePreviewFiletype({ kind: "binary" }), "");
    assert.equal(
      resolvePreviewFiletype({ kind: "unavailable", reason: "Preview unavailable" }),
      "",
    );
  });

  it("splits and caps preview lines", () => {
    const many = Array.from({ length: PREVIEW_MAX_LINES + 5 }, (_, i) => `L${i}`);
    const { lines, truncated } = splitPreviewLines(many.join("\n") + "\n");
    assert.equal(lines.length, PREVIEW_MAX_LINES);
    assert.equal(truncated, true);
    assert.deepEqual(splitPreviewLines("a\nb\n").lines, ["a", "b"]);
  });

  it("reads text files boundedly and rejects directories", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "coc-ui-preview-"));
    try {
      const file = path.join(dir, "sample.ts");
      await writeFile(file, "line1\nline2\n");
      const text = await readPreviewContent(file);
      assert.equal(text.kind, "text");
      if (text.kind === "text") {
        assert.deepEqual(text.lines, ["line1", "line2"]);
        assert.equal(text.filetype, "typescript");
      }

      const nested = path.join(dir, "nested");
      await mkdir(nested);
      const dirResult = await readPreviewContent(nested);
      assert.equal(dirResult.kind, "unavailable");

      const binaryPath = path.join(dir, "blob.bin");
      await writeFile(binaryPath, Buffer.from([0, 1, 2, 3]));
      const binary = await readPreviewContent(binaryPath);
      assert.equal(binary.kind, "binary");
      assert.deepEqual(previewStatusLines(binary), [
        "Binary file — preview unavailable",
      ]);

      const missing = await readPreviewContent(path.join(dir, "nope.ts"));
      assert.equal(missing.kind, "unavailable");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
