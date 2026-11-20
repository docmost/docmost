import { Editor } from "@tiptap/core";

export function normalizeFileUrl(src: string): string {
  if (src && src.startsWith("/files/")) {
    return "/api" + src;
  }
  return src || "";
}

export function getFileNameFromUrl(url: string | undefined): string {
  const path = (url || "").split("?")[0];
  const fileName = path.substring(path.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(fileName);
  } catch {
    return fileName;
  }
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

export type UploadTarget = { pageId: string } | { templateId: string };

export type UploadFn = (
  file: File,
  editor: Editor,
  pos: number,
  uploadTarget: UploadTarget,
  // only applicable to file attachments
  allowMedia?: boolean,
) => void;

export interface MediaUploadOptions {
  validateFn?: (file: File, allowMedia?: boolean) => void;
  onUpload: (file: File, uploadTarget: UploadTarget) => Promise<any>;
}
