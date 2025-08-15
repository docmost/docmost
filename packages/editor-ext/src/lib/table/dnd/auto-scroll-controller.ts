import { DraggingDOMs } from "./utils";

const EDGE_THRESHOLD = 100;
const SCROLL_SPEED = 10;

export class AutoScrollController {
    private _autoScrollInterval?: number;

    checkYAutoScroll = (clientY: number) => {
        const scrollContainer = document.documentElement;

        if (clientY < 0 + EDGE_THRESHOLD) {
            this._startYAutoScroll(scrollContainer!, -1 * SCROLL_SPEED);
        } else if (clientY > window.innerHeight - EDGE_THRESHOLD) {
            this._startYAutoScroll(scrollContainer!, SCROLL_SPEED);
        } else {
            this._stopYAutoScroll();
        }
    }

    checkXAutoScroll = (clientX: number, draggingDOMs: DraggingDOMs) => {
        const table = draggingDOMs?.table;
        if (!table) return;

        const scrollContainer = table.closest<HTMLElement>('.tableWrapper');
        const editorRect = scrollContainer.getBoundingClientRect();
        if (!scrollContainer) return;

        if (clientX < editorRect.left + EDGE_THRESHOLD) {
            this._startXAutoScroll(scrollContainer!, -1 * SCROLL_SPEED);
        } else if (clientX > editorRect.right - EDGE_THRESHOLD) {
            this._startXAutoScroll(scrollContainer!, SCROLL_SPEED);
        } else {
            this._stopXAutoScroll();
        }
    }

    stop = () => {
        this._stopXAutoScroll();
        this._stopYAutoScroll();
    }

    private _startXAutoScroll = (scrollContainer: HTMLElement, speed: number) => {
        if (this._autoScrollInterval) {
            clearInterval(this._autoScrollInterval);
        }

        this._autoScrollInterval = window.setInterval(() => {
            scrollContainer.scrollLeft += speed;
        }, 16);
    }

    private _stopXAutoScroll = () => {
        if (this._autoScrollInterval) {
            clearInterval(this._autoScrollInterval);
            this._autoScrollInterval = undefined;
        }
    }

    private _startYAutoScroll = (scrollContainer: HTMLElement, speed: number) => {
        if (this._autoScrollInterval) {
            clearInterval(this._autoScrollInterval);
        }

        this._autoScrollInterval = window.setInterval(() => {
            scrollContainer.scrollTop += speed;
        }, 16);
    }

    private _stopYAutoScroll = () => {
        if (this._autoScrollInterval) {
            clearInterval(this._autoScrollInterval);
            this._autoScrollInterval = undefined;
        }
    }
}