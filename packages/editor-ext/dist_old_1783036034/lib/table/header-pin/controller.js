"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TablePinController = void 0;
exports.attach = attach;
exports.detach = detach;
exports.getController = getController;
const offset_1 = require("./offset");
const WRAPPER_NO_OVERFLOW = 'tableWrapperNoOverflow';
const HEADER_PINNED = 'tableHeaderPinned';
const PIN_OFFSET_VAR = '--table-pin-offset';
function firstRowIsAllHeaders(row) {
    if (!row)
        return false;
    const cells = Array.from(row.cells);
    return cells.length > 0 && cells.every((c) => c.tagName === 'TH');
}
function isNestedTable(wrapper) {
    return wrapper.closest('table .tableWrapper') !== null;
}
function isLayoutInert(rect) {
    return rect.width === 0 && rect.height === 0;
}
const fallbackControllers = new Set();
let fallbackScrollListener = null;
let fallbackRafPending = false;
function ensureFallbackListener() {
    if (fallbackScrollListener)
        return;
    fallbackScrollListener = () => {
        if (fallbackRafPending)
            return;
        fallbackRafPending = true;
        requestAnimationFrame(() => {
            fallbackRafPending = false;
            for (const ctrl of fallbackControllers)
                ctrl.updateFallbackOffset();
        });
    };
    document.addEventListener('scroll', fallbackScrollListener, {
        passive: true,
        capture: true,
    });
}
function maybeTeardownFallbackListener() {
    if (!fallbackScrollListener || fallbackControllers.size > 0)
        return;
    document.removeEventListener('scroll', fallbackScrollListener, {
        capture: true,
    });
    fallbackScrollListener = null;
    fallbackRafPending = false;
}
class TablePinController {
    wrapper;
    table;
    fitsObserver;
    mode = 'off';
    cachedHeaderRow = null;
    constructor(wrapper, table) {
        this.wrapper = wrapper;
        this.table = table;
        offset_1.pinOffsetWatcher.acquire();
        this.fitsObserver = new IntersectionObserver((entries) => {
            for (const entry of entries)
                this.evaluateFit(entry);
        }, { root: this.wrapper, threshold: 1 });
        this.fitsObserver.observe(this.table);
    }
    getHeaderRow() {
        if (this.cachedHeaderRow && this.table.contains(this.cachedHeaderRow)) {
            return this.cachedHeaderRow;
        }
        this.cachedHeaderRow = this.table.querySelector('tr');
        return this.cachedHeaderRow;
    }
    evaluateFit(entry) {
        if (!this.isEligible()) {
            this.apply('off');
            return;
        }
        if (isLayoutInert(entry.boundingClientRect))
            return;
        this.apply(entry.isIntersecting ? 'native' : 'fallback');
    }
    isEligible() {
        return (!isNestedTable(this.wrapper) && firstRowIsAllHeaders(this.getHeaderRow()));
    }
    apply(next) {
        if (next === this.mode)
            return;
        if (this.mode === 'fallback' && next !== 'fallback') {
            fallbackControllers.delete(this);
            maybeTeardownFallbackListener();
        }
        this.mode = next;
        const cls = this.wrapper.classList;
        if (next === 'off') {
            cls.remove(HEADER_PINNED);
            cls.remove(WRAPPER_NO_OVERFLOW);
            this.wrapper.style.removeProperty(PIN_OFFSET_VAR);
        }
        else if (next === 'native') {
            cls.add(HEADER_PINNED);
            cls.add(WRAPPER_NO_OVERFLOW);
            this.wrapper.style.removeProperty(PIN_OFFSET_VAR);
        }
        else if (next === 'fallback') {
            cls.add(HEADER_PINNED);
            cls.remove(WRAPPER_NO_OVERFLOW);
            fallbackControllers.add(this);
            ensureFallbackListener();
            this.updateFallbackOffset();
        }
    }
    updateFallbackOffset() {
        const pinTop = (0, offset_1.computePinTop)();
        const tableRect = this.table.getBoundingClientRect();
        const headerRow = this.getHeaderRow();
        if (!headerRow)
            return;
        const rowHeight = headerRow.getBoundingClientRect().height;
        const active = tableRect.top < pinTop && tableRect.bottom > pinTop + rowHeight;
        if (active) {
            const offset = Math.min(pinTop - tableRect.top, tableRect.height - rowHeight);
            this.wrapper.style.setProperty(PIN_OFFSET_VAR, `${offset}px`);
        }
        else {
            this.wrapper.style.removeProperty(PIN_OFFSET_VAR);
        }
    }
    refresh() {
        this.cachedHeaderRow = null;
        if (!this.isEligible()) {
            this.apply('off');
            return;
        }
        if (this.mode === 'off') {
            this.fitsObserver?.unobserve(this.table);
            this.fitsObserver?.observe(this.table);
        }
    }
    destroy() {
        this.fitsObserver?.disconnect();
        this.fitsObserver = undefined;
        this.apply('off');
        offset_1.pinOffsetWatcher.release();
    }
}
exports.TablePinController = TablePinController;
const controllers = new WeakMap();
function attach(wrapper) {
    if (controllers.has(wrapper))
        return;
    const table = wrapper.querySelector(':scope > table');
    if (!table)
        return;
    controllers.set(wrapper, new TablePinController(wrapper, table));
}
function detach(wrapper) {
    const ctrl = controllers.get(wrapper);
    if (!ctrl)
        return;
    ctrl.destroy();
    controllers.delete(wrapper);
}
function getController(wrapper) {
    return controllers.get(wrapper);
}
//# sourceMappingURL=controller.js.map