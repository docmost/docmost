import type { TFunction } from "i18next";
import {
  ANNOUNCEMENT_TYPE_DEFAULT_COLOR,
  ANNOUNCEMENT_MAX_TEXT_LENGTH,
  ANNOUNCEMENT_MAX_TITLE_LENGTH,
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
  AnnouncementType,
  IAnnouncement,
  IAnnouncementContent,
  IAnnouncementInput,
} from "@/ee/announcement/types/announcement.types";

export type AnnouncementFormValues = {
  title: string;
  type: AnnouncementType;
  color: AnnouncementColor;
  content: IAnnouncementContent | null;
  audience: AnnouncementAudience;
  isDismissible: boolean;
  // An empty start means now and an empty end means no end
  startsAt: string | null;
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
      title: "",
      type: "info",
      color: ANNOUNCEMENT_TYPE_DEFAULT_COLOR.info,
      content: null,
      audience: "members",
      isDismissible: false,
      startsAt: null,
      endsAt: null,
    };
  }
  return {
    title: announcement.title,
    type: announcement.type,
    color: announcement.color,
    content: announcement.content,
    audience: announcement.audience,
    isDismissible: announcement.isDismissible,
    startsAt: toPickerValue(announcement.startsAt),
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
  const title = values.title.trim();
  if (!title) {
    errors.title = t("Announcement title is required");
  } else if (title.length > ANNOUNCEMENT_MAX_TITLE_LENGTH) {
    errors.title = t("Announcement title is too long");
  }
  const text = values.content ? getAnnouncementPlainText(values.content) : "";
  if (!text.trim()) {
    errors.content = t("Announcement message is required");
  } else if (text.length > ANNOUNCEMENT_MAX_TEXT_LENGTH) {
    errors.content = t("Announcement message is too long");
  }

  const startTime = values.startsAt ? getPickerTime(values.startsAt) : now;
  const endTime = getPickerTime(values.endsAt);
  if (endTime !== null) {
    // Like the server, an end left as stored may already have passed
    const endChanged =
      !storedEndsAt || values.endsAt !== toPickerValue(storedEndsAt);
    if (endChanged && endTime <= now) {
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
    title: values.title.trim(),
    type: values.type,
    color: values.color,
    content: values.content,
    isDismissible: values.isDismissible,
    audience: values.audience,
    startsAt: values.startsAt
      ? toInputTime(values.startsAt, announcement?.startsAt ?? null)
      : null,
    endsAt: values.endsAt
      ? toInputTime(values.endsAt, announcement?.endsAt ?? null)
      : null,
  };
}

export function formatPickerValue(value: string, language: string): string {
  const time = getPickerTime(value);
  return time === null ? value : formatAnnouncementTime(time, language);
}
