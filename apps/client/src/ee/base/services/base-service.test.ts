import { beforeEach, describe, expect, it, vi } from "vitest";

const post = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api-client", () => ({ default: { post } }));
vi.mock("file-saver", () => ({ saveAs: vi.fn() }));
vi.mock("@/ee/base/utils/viewer-zone", () => ({ getViewerTimeZone: () => "Europe/Berlin" }));

import { convertPageToBase, createBase, exportBaseToCsv, listRows } from "./base-service";
import type { FilterNode } from "@/ee/base/types/base.types";

const viewer = { timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" };
const filter: FilterNode = {
  op: "and",
  children: [{ propertyId: "due", op: "eq", value: { mode: "relative", preset: "today" } }],
};

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({ data: {}, headers: {} });
});

describe("base requests", () => {
  it("sends the viewer's zone, week start and day with a row list", async () => {
    await listRows("p1", { limit: 100, filter, ...viewer });
    expect(post).toHaveBeenCalledWith(
      "/bases/rows",
      { pageId: "p1", limit: 100, filter, timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" },
      { signal: undefined },
    );
  });

  it("adds no zone of its own to a row list", async () => {
    await listRows("p1", { limit: 100 });
    expect(post.mock.calls[0][1]).toEqual({ pageId: "p1", limit: 100 });
  });

  it("sends the same three with a CSV export", async () => {
    await exportBaseToCsv("p1", filter, viewer);
    expect(post).toHaveBeenCalledWith(
      "/bases/export-csv",
      { pageId: "p1", filter, timeZone: "America/New_York", weekStart: 0, today: "2026-11-12" },
      { responseType: "blob" },
    );
  });

  it.each([
    ["a new base", () => createBase({ name: "Plan", spaceId: "s1" }), "/bases/create", { name: "Plan", spaceId: "s1", timeZone: "Europe/Berlin" }],
    ["a page turned into a base", () => convertPageToBase("p1", "kanban"), "/bases/convert", { pageId: "p1", template: "kanban", timeZone: "Europe/Berlin" }],
  ])("sends the creator's zone with %s", async (_name, call, url, body) => {
    await call();
    expect(post).toHaveBeenCalledWith(url, body);
  });
});
