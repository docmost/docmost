export declare class TablePinController {
    private wrapper;
    private table;
    private fitsObserver?;
    private mode;
    private cachedHeaderRow;
    constructor(wrapper: HTMLElement, table: HTMLTableElement);
    private getHeaderRow;
    private evaluateFit;
    private isEligible;
    private apply;
    updateFallbackOffset(): void;
    refresh(): void;
    destroy(): void;
}
export declare function attach(wrapper: HTMLElement): void;
export declare function detach(wrapper: HTMLElement): void;
export declare function getController(wrapper: HTMLElement): TablePinController | undefined;
