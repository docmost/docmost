// Per-table header-pin controller: native sticky when table fits its wrapper, transform fallback when it doesn't.

import { computePinTop, pinOffsetWatcher } from './offset';

const WRAPPER_NO_OVERFLOW = 'tableWrapperNoOverflow';
const HEADER_PINNED = 'tableHeaderPinned';
const PIN_OFFSET_VAR = '--table-pin-offset';

type PinMode = 'off' | 'native' | 'fallback';

function firstRowIsAllHeaders(row: HTMLTableRowElement | null): boolean {
  if (!row) return false;
  const cells = Array.from(row.cells);
  return cells.length > 0 && cells.every((c) => c.tagName === 'TH');
}

function isNestedTable(wrapper: HTMLElement): boolean {
  return wrapper.closest('table .tableWrapper') !== null;
}

function isLayoutInert(rect: DOMRectReadOnly): boolean {
  return rect.width === 0 && rect.height === 0;
}

const fallbackControllers = new Set<TablePinController>();
let fallbackScrollListener: (() => void) | null = null;
let fallbackRafPending = false;

function ensureFallbackListener() {
  if (fallbackScrollListener) return;
  fallbackScrollListener = () => {
    if (fallbackRafPending) return;
    fallbackRafPending = true;
    requestAnimationFrame(() => {
      fallbackRafPending = false;
      for (const ctrl of fallbackControllers) ctrl.updateFallbackOffset();
    });
  };
  document.addEventListener('scroll', fallbackScrollListener, {
    passive: true,
    capture: true,
  });
}

function maybeTeardownFallbackListener() {
  if (!fallbackScrollListener || fallbackControllers.size > 0) return;
  document.removeEventListener('scroll', fallbackScrollListener, {
    capture: true,
  });
  fallbackScrollListener = null;
  fallbackRafPending = false;
}

export class TablePinController {
  private wrapper: HTMLElement;
  private table: HTMLTableElement;
  private fitsObserver?: IntersectionObserver;
  private mode: PinMode = 'off';
  private cachedHeaderRow: HTMLTableRowElement | null = null;

  constructor(wrapper: HTMLElement, table: HTMLTableElement) {
    this.wrapper = wrapper;
    this.table = table;
    pinOffsetWatcher.acquire();
    this.fitsObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) this.evaluateFit(entry);
      },
      { root: this.wrapper, threshold: 1 },
    );
    this.fitsObserver.observe(this.table);
  }

  private getHeaderRow(): HTMLTableRowElement | null {
    if (this.cachedHeaderRow && this.table.contains(this.cachedHeaderRow)) {
      return this.cachedHeaderRow;
    }
    this.cachedHeaderRow = this.table.querySelector('tr');
    return this.cachedHeaderRow;
  }

  private evaluateFit(entry: IntersectionObserverEntry) {
    if (!this.isEligible()) {
      this.apply('off');
      return;
    }
    if (isLayoutInert(entry.boundingClientRect)) return;
    this.apply(entry.isIntersecting ? 'native' : 'fallback');
  }

  private isEligible(): boolean {
    return (
      !isNestedTable(this.wrapper) && firstRowIsAllHeaders(this.getHeaderRow())
    );
  }

  private apply(next: PinMode) {
    if (next === this.mode) return;

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
    } else if (next === 'native') {
      cls.add(HEADER_PINNED);
      cls.add(WRAPPER_NO_OVERFLOW);
      // Native mode reads --editor-pin-offset from :root; clear stale per-wrapper var from fallback.
      this.wrapper.style.removeProperty(PIN_OFFSET_VAR);
    } else if (next === 'fallback') {
      cls.add(HEADER_PINNED);
      cls.remove(WRAPPER_NO_OVERFLOW);
      fallbackControllers.add(this);
      ensureFallbackListener();
      // Avoid one stale-frame paint under translateY.
      this.updateFallbackOffset();
    }
  }

  updateFallbackOffset() {
    const pinTop = computePinTop();
    const tableRect = this.table.getBoundingClientRect();
    const headerRow = this.getHeaderRow();
    if (!headerRow) return;
    const rowHeight = headerRow.getBoundingClientRect().height;

    const active = tableRect.top < pinTop && tableRect.bottom > pinTop + rowHeight;

    if (active) {
      const offset = Math.min(pinTop - tableRect.top, tableRect.height - rowHeight);
      this.wrapper.style.setProperty(PIN_OFFSET_VAR, `${offset}px`);
    } else {
      this.wrapper.style.removeProperty(PIN_OFFSET_VAR);
    }
  }

  refresh() {
    // The header <tr> may have been replaced by a PM transaction; drop
    // the cached reference before checking eligibility.
    this.cachedHeaderRow = null;
    if (!this.isEligible()) {
      this.apply('off');
      return;
    }
    if (this.mode === 'off') {
      // Eligibility just flipped back on; re-trigger the observer so it
      // emits the current intersection state.
      this.fitsObserver?.unobserve(this.table);
      this.fitsObserver?.observe(this.table);
    }
  }

  destroy() {
    this.fitsObserver?.disconnect();
    this.fitsObserver = undefined;
    this.apply('off');
    pinOffsetWatcher.release();
  }
}

const controllers = new WeakMap<HTMLElement, TablePinController>();

export function attach(wrapper: HTMLElement) {
  if (controllers.has(wrapper)) return;
  const table = wrapper.querySelector(':scope > table') as HTMLTableElement | null;
  if (!table) return;
  controllers.set(wrapper, new TablePinController(wrapper, table));
}

export function detach(wrapper: HTMLElement) {
  const ctrl = controllers.get(wrapper);
  if (!ctrl) return;
  ctrl.destroy();
  controllers.delete(wrapper);
}

export function getController(wrapper: HTMLElement): TablePinController | undefined {
  return controllers.get(wrapper);
}
