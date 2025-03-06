import bytes from "bytes";

declare global {
  interface Window {
    CONFIG?: Record<string, string>;
  }
}

export function getAppName(): string {
  return "Docmost";
}

export function getAppUrl(): string {
  return `${window.location.protocol}//${window.location.host}`;
}

export function getBackendUrl(): string {
  return getAppUrl() + "/api";
}

export function getCollaborationUrl(): string {
  const baseUrl =
    getConfigValue("COLLAB_URL") ||
    (import.meta.env.DEV ? process.env.APP_URL : getAppUrl());

  const collabUrl = new URL("/collab", baseUrl);
  collabUrl.protocol = collabUrl.protocol === "https:" ? "wss:" : "ws:";
  return collabUrl.toString();
}

export function getAvatarUrl(avatarUrl: string) {
  if (!avatarUrl) return null;
  if (avatarUrl?.startsWith("http")) return avatarUrl;

  return getBackendUrl() + "/attachments/img/avatar/" + avatarUrl;
}

export function getSpaceUrl(spaceSlug: string) {
  return "/s/" + spaceSlug;
}

export function getFileUrl(src: string) {
  return src?.startsWith("/files/") ? getBackendUrl() + src : src;
}

export function getFileUploadSizeLimit() {
  const limit = getConfigValue("FILE_UPLOAD_SIZE_LIMIT", "50mb");
  return bytes(limit);
}

export function getDrawioUrl() {
  return getConfigValue("DRAWIO_URL", "https://embed.diagrams.net");
}

function getConfigValue(key: string, defaultValue: string = undefined): string {
  const rawValue = import.meta.env.DEV
    ? process?.env?.[key]
    : window?.CONFIG?.[key];
  return rawValue ?? defaultValue;
}
