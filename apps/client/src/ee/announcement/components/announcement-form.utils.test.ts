import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import {
  type AnnouncementFormValues,
  formatPickerValue,
  getInitialValues,
  getPickerTime,
  toAnnouncementInput,
  validateAnnouncementForm,
} from "./announcement-form.utils";
import {
  formatAnnouncementTime,
  fromPickerValue,
  toPickerValue,
} from "../announcement.utils";
import type {
  IAnnouncement,
  IAnnouncementContent,
} from "../types/announcement.types";

const t = ((key: string) => key) as unknown as TFunction;
const NOW = Date.parse("2026-11-05T12:00:00.000Z");

const doc = (text: string): IAnnouncementContent => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const stored = (overrides: Partial<IAnnouncement> = {}): IAnnouncement => ({
  id: "a1",
  title: "Maintenance window",
  type: "warning",
  color: "yellow",
  content: doc("Planned maintenance"),
  isDismissible: true,
  audience: "everyone",
  startsAt: "2026-11-04T09:00:00.123Z",
  endsAt: "2026-11-06T18:00:00.456Z",
  archivedAt: null,
  status: "active",
  createdAt: "2026-11-03T09:00:00.000Z",
  updatedAt: "2026-11-03T09:00:00.000Z",
  ...overrides,
});

const values = (
  overrides: Partial<AnnouncementFormValues> = {},
): AnnouncementFormValues => ({
  ...getInitialValues(null),
  title: "Maintenance",
  content: doc("Maintenance tonight"),
  ...overrides,
});

const validate = (
  formValues: AnnouncementFormValues,
  storedEndsAt: string | null = null,
) => validateAnnouncementForm(formValues, storedEndsAt, t, NOW);

describe("getInitialValues", () => {
  it("starts a new announcement as info, blue, for logged-in users, not dismissible, now and without an end", () => {
    expect(getInitialValues(null)).toEqual({
      title: "",
      type: "info",
      color: "blue",
      content: null,
      audience: "members",
      isDismissible: false,
      startsAt: null,
      endsAt: null,
    });
  });

  it("puts both stored times in the pickers when editing", () => {
    const announcement = stored();
    expect(getInitialValues(announcement)).toEqual({
      title: "Maintenance window",
      type: "warning",
      color: "yellow",
      content: announcement.content,
      audience: "everyone",
      isDismissible: true,
      startsAt: toPickerValue(announcement.startsAt),
      endsAt: toPickerValue(announcement.endsAt),
    });
  });

  it("edits an announcement without an end as No end", () => {
    expect(getInitialValues(stored({ endsAt: null }))).toMatchObject({
      endsAt: null,
    });
  });
});

describe("toAnnouncementInput", () => {
  it("sends null for Now and No end", () => {
    expect(
      toAnnouncementInput(
        values({ type: "critical", color: "purple", audience: "everyone", isDismissible: true }),
        null,
      ),
    ).toEqual({
      title: "Maintenance",
      type: "critical",
      color: "purple",
      content: doc("Maintenance tonight"),
      isDismissible: true,
      audience: "everyone",
      startsAt: null,
      endsAt: null,
    });
  });

  it("sends the trimmed title", () => {
    expect(
      toAnnouncementInput(values({ title: "  Maintenance  " }), null).title,
    ).toBe("Maintenance");
  });

  it("sends the picked times as ISO when creating", () => {
    const input = toAnnouncementInput(
      values({
        startsAt: "2026-11-10 09:30:00",
        endsAt: "2026-11-12 18:00:00",
      }),
      null,
    );
    expect(input.startsAt).toBe(fromPickerValue("2026-11-10 09:30:00"));
    expect(input.endsAt).toBe(fromPickerValue("2026-11-12 18:00:00"));
  });

  it("re-sends the stored times when the pickers are untouched", () => {
    const announcement = stored();
    expect(
      toAnnouncementInput(getInitialValues(announcement), announcement),
    ).toMatchObject({
      startsAt: "2026-11-04T09:00:00.123Z",
      endsAt: "2026-11-06T18:00:00.456Z",
    });
  });

  it("sends the new times when the pickers changed", () => {
    const announcement = stored();
    const input = toAnnouncementInput(
      {
        ...getInitialValues(announcement),
        startsAt: "2026-11-10 10:00:00",
        endsAt: "2026-11-12 10:00:00",
      },
      announcement,
    );
    expect(input.startsAt).toBe(fromPickerValue("2026-11-10 10:00:00"));
    expect(input.endsAt).toBe(fromPickerValue("2026-11-12 10:00:00"));
  });

  it("sends null when an edit switches to Now and No end", () => {
    const announcement = stored();
    expect(
      toAnnouncementInput(
        { ...getInitialValues(announcement), startsAt: null, endsAt: null },
        announcement,
      ),
    ).toMatchObject({ startsAt: null, endsAt: null });
  });
});

