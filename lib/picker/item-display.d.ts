export type PickerItemDisplay = {
    text: string;
    /** Fuzzy-match character positions remapped from the source label. */
    positions?: Uint32Array;
};
/**
 * Shorten path hierarchy for display without changing the value used for
 * filtering. Components containing fuzzy-match positions are never removed,
 * and the returned positions address the shortened text.
 */
export declare function formatPickerItem(label: string, positions: ArrayLike<number> | undefined, maxWidth: number): PickerItemDisplay;
