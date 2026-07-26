/** Hard cap on bytes read from a preview candidate. */
export declare const PREVIEW_MAX_BYTES: number;
/** Hard cap on lines retained for the preview buffer. */
export declare const PREVIEW_MAX_LINES = 400;
export type PreviewContent = {
    kind: "text";
    lines: string[];
    truncated: boolean;
    filetype?: string;
} | {
    kind: "binary";
} | {
    kind: "unavailable";
    reason: string;
};
/** Best-effort filetype from path extension (no buffer load). */
export declare function guessFiletype(filePath: string): string | undefined;
export declare function isBinaryBuffer(buffer: Buffer): boolean;
/**
 * Split text into preview lines, honoring PREVIEW_MAX_LINES.
 * A trailing empty segment from a final newline is dropped so the buffer
 * matches typical editor line counts.
 */
export declare function splitPreviewLines(text: string): {
    lines: string[];
    truncated: boolean;
};
/**
 * Boundedly read a local file for picker preview. Never loads the full file
 * when it exceeds PREVIEW_MAX_BYTES. Detects NUL/binary content.
 */
export declare function readPreviewContent(filePath: string, options?: {
    maxBytes?: number;
    maxLines?: number;
}): Promise<PreviewContent>;
export declare function previewStatusLines(content: PreviewContent): string[];
/**
 * Filetype option for the reusable preview buffer.
 * Always returns a string so callers can clear a previous filetype when
 * switching to an unknown extension, binary status pane, or unavailable
 * content.
 */
export declare function resolvePreviewFiletype(content: PreviewContent, detected?: string): string;
