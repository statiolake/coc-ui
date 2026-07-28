/** Hard cap on bytes read from a preview candidate. */
export declare const PREVIEW_MAX_BYTES: number;
/** Hard cap on lines retained for the preview buffer. */
export declare const PREVIEW_MAX_LINES = 400;
export type PreviewContent = {
    kind: "text";
    lines: string[];
    truncated: boolean;
    /** 1-based source line represented by lines[0]. */
    startLine: number;
    /** 1-based line within `lines` to focus, when the target was found. */
    focusLine?: number;
    filetype?: string;
} | {
    kind: "binary";
} | {
    kind: "unavailable";
    reason: string;
};
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
    onCancellationRequested(listener: () => void): {
        dispose(): void;
    };
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
 * Read a local file for picker preview without loading it wholesale. Plain
 * previews retain the bounded head; focused previews stream until their target
 * and retain only the surrounding line window. Detects NUL/binary content.
 */
export declare function readPreviewContent(filePath: string, options?: PreviewReadOptions): Promise<PreviewContent>;
export declare function previewStatusLines(content: PreviewContent): string[];
/**
 * Filetype option for the reusable preview buffer.
 * Always returns a string so callers can clear a previous filetype when
 * switching to an unknown extension, binary status pane, or unavailable
 * content.
 */
export declare function resolvePreviewFiletype(content: PreviewContent, detected?: string): string;
