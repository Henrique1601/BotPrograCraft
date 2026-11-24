export interface WindowPosition {
    x: number;
    y: number;
}
export interface DisplayWorkArea {
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface DisplayLike {
    workArea: DisplayWorkArea;
}
export interface WindowSize {
    width: number;
    height: number;
}
export declare const DEFAULT_WINDOW_SIZE: WindowSize;
/**
 * Checks whether a window at `pos` with `windowSize` has at least
 * MIN_VISIBLE_INTERSECTION_PX of overlap with at least one active display's workArea.
 */
export declare function isPositionVisibleOnDisplays(pos: WindowPosition, displays: readonly DisplayLike[], windowSize?: WindowSize): boolean;
/**
 * Loads the persisted window position from `<homeDir>/window-state.json`
 * and validates that it intersects with at least one connected display.
 * Returns `null` if missing, corrupted, or off-screen.
 */
export declare function loadWindowState(homeDir: string, displays: readonly DisplayLike[], windowSize?: WindowSize): WindowPosition | null;
/**
 * Atomically persists the window `(x, y)` coordinates to `<homeDir>/window-state.json`.
 */
export declare function saveWindowState(homeDir: string, pos: WindowPosition): void;
//# sourceMappingURL=windowState.d.ts.map