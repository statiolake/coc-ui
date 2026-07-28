import { createReadStream } from "node:fs";
import { open, stat } from "node:fs/promises";
import * as path from "node:path";
import { createInterface } from "node:readline";

/** Hard cap on bytes read from a preview candidate. */
export const PREVIEW_MAX_BYTES = 512 * 1024;
/** Hard cap on lines retained for the preview buffer. */
export const PREVIEW_MAX_LINES = 400;

export type PreviewContent =
  | {
      kind: "text";
      lines: string[];
      truncated: boolean;
      /** 1-based source line represented by lines[0]. */
      startLine: number;
      /** 1-based line within `lines` to focus, when the target was found. */
      focusLine?: number;
      filetype?: string;
    }
  | { kind: "binary" }
  | { kind: "unavailable"; reason: string };

export type PreviewReadOptions = {
  maxBytes?: number;
  maxLines?: number;
  cancellation?: PreviewReadCancellation;
  /** 1-based source line around which the retained window is centered. */
  targetLine?: number;
  /** Exact, then partial, line match around which the window is centered. */
  matchLine?: string;
};

export type PreviewReadCancellation = {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => void): { dispose(): void };
};

const EXT_TO_FILETYPE: Record<string, string> = {
  c: "c",
  cc: "cpp",
  cpp: "cpp",
  css: "css",
  go: "go",
  h: "c",
  hpp: "cpp",
  html: "html",
  java: "java",
  js: "javascript",
  json: "json",
  jsx: "javascriptreact",
  lua: "lua",
  md: "markdown",
  mjs: "javascript",
  py: "python",
  rb: "ruby",
  rs: "rust",
  scss: "scss",
  sh: "sh",
  ts: "typescript",
  tsx: "typescriptreact",
  vim: "vim",
  yaml: "yaml",
  yml: "yaml",
  zig: "zig",
};

/** Best-effort filetype from path extension (no buffer load). */
export function guessFiletype(filePath: string): string | undefined {
  const ext = path.extname(filePath).toLowerCase().replace(/^\./, "");
  return EXT_TO_FILETYPE[ext];
}

export function isBinaryBuffer(buffer: Buffer): boolean {
  return buffer.includes(0);
}

/**
 * Split text into preview lines, honoring PREVIEW_MAX_LINES.
 * A trailing empty segment from a final newline is dropped so the buffer
 * matches typical editor line counts.
 */
export function splitPreviewLines(text: string): {
  lines: string[];
  truncated: boolean;
} {
  const raw = text.split(/\r?\n/);
  if (raw.length > 0 && raw[raw.length - 1] === "") raw.pop();
  if (raw.length <= PREVIEW_MAX_LINES) {
    return { lines: raw.length ? raw : [""], truncated: false };
  }
  return {
    lines: raw.slice(0, PREVIEW_MAX_LINES),
    truncated: true,
  };
}

/**
 * Read a local file for picker preview without loading it wholesale. Plain
 * previews retain the bounded head; focused previews stream until their target
 * and retain only the surrounding line window. Detects NUL/binary content.
 */
export async function readPreviewContent(
  filePath: string,
  options: PreviewReadOptions = {},
): Promise<PreviewContent> {
  const maxBytes = options.maxBytes ?? PREVIEW_MAX_BYTES;
  const maxLines = Math.max(1, options.maxLines ?? PREVIEW_MAX_LINES);
  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      return { kind: "unavailable", reason: "Not a regular file" };
    }
    if (options.targetLine != null || options.matchLine) {
      return await readFocusedPreviewContent(filePath, {
        maxLines,
        cancellation: options.cancellation,
        targetLine: options.targetLine,
        matchLine: options.matchLine,
      });
    }
    const toRead = Math.min(info.size, maxBytes);
    if (toRead === 0) {
      return {
        kind: "text",
        lines: [""],
        truncated: false,
        startLine: 1,
        filetype: guessFiletype(filePath),
      };
    }
    const handle = await open(filePath, "r");
    try {
      const buffer = Buffer.alloc(toRead);
      const { bytesRead } = await handle.read(buffer, 0, toRead, 0);
      const slice = buffer.subarray(0, bytesRead);
      if (isBinaryBuffer(slice)) return { kind: "binary" };
      const text = slice.toString("utf8");
      let { lines, truncated } = splitPreviewLines(text);
      if (info.size > maxBytes) truncated = true;
      if (lines.length > maxLines) {
        lines = lines.slice(0, maxLines);
        truncated = true;
      }
      return {
        kind: "text",
        lines,
        truncated,
        startLine: 1,
        filetype: guessFiletype(filePath),
      };
    } finally {
      await handle.close();
    }
  } catch {
    return { kind: "unavailable", reason: "Preview unavailable" };
  }
}

