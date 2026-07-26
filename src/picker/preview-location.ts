import * as path from "node:path";
import { fileURLToPath } from "node:url";

/** Resolved local-file preview target from a ListItem.location value. */
export type PreviewTarget = {
  path: string;
  /** 1-based line to focus when known from an LSP Location range. */
  line?: number;
  /** Exact/partial line text used by LocationWithLine to locate a focus row. */
  matchLine?: string;
  /** Optional substring to emphasize within the focused line. */
  matchText?: string;
};

type LocationLike = {
  uri: string;
  range: { start: { line: number; character?: number } };
};

type LocationWithLineLike = {
  uri: string;
  line: string;
  text?: string;
};

function isLocationLike(value: unknown): value is LocationLike {
  if (value == null || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.uri !== "string" || candidate.range == null) return false;
  if (typeof candidate.range !== "object") return false;
  const start = (candidate.range as { start?: unknown }).start;
  return (
    start != null &&
    typeof start === "object" &&
    typeof (start as { line?: unknown }).line === "number"
  );
}

function isLocationWithLineLike(value: unknown): value is LocationWithLineLike {
  if (value == null || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.uri === "string" && typeof candidate.line === "string";
}

/**
 * Convert a URI or bare path to a local filesystem path.
 * Rejects non-`file:` schemes. Absolute bare paths and `file:` URIs are
 * returned unchanged (after URI decoding). Relative bare paths resolve against
 * `cwd` when provided so callers avoid the Node extension-host process cwd.
 */
export function uriToLocalPath(
  uriOrPath: string,
  cwd?: string,
): string | undefined {
  if (uriOrPath.startsWith("file:")) {
    try {
      return fileURLToPath(uriOrPath);
    } catch {
      return undefined;
    }
  }
  // Scheme present but not file: (http:, fugitive:, untitled:, …)
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(uriOrPath)) return undefined;
  if (!uriOrPath) return undefined;
  if (path.isAbsolute(uriOrPath)) return uriOrPath;
  if (cwd != null && cwd !== "") return path.resolve(cwd, uriOrPath);
  return uriOrPath;
}

/**
 * Resolve ListItem.location (string URI, LSP Location, or LocationWithLine)
 * into a local file preview target. Does not touch the filesystem.
 * Pass the picker ListContext `cwd` (workspace.cwd) so relative paths resolve
 * against the workspace rather than the extension-host process cwd.
 */
export function resolvePreviewTarget(
  location: unknown,
  cwd?: string,
): PreviewTarget | undefined {
  if (location == null) return undefined;

  if (typeof location === "string") {
    const resolved = uriToLocalPath(location, cwd);
    return resolved ? { path: resolved } : undefined;
  }

  if (isLocationLike(location)) {
    const resolved = uriToLocalPath(location.uri, cwd);
    if (!resolved) return undefined;
    return { path: resolved, line: location.range.start.line + 1 };
  }

  if (isLocationWithLineLike(location)) {
    const resolved = uriToLocalPath(location.uri, cwd);
    if (!resolved) return undefined;
    return {
      path: resolved,
      matchLine: location.line,
      matchText: location.text,
    };
  }

  return undefined;
}

/**
 * Stable identity for a mounted preview: resolved absolute path plus the
 * focus target (line and/or LocationWithLine match fields). Used to skip
 * redundant reads/repaints while a streaming list keeps the same selection.
 */
export function previewIdentity(target: PreviewTarget): string {
  return [
    target.path,
    target.line ?? "",
    target.matchLine ?? "",
    target.matchText ?? "",
  ].join("\0");
}

/** Whether two preview targets describe the same mounted preview identity. */
export function isSamePreviewIdentity(
  a: PreviewTarget,
  b: PreviewTarget,
): boolean {
  return previewIdentity(a) === previewIdentity(b);
}

/** Find a 1-based focus line from LocationWithLine match text within loaded lines. */
export function findMatchLine(
  lines: readonly string[],
  matchLine: string,
): number | undefined {
  if (!matchLine) return undefined;
  const exact = lines.findIndex((line) => line === matchLine);
  if (exact >= 0) return exact + 1;
  const partial = lines.findIndex((line) => line.includes(matchLine));
  return partial >= 0 ? partial + 1 : undefined;
}
