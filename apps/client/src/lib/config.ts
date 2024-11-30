import bytes from "bytes";

declare global {
    interface Window {
        CONFIG?: Record<string, string>;
    }
}

export function getAppName(): string{
    return 'Docmost';
}

export function getAppUrl(): string {
    //let appUrl = window.CONFIG?.APP_URL || process.env.APP_URL;

    // if (import.meta.env.DEV) {
    //   return appUrl || "http://localhost:3000";
    //}

    return `${window.location.protocol}//${window.location.host}`;
}

export function getBackendUrl(): string {
    return getAppUrl() + '/api';
}

export function getCollaborationUrl(): string {
    const COLLAB_PATH = '/collab';

    let url = getAppUrl();
    if (import.meta.env.DEV) {
        url = process.env.APP_URL;
    }

    const wsProtocol = url.startsWith('https') ? 'wss' : 'ws';
    return `${wsProtocol}://${url.split('://')[1]}${COLLAB_PATH}`;
}

export function getAvatarUrl(avatarUrl: string) {
    if (!avatarUrl) {
        return null;
    }

    if (avatarUrl?.startsWith('http')) {
        return avatarUrl;
    }

    return getBackendUrl() + '/attachments/img/avatar/' + avatarUrl;
}

export function getSpaceUrl(spaceSlug: string) {
    return '/s/' + spaceSlug;
}

export function getFileUrl(src: string) {
    return src?.startsWith('/files/') ? getBackendUrl() + src : src;
}

export function getFileUploadSizeLimit() {
    const limit =getConfigValue("FILE_UPLOAD_SIZE_LIMIT", "50mb");
    return bytes(limit);
}

export function getDrawioUrl() {
    return getConfigValue("DRAWIO_URL", "https://embed.diagrams.net");
}

function getConfigValue(key: string, defaultValue: string = undefined) {
    return window.CONFIG?.[key] || process?.env?.[key] || defaultValue;
}