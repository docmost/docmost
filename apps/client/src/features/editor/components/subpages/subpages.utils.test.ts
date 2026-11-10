import { describe, expect, it } from "vitest";
import { sortSubpages, type SubpageListItem } from "./subpages.utils";

// input order differs from every expected order
const pages: SubpageListItem[] = [
  {
    id: "a",
    slugId: "a",
    title: "Alpha",
    position: "a3",
    hasChildren: false,
    updatedAt: "2026-10-02T09:00:00.000Z",
  },
  { id: "c", slugId: "c", title: "charlie", position: "a2", hasChildren: false },
  {
    id: "d",
    slugId: "d",
    title: "Delta",
    position: "a1",
    hasChildren: true,
    updatedAt: "2026-10-01T09:00:00.000Z",
  },
  {
    id: "b",
    slugId: "b",
    title: "beta",
    position: "a0",
    hasChildren: false,
    updatedAt: "2026-10-03T09:00:00.000Z",
  },
];

const ids = (items: SubpageListItem[]) => items.map((item) => item.id);

describe("sortSubpages", () => {
  it("keeps the manual position order by default", () => {
    expect(ids(sortSubpages(pages, "default"))).toEqual(["b", "d", "c", "a"]);
  });

  it("sorts titles A to Z ignoring case", () => {
    expect(ids(sortSubpages(pages, "title-asc"))).toEqual(["a", "b", "c", "d"]);
  });

  it("sorts numbers inside titles by value", () => {
    const chapters = ["Chapter 10", "Chapter 2", "Chapter 1"].map(
      (title, index) => ({
        id: title,
        slugId: title,
        title,
        position: `a${index}`,
        hasChildren: false,
      }),
    );

    expect(ids(sortSubpages(chapters, "title-asc"))).toEqual([
      "Chapter 1",
      "Chapter 2",
      "Chapter 10",
    ]);
  });

  it("puts the most recently updated first and undated pages last", () => {
    expect(ids(sortSubpages(pages, "recent"))).toEqual(["b", "a", "d", "c"]);
  });

  it("falls back to the manual order for an unknown sort value", () => {
    expect(ids(sortSubpages(pages, "title-desc" as never))).toEqual([
      "b",
      "d",
      "c",
      "a",
    ]);
  });

  it("does not reorder the input array", () => {
    sortSubpages(pages, "recent");
    sortSubpages(pages, "default");
    expect(ids(pages)).toEqual(["a", "c", "d", "b"]);
  });
});
