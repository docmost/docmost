declare global {
  interface Window {
    CONFIG?: Record<string, string>;
  }
}

export function getAppUrl(): string {
  let appUrl = window.CONFIG?.APP_URL || process.env.APP_URL;

  if (!appUrl) {
    appUrl = import.meta.env.DEV
      ? "http://localhost:3000"
      : window.location.protocol + "//" + window.location.host;
  }

  return appUrl;
}

export function getBackendUrl(): string {
  return getAppUrl() + "/api";
}

export function getCollaborationUrl(): string {
  const COLLAB_PATH = "/collab";

  const wsProtocol = getAppUrl().startsWith("https") ? "wss" : "ws";
  return `${wsProtocol}://${getAppUrl().split("://")[1]}${COLLAB_PATH}`;
}

export function getAvatarUrl(avatarUrl: string) {
  if (avatarUrl.startsWith("http")) {
    return avatarUrl;
  }

  return getBackendUrl() + "/attachments/img/avatar/" + avatarUrl;
}
