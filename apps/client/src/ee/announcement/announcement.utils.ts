import { format } from "date-fns";
import { ANNOUNCEMENT_PREVIEW_LENGTH } from "./announcement.constants";
import type {
  IAnnouncementBanner,
  IAnnouncementContent,
} from "./types/announcement.types";

const SAFE_LINK_PROTOCOLS = ["https:", "http:", "mailto:"];
// Browsers drop tabs and newlines, so '/\t/host' would act as '//host'; lone surrogates cannot be stored
const UNSAFE_CHARACTERS = /[\p{Cc}\p{Cs}]/u;
const DISMISSED_KEY_PREFIX = "docmost.announcement.dismissed.";
const PICKER_FORMAT = "yyyy-MM-dd HH:mm:ss";
const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  dateStyle: "medium",
  timeStyle: "short",
};

const sessionDismissals = new Map<string, string>();

export function isSafeAnnouncementHref(href: string): boolean {
  if (typeof href !== "string") {
    return false;
  }
  const value = href.trim();
  if (UNSAFE_CHARACTERS.test(value)) {
    return false;
  }
  if (value.startsWith("/")) {
    return !value.startsWith("//") && !value.startsWith("/\\");
  }
  try {
    return SAFE_LINK_PROTOCOLS.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

export function isAnnouncementVisibleAt(
  a: Pick<IAnnouncementBanner, "startsAt" | "endsAt">,
  nowMs: number,
): boolean {
  return (
    Date.parse(a.startsAt) <= nowMs &&
    (!a.endsAt || nowMs < Date.parse(a.endsAt))
  );
}

export function getAnnouncementPlainText(
  content: IAnnouncementContent,
): string {
  // Editor JSON omits content on an empty paragraph
  return content.content
    .flatMap((paragraph) => paragraph.content ?? [])
    .map((node) => node.text)
    .join("");
}

export function getAnnouncementPreview(content: IAnnouncementContent): string {
  const text = getAnnouncementPlainText(content).replace(/\s+/g, " ").trim();
  const characters = Array.from(text);
  if (characters.length <= ANNOUNCEMENT_PREVIEW_LENGTH) {
    return text;
  }
  return `${characters.slice(0, ANNOUNCEMENT_PREVIEW_LENGTH - 1).join("")}…`;
}

export function getAnnouncementFingerprint(
  a: Pick<IAnnouncementBanner, "type" | "color" | "content">,
): string {
  const text = JSON.stringify([a.type, a.color, a.content]);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

const getDismissedKey = (id: string) => `${DISMISSED_KEY_PREFIX}${id}`;

export function isAnnouncementDismissed(
  a: Pick<IAnnouncementBanner, "id" | "type" | "color" | "content">,
): boolean {
  const fingerprint = getAnnouncementFingerprint(a);
  if (sessionDismissals.get(a.id) === fingerprint) {
    return true;
  }
  try {
    return localStorage.getItem(getDismissedKey(a.id)) === fingerprint;
  } catch {
    return false;
  }
}

export function dismissAnnouncement(
  a: Pick<IAnnouncementBanner, "id" | "type" | "color" | "content">,
): void {
  const fingerprint = getAnnouncementFingerprint(a);
  sessionDismissals.set(a.id, fingerprint);
  try {
    localStorage.setItem(getDismissedKey(a.id), fingerprint);
  } catch {
    // blocked storage: the session map still hides it until the page reloads
  }
}

export function toPickerValue(iso: string): string {
  return format(new Date(iso), PICKER_FORMAT);
}

export function fromPickerValue(value: string): string {
  return new Date(value.replace(" ", "T")).toISOString();
}

export function formatAnnouncementTime(
  time: string | number,
  language: string,
): string {
  return new Date(time).toLocaleString(language, DATE_TIME_FORMAT);
}
