import { open, stat } from "node:fs/promises";
import * as path from "node:path";

/** Hard cap on bytes read from a preview candidate. */
export const PREVIEW_MAX_BYTES = 512 * 1024;
/** Hard cap on lines retained for the preview buffer. */
export const PREVIEW_MAX_LINES = 400;

export type PreviewContent =
  | { kind: "text"; lines: string[]; truncated: boolean; filetype?: string }
  | { kind: "binary" }
  | { kind: "unavailable"; reason: string };

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
 * Boundedly read a local file for picker preview. Never loads the full file
 * when it exceeds PREVIEW_MAX_BYTES. Detects NUL/binary content.
 */
export async function readPreviewContent(
  filePath: string,
  options: { maxBytes?: number; maxLines?: number } = {},
): Promise<PreviewContent> {
  const maxBytes = options.maxBytes ?? PREVIEW_MAX_BYTES;
  const maxLines = options.maxLines ?? PREVIEW_MAX_LINES;
  try {
    const info = await stat(filePath);
    if (!info.isFile()) {
      return { kind: "unavailable", reason: "Not a regular file" };
    }
    const toRead = Math.min(info.size, maxBytes);
    if (toRead === 0) {
      return {
        kind: "text",
        lines: [""],
        truncated: false,
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
        filetype: guessFiletype(filePath),
      };
    } finally {
      await handle.close();
    }
  } catch {
    return { kind: "unavailable", reason: "Preview unavailable" };
  }
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