describe("validateAnnouncementForm", () => {
  it("accepts a message that starts now and never ends", () => {
    expect(validate(values())).toEqual({});
  });

  it.each([
    ["no message", null, "Announcement message is required"],
    ["a blank message", doc("   "), "Announcement message is required"],
    ["a message over 500 characters", doc("a".repeat(501)), "Announcement message is too long"],
  ])("rejects %s", (_label, content, message) => {
    expect(validate(values({ content })).content).toBe(message);
  });

  it.each([
    ["no title", "", "Announcement title is required"],
    ["a blank title", "   ", "Announcement title is required"],
    ["a title over 100 characters", "a".repeat(101), "Announcement title is too long"],
  ])("rejects %s", (_label, title, message) => {
    expect(validate(values({ title })).title).toBe(message);
  });

  it("accepts a title of exactly 100 characters", () => {
    expect(validate(values({ title: "a".repeat(100) }))).toEqual({});
  });

  it("accepts a message of exactly 500 characters", () => {
    expect(validate(values({ content: doc("a".repeat(500)) }))).toEqual({});
  });

  it("reads an empty start as now when it checks the end", () => {
    const soon = toPickerValue(new Date(NOW + 60_000).toISOString());
    expect(validate(values({ startsAt: null, endsAt: soon }))).toEqual({});
  });

  it("rejects a new end that is not in the future", () => {
    const pastEnd = toPickerValue(new Date(NOW - 60_000).toISOString());
    expect(validate(values({ endsAt: pastEnd })).endsAt).toBe(
      "End time must be in the future",
    );
  });

  it("rejects an end before the start", () => {
    expect(
      validate(
        values({
          startsAt: "2026-11-10 10:00:00",
          endsAt: "2026-11-09 10:00:00",
        }),
      ).endsAt,
    ).toBe("End time must be after the start time");
  });

  it("keeps a stored end that has passed when it was not touched", () => {
    const endsAt = "2026-11-01T18:00:00.000Z";
    expect(
      validate(
        values({
          startsAt: "2026-10-30 09:00:00",
          endsAt: toPickerValue(endsAt),
        }),
        endsAt,
      ),
    ).toEqual({});
  });

  it("rejects starting now while the stored end has passed", () => {
    const endsAt = "2026-11-01T18:00:00.000Z";
    expect(
      validate(values({ endsAt: toPickerValue(endsAt) }), endsAt)
        .endsAt,
    ).toBe("End time must be after the start time");
  });
});

describe("getPickerTime", () => {
  it.each([[null], [""], ["not a date"]])("returns null for %j", (value) => {
    expect(getPickerTime(value)).toBeNull();
  });

  it("reads a picker value as local time", () => {
    expect(getPickerTime("2026-11-06 09:30:00")).toBe(
      new Date(2026, 10, 6, 9, 30).getTime(),
    );
  });
});

describe("formatPickerValue", () => {
  it("formats a picker value in the admin's language", () => {
    expect(formatPickerValue("2026-11-06 09:30:00", "en-US")).toBe(
      formatAnnouncementTime(new Date(2026, 10, 6, 9, 30).getTime(), "en-US"),
    );
  });

  it("shows an unreadable value as it is", () => {
    expect(formatPickerValue("soon", "en-US")).toBe("soon");
  });
});