type FocusedReadOptions = {
  maxLines: number;
  cancellation?: PreviewReadCancellation;
  targetLine?: number;
  matchLine?: string;
};

type RetainedWindow = {
  lines: string[];
  startLine: number;
  focusLine: number;
  endLine: number;
};

/**
 * Scan a file without retaining it wholesale and keep only a bounded window
 * around a requested source line. This deliberately has no total-byte cap:
 * the scan may reach the end of a large file, while memory stays bounded by
 * maxLines (apart from Node's current decoded line).
 */
async function readFocusedPreviewContent(
  filePath: string,
  options: FocusedReadOptions,
): Promise<PreviewContent> {
  const beforeCount = Math.floor((options.maxLines - 1) / 2);
  const stream = createReadStream(filePath, { encoding: "utf8" });
  const reader = createInterface({ input: stream, crlfDelay: Infinity });
  const abort = (): void => {
    stream.destroy();
  };
  const cancellation = options.cancellation?.isCancellationRequested
    ? undefined
    : options.cancellation?.onCancellationRequested(abort);
  if (options.cancellation?.isCancellationRequested) abort();
  const before: string[] = [];
  const head: string[] = [];
  let lineNumber = 0;
  let exact: RetainedWindow | undefined;
  let partial: RetainedWindow | undefined;
  let reachedEof = true;

  try {
    for await (const line of reader) {
      lineNumber++;
      if (line.includes("\0")) {
        return { kind: "binary" };
      }
      if (
        options.targetLine == null &&
        !partial &&
        !exact &&
        head.length < options.maxLines
      ) {
        head.push(line);
      }

      if (exact) {
        if (exact.lines.length < options.maxLines) {
          exact.lines.push(line);
          exact.endLine = lineNumber;
          continue;
        }
        reachedEof = false;
        break;
      }

      if (partial && partial.lines.length < options.maxLines) {
        partial.lines.push(line);
        partial.endLine = lineNumber;
      }

      const targetMatches =
        options.targetLine != null &&
        lineNumber === Math.max(1, Math.floor(options.targetLine));
      const exactMatches =
        options.matchLine != null && line === options.matchLine;
      const partialMatches =
        options.matchLine != null &&
        options.matchLine.length > 0 &&
        line.includes(options.matchLine);

      if (targetMatches || exactMatches) {
        exact = makeRetainedWindow(before, line, lineNumber);
        head.length = 0;
      } else if (!partial && partialMatches) {
        partial = makeRetainedWindow(before, line, lineNumber);
        head.length = 0;
      }

      before.push(line);
      if (before.length > beforeCount) before.shift();
    }
  } finally {
    cancellation?.dispose();
    reader.close();
    stream.destroy();
  }

  const retained = exact ?? partial;
  if (retained) {
    return {
      kind: "text",
      lines: retained.lines,
      startLine: retained.startLine,
      focusLine: retained.focusLine,
      truncated: retained.startLine > 1 || !reachedEof || retained.endLine < lineNumber,
      filetype: guessFiletype(filePath),
    };
  }

  const fallback = head.length ? head : before;
  return {
    kind: "text",
    lines: fallback.length ? fallback : [""],
    startLine: fallback.length ? lineNumber - fallback.length + 1 : 1,
    truncated: lineNumber > fallback.length,
    filetype: guessFiletype(filePath),
  };
}

function makeRetainedWindow(
  before: readonly string[],
  line: string,
  lineNumber: number,
): RetainedWindow {
  return {
    lines: [...before, line],
    startLine: lineNumber - before.length,
    focusLine: before.length + 1,
    endLine: lineNumber,
  };
}

export function previewStatusLines(content: PreviewContent): string[] {
  if (content.kind === "binary") {
    return ["Binary file — preview unavailable"];
  }
  if (content.kind === "unavailable") {
    return [content.reason];
  }
  return content.lines;
}

/**
 * Filetype option for the reusable preview buffer.
 * Always returns a string so callers can clear a previous filetype when
 * switching to an unknown extension, binary status pane, or unavailable
 * content.
 */
export function resolvePreviewFiletype(
  content: PreviewContent,
  detected?: string,
): string {
  if (content.kind !== "text") return "";
  return content.filetype ?? detected ?? "";
}
