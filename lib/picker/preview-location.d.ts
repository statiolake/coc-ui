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
/**
 * Convert a URI or bare path to a local filesystem path.
 * Rejects non-`file:` schemes. Absolute bare paths and `file:` URIs are
 * returned unchanged (after URI decoding). Relative bare paths resolve against
 * `cwd` when provided so callers avoid the Node extension-host process cwd.
 */
export declare function uriToLocalPath(uriOrPath: string, cwd?: string): string | undefined;
/**
 * Resolve ListItem.location (string URI, LSP Location, or LocationWithLine)
 * into a local file preview target. Does not touch the filesystem.
 * Pass the picker ListContext `cwd` (workspace.cwd) so relative paths resolve
 * against the workspace rather than the extension-host process cwd.
 */
export declare function resolvePreviewTarget(location: unknown, cwd?: string): PreviewTarget | undefined;
/**
 * Stable identity for a mounted preview: resolved absolute path plus the
 * focus target (line and/or LocationWithLine match fields). Used to skip
 * redundant reads/repaints while a streaming list keeps the same selection.
 */
export declare function previewIdentity(target: PreviewTarget): string;
/** Whether two preview targets describe the same mounted preview identity. */
export declare function isSamePreviewIdentity(a: PreviewTarget, b: PreviewTarget): boolean;
/** Find a 1-based focus line from LocationWithLine match text within loaded lines. */
export declare function findMatchLine(lines: readonly string[], matchLine: string): number | undefined;
