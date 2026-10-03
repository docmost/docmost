import { Editor } from "@tiptap/core";

export function normalizeFileUrl(src: string): string {
  if (src && src.startsWith("/files/")) {
    return "/api" + src;
  }
  return src || "";
}

// HTML attributes are strings; numeric node attributes must not come back as
// "123" after an HTML (or markdown) round-trip.
export function parseNumericAttr(
  element: HTMLElement,
  name: string,
): number | null {
  const raw = element.getAttribute(name);
  if (raw === null || raw === "") return null;
  const num = Number(raw);
  return Number.isFinite(num) ? num : null;
}

export function syncAltBadge(wrapper: HTMLElement, alt: unknown): void {
  const existing = wrapper.querySelector<HTMLElement>(
    ":scope > .media-alt-badge",
  );

  if (typeof alt !== "string" || !alt.trim()) {
    existing?.remove();
    return;
  }

  const badge = existing ?? document.createElement("span");
  badge.dataset.alt = alt;

  if (!existing) {
    badge.className = "media-alt-badge";
    badge.textContent = "ALT";
    badge.setAttribute("aria-hidden", "true");
    wrapper.appendChild(badge);
  }
}

export type UploadFn = (
  file: File,
  editor: Editor,
  pos: number,
  pageId: string,
  // only applicable to file attachments
  allowMedia?: boolean,
) => void;

export interface MediaUploadOptions {
  validateFn?: (file: File, allowMedia?: boolean) => void;
  onUpload: (file: File, pageId: string) => Promise<any>;
}
