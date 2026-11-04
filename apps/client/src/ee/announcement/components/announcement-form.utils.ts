import type { TFunction } from "i18next";
import {
  ANNOUNCEMENT_KIND_DEFAULT_COLOR,
  ANNOUNCEMENT_MAX_TEXT_LENGTH,
} from "@/ee/announcement/announcement.constants";
import {
  formatAnnouncementTime,
  fromPickerValue,
  getAnnouncementPlainText,
  toPickerValue,
} from "@/ee/announcement/announcement.utils";
import type {
  AnnouncementAudience,
  AnnouncementColor,
  AnnouncementKind,
  IAnnouncement,
  IAnnouncementContent,
  IAnnouncementInput,
} from "@/ee/announcement/types/announcement.types";

export type AnnouncementFormValues = {
  kind: AnnouncementKind;
  color: AnnouncementColor;
  content: IAnnouncementContent | null;
  audience: AnnouncementAudience;
  isDismissible: boolean;
  startMode: "now" | "date";
  startsAt: string | null;
  endMode: "none" | "date";
  endsAt: string | null;
};

export type AnnouncementFormErrors = Partial<
  Record<keyof AnnouncementFormValues, string>
>;

export function getInitialValues(
  announcement: IAnnouncement | null,
): AnnouncementFormValues {
  if (!announcement) {
    return {
      kind: "info",
      color: ANNOUNCEMENT_KIND_DEFAULT_COLOR.info,
      content: null,
      audience: "members",
      isDismissible: false,
      startMode: "now",
      startsAt: null,
      endMode: "none",
      endsAt: null,
    };
  }
  return {
    kind: announcement.kind,
    color: announcement.color,
    content: announcement.content,
    audience: announcement.audience,
    isDismissible: announcement.isDismissible,
    startMode: "date",
    startsAt: toPickerValue(announcement.startsAt),
    endMode: announcement.endsAt ? "date" : "none",
    endsAt: announcement.endsAt ? toPickerValue(announcement.endsAt) : null,
  };
}

export function getPickerTime(value: string | null): number | null {
  if (!value) {
    return null;
  }
  try {
    return Date.parse(fromPickerValue(value));
  } catch {
    return null;
  }
}

// The picker drops milliseconds, so an untouched time is sent as stored
function toInputTime(value: string, stored: string | null): string {
  return stored && toPickerValue(stored) === value
    ? stored
    : fromPickerValue(value);
}

export function validateAnnouncementForm(
  values: AnnouncementFormValues,
  storedEndsAt: string | null,
  t: TFunction,
  now = Date.now(),
): AnnouncementFormErrors {
  const errors: AnnouncementFormErrors = {};
  const text = values.content ? getAnnouncementPlainText(values.content) : "";
  if (!text.trim()) {
    errors.content = t("Announcement message is required");
  } else if (text.length > ANNOUNCEMENT_MAX_TEXT_LENGTH) {
    errors.content = t("Announcement message is too long");
  }

  const startTime =
    values.startMode === "now" ? now : getPickerTime(values.startsAt);
  if (startTime === null) {
    errors.startsAt = t("Start time is required");
  }

  if (values.endMode === "date") {
    const endTime = getPickerTime(values.endsAt);
    // Like the server, an end left as stored may already have passed
    const endChanged =
      !storedEndsAt || values.endsAt !== toPickerValue(storedEndsAt);
    if (endTime === null) {
      errors.endsAt = t("End time is required");
    } else if (endChanged && endTime <= now) {
      errors.endsAt = t("End time must be in the future");
    } else if (startTime !== null && endTime <= startTime) {
      errors.endsAt = t("End time must be after the start time");
    }
  }
  return errors;
}

export function toAnnouncementInput(
  values: AnnouncementFormValues,
  announcement: IAnnouncement | null,
): IAnnouncementInput {
  return {
    kind: values.kind,
    color: values.color,
    content: values.content,
    isDismissible: values.isDismissible,
    audience: values.audience,
    startsAt:
      values.startMode === "now"
        ? null
        : toInputTime(values.startsAt, announcement?.startsAt ?? null),
    endsAt:
      values.endMode === "none"
        ? null
        : toInputTime(values.endsAt, announcement?.endsAt ?? null),
  };
}

export function formatPickerValue(value: string, language: string): string {
  const time = getPickerTime(value);
  return time === null ? value : formatAnnouncementTime(time, language);
}
