import { describe, expect, it } from "vitest";
import type { M365Item } from "@/features/microsoft/types/microsoft.types";
import { DEFAULT_FOLDER_SORT } from "./folder-table.constants";
import type {
  FolderPathEntry,
  FolderSort,
  FolderSortColumn,
} from "./folder-table.types";
import {
  buildFolderCrumbs,
  modifiedTime,
  nextFolderSort,
  sortFolderItems,
} from "./folder-table.utils";

function entry(
  kind: M365Item["kind"],
  name: string,
  extra: Partial<M365Item> = {},
): M365Item {
  return {
    kind,
    driveId: "drive-1",
    itemId: `${kind}-${name}`,
    name,
    webUrl: `https://contoso.sharepoint.com/sites/team/${name}`,
    ...extra,
  };
}

const file = (name: string, extra?: Partial<M365Item>) =>
  entry("file", name, extra);
const folder = (name: string, extra?: Partial<M365Item>) =>
  entry("folder", name, extra);
const names = (items: M365Item[]) => items.map((item) => item.name);

const pathEntry = (name: string): FolderPathEntry => ({
  driveId: "drive-1",
  itemId: `folder-${name}`,
  webUrl: `https://contoso.sharepoint.com/sites/team/${name}`,
  name,
});

describe("modifiedTime", () => {
  it("returns the time of a valid date", () => {
    expect(
      modifiedTime(
        file("a.docx", { lastModifiedDateTime: "2026-10-03T09:00:00Z" }),
      ),
    ).toBe(Date.parse("2026-10-03T09:00:00Z"));
  });

  it.each([undefined, "", "not a date"])(
    "returns undefined for %j",
    (lastModifiedDateTime) => {
      expect(
        modifiedTime(file("a.docx", { lastModifiedDateTime })),
      ).toBeUndefined();
    },
  );
});

describe("sortFolderItems", () => {
  const everySort: FolderSort[] = (
    ["name", "modified", "modifiedBy"] as FolderSortColumn[]
  ).flatMap((column) => [
    { column, direction: "asc" },
    { column, direction: "desc" },
  ]);

  it.each(everySort)(
    "keeps folders before files when sorting by $column $direction",
    (sort) => {
      const items = [
        file("Alpha.docx", {
          lastModifiedDateTime: "2026-12-01T09:00:00Z",
          lastModifiedBy: "Ann",
        }),
        folder("Zeta", {
          lastModifiedDateTime: "2026-01-01T09:00:00Z",
          lastModifiedBy: "Zoe",
        }),
        file("Omega.docx", {
          lastModifiedDateTime: "2026-06-01T09:00:00Z",
          lastModifiedBy: "Zoe",
        }),
        folder("Beta", {
          lastModifiedDateTime: "2026-11-01T09:00:00Z",
          lastModifiedBy: "Ann",
        }),
      ];

      const kinds = sortFolderItems(items, sort).map((item) => item.kind);

      expect(kinds).toEqual(["folder", "folder", "file", "file"]);
    },
  );

  it("sorts names naturally and without regard to case", () => {
    const items = [
      file("File 10.docx"),
      file("file 2.docx"),
      file("File 1.docx"),
    ];

    expect(names(sortFolderItems(items, DEFAULT_FOLDER_SORT))).toEqual([
      "File 1.docx",
      "file 2.docx",
      "File 10.docx",
    ]);
    expect(
      names(sortFolderItems(items, { column: "name", direction: "desc" })),
    ).toEqual(["File 10.docx", "file 2.docx", "File 1.docx"]);
  });

  it("puts the newest first for modified descending and undated items last in both directions", () => {
    const items = [
      file("older.docx", { lastModifiedDateTime: "2026-09-01T09:00:00Z" }),
      file("undated.docx"),
      file("newest.docx", { lastModifiedDateTime: "2026-10-03T09:00:00Z" }),
    ];

    expect(
      names(sortFolderItems(items, { column: "modified", direction: "desc" })),
    ).toEqual(["newest.docx", "older.docx", "undated.docx"]);
    expect(
      names(sortFolderItems(items, { column: "modified", direction: "asc" })),
    ).toEqual(["older.docx", "newest.docx", "undated.docx"]);
  });

  it("puts items without a modifier last in both directions when sorting by modified by", () => {
    const items = [
      file("c.docx", { lastModifiedBy: "Zoe" }),
      file("a.docx"),
      file("b.docx", { lastModifiedBy: "Ann" }),
    ];

    expect(
      names(sortFolderItems(items, { column: "modifiedBy", direction: "asc" })),
    ).toEqual(["b.docx", "c.docx", "a.docx"]);
    expect(
      names(
        sortFolderItems(items, { column: "modifiedBy", direction: "desc" }),
      ),
    ).toEqual(["c.docx", "b.docx", "a.docx"]);
  });

  it("falls back to the name, A to Z, when the sorted values are equal", () => {
    const sameDate = "2026-10-03T09:00:00Z";
    const items = [
      file("b.docx", { lastModifiedDateTime: sameDate, lastModifiedBy: "Ann" }),
      file("d.docx"),
      file("a.docx", { lastModifiedDateTime: sameDate, lastModifiedBy: "Ann" }),
      file("c.docx"),
    ];

    for (const direction of ["asc", "desc"] as const) {
      expect(
        names(sortFolderItems(items, { column: "modified", direction })),
      ).toEqual(["a.docx", "b.docx", "c.docx", "d.docx"]);
      expect(
        names(sortFolderItems(items, { column: "modifiedBy", direction })),
      ).toEqual(["a.docx", "b.docx", "c.docx", "d.docx"]);
    }
  });

  it("returns a new array and leaves its input untouched", () => {
    const items = [folder("b"), file("a.docx"), folder("a")];
    const before = [...items];

    const sorted = sortFolderItems(items, DEFAULT_FOLDER_SORT);

    expect(sorted).not.toBe(items);
    expect(items).toEqual(before);
    expect(names(sorted)).toEqual(["a", "b", "a.docx"]);
  });
});

