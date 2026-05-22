// Pin-offset measurement and watcher used by the table header-pin controller.

// Fallback app-bar height (px) when no fixed surface is mounted; matches global-app-shell.tsx.
const APP_BAR_FALLBACK_HEIGHT = 45;

export const EDITOR_PIN_OFFSET_VAR = '--editor-pin-offset';

// Selectors for fixed surfaces between viewport top and editor content. Use data attributes —
// CSS module classes are build-time hashed and won't match.
const PIN_ANCHOR_SELECTORS = [
  '[data-page-header]',
  '[data-fixed-toolbar]',
] as const;

export function computePinTop(): number {
  let bottom = APP_BAR_FALLBACK_HEIGHT;
  for (const sel of PIN_ANCHOR_SELECTORS) {
    const el = document.querySelector(sel) as HTMLElement | null;
    if (!el) continue;
    const rect = el.getBoundingClientRect();
    if (rect.height > 0 && rect.bottom > bottom) bottom = rect.bottom;
  }
  return bottom;
}

// Reference-counted watcher that publishes the editor's top offset to a CSS custom property.
export const pinOffsetWatcher = {
  refs: 0,
  resizeObserver: null as ResizeObserver | null,
  rafPending: false,
  lastValue: -1,

  acquire() {
    if (this.refs++ > 0) return;
    this.publish();
    const schedule = () => {
      if (this.rafPending) return;
      this.rafPending = true;
      requestAnimationFrame(() => {
        this.rafPending = false;
        this.publish();
      });
    };
    this.resizeObserver = new ResizeObserver(schedule);
    this.resizeObserver.observe(document.body);
  },

  release() {
    if (--this.refs > 0) return;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    document.documentElement.style.removeProperty(EDITOR_PIN_OFFSET_VAR);
    this.lastValue = -1;
  },

  publish() {
    const top = computePinTop();
    if (top === this.lastValue) return;
    this.lastValue = top;
    document.documentElement.style.setProperty(
      EDITOR_PIN_OFFSET_VAR,
      `${top}px`,
    );
  },
};
