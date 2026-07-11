export declare const EDITOR_PIN_OFFSET_VAR = "--editor-pin-offset";
export declare function computePinTop(): number;
export declare const pinOffsetWatcher: {
    refs: number;
    resizeObserver: ResizeObserver | null;
    rafPending: boolean;
    lastValue: number;
    acquire(): void;
    release(): void;
    publish(): void;
};