describe("nextFolderSort", () => {
  it("flips the direction when the active column is chosen again", () => {
    expect(
      nextFolderSort({ column: "name", direction: "asc" }, "name"),
    ).toEqual({ column: "name", direction: "desc" });
    expect(
      nextFolderSort({ column: "modified", direction: "desc" }, "modified"),
    ).toEqual({ column: "modified", direction: "asc" });
  });

  it("starts modified with the newest first and the other columns A to Z", () => {
    const current: FolderSort = { column: "name", direction: "asc" };

    expect(nextFolderSort(current, "modified")).toEqual({
      column: "modified",
      direction: "desc",
    });
    expect(nextFolderSort(current, "modifiedBy")).toEqual({
      column: "modifiedBy",
      direction: "asc",
    });
    expect(
      nextFolderSort({ column: "modified", direction: "desc" }, "name"),
    ).toEqual({ column: "name", direction: "asc" });
  });
});

describe("buildFolderCrumbs", () => {
  it("lists the trail and the embedded folder, none of them clickable at the top level", () => {
    expect(
      buildFolderCrumbs(["Marketing", "Documents"], "Reports", []),
    ).toMatchObject([
      { name: "Marketing", depth: null },
      { name: "Documents", depth: null },
      { name: "Reports", depth: null },
    ]);
  });

  it("makes the embedded folder and the folders below it clickable, except the current one", () => {
    expect(
      buildFolderCrumbs(
        ["Marketing", "Documents"],
        "Reports",
        [pathEntry("Q3"), pathEntry("Week 1")],
      ),
    ).toMatchObject([
      { name: "Marketing", depth: null },
      { name: "Documents", depth: null },
      { name: "Reports", depth: 0 },
      { name: "Q3", depth: 1 },
      { name: "Week 1", depth: null },
    ]);
  });

  it("shows only the embedded folder when the trail is unknown", () => {
    expect(buildFolderCrumbs([], "Reports", [])).toMatchObject([
      { name: "Reports", depth: null },
    ]);
  });

  it("keeps five crumbs as they are", () => {
    const crumbs = buildFolderCrumbs(["S", "D", "A"], "R", [pathEntry("X")]);

    expect(crumbs.map((crumb) => crumb.name)).toEqual([
      "S",
      "D",
      "A",
      "R",
      "X",
    ]);
  });

  it("collapses more than five crumbs to the first, an ellipsis and the last three", () => {
    expect(
      buildFolderCrumbs(["S", "D", "A", "B"], "R", [pathEntry("X")]),
    ).toMatchObject([
      { name: "S", depth: null },
      { key: "ellipsis", name: "…", depth: null },
      { name: "B", depth: null },
      { name: "R", depth: 0 },
      { name: "X", depth: null },
    ]);
  });

  it("keeps the depths of the crumbs that survive a collapse", () => {
    expect(
      buildFolderCrumbs(
        ["S", "D"],
        "R",
        [pathEntry("X"), pathEntry("Y"), pathEntry("Z")],
      ),
    ).toMatchObject([
      { name: "S", depth: null },
      { key: "ellipsis", name: "…", depth: null },
      { name: "X", depth: 1 },
      { name: "Y", depth: 2 },
      { name: "Z", depth: null },
    ]);
  });

  it("gives every crumb its own key even when names repeat", () => {
    const crumbs = buildFolderCrumbs(
      ["Site", "Documents", "Documents"],
      "Documents",
      [pathEntry("Documents")],
    );
    const keys = crumbs.map((crumb) => crumb.key);

    expect(new Set(keys).size).toBe(keys.length);
  });
});
