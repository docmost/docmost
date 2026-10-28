import type { M365Item } from "@/features/microsoft/types/microsoft.types";
import {
  FOLDER_MAX_CRUMBS,
  FOLDER_TAIL_CRUMBS,
} from "./folder-table.constants";
import type {
  FolderCrumb,
  FolderPathEntry,
  FolderSort,
  FolderSortColumn,
} from "./folder-table.types";

// Same order as localeCompare with these options, built once to keep a 1,000-item sort fast
const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

function modifiedTime(item: M365Item): number | undefined {
  const time = item.lastModifiedDateTime
    ? Date.parse(item.lastModifiedDateTime)
    : NaN;
  return Number.isNaN(time) ? undefined : time;
}

// A missing value sorts last whichever way the column is ordered
function compareOptional<T>(
  a: T | undefined,
  b: T | undefined,
  compare: (a: T, b: T) => number,
): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return compare(a, b);
}

export function sortFolderItems(
  items: M365Item[],
  sort: FolderSort,
): M365Item[] {
  const direction = sort.direction === "asc" ? 1 : -1;

  const compareColumn = (a: M365Item, b: M365Item): number => {
    switch (sort.column) {
      case "name":
        return collator.compare(a.name, b.name) * direction;
      case "modified":
        return compareOptional(
          modifiedTime(a),
          modifiedTime(b),
          (x, y) => (x - y) * direction,
        );
      case "modifiedBy":
        return compareOptional(
          a.lastModifiedBy || undefined,
          b.lastModifiedBy || undefined,
          (x, y) => collator.compare(x, y) * direction,
        );
    }
  };

  return [...items].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return compareColumn(a, b) || collator.compare(a.name, b.name);
  });
}

export function nextFolderSort(
  current: FolderSort,
  column: FolderSortColumn,
): FolderSort {
  if (current.column === column) {
    return { column, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { column, direction: column === "modified" ? "desc" : "asc" };
}

export function buildFolderCrumbs(
  trail: string[],
  rootName: string,
  path: FolderPathEntry[],
): FolderCrumb[] {
  const crumbs: FolderCrumb[] = [
    ...trail.map((name, index) => ({
      key: `trail-${index}`,
      name,
      depth: null,
    })),
    { key: "root", name: rootName, depth: 0 },
    ...path.map((entry, index) => ({
      key: `path-${index}`,
      name: entry.name,
      depth: index + 1,
    })),
  ].map((crumb, index, all) =>
    index === all.length - 1 ? { ...crumb, depth: null } : crumb,
  );

  if (crumbs.length <= FOLDER_MAX_CRUMBS) return crumbs;
  return [
    crumbs[0],
    { key: "ellipsis", name: "…", depth: null },
    ...crumbs.slice(-FOLDER_TAIL_CRUMBS),
  ];
}
