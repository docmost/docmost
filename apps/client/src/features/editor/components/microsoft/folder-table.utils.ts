import type { M365Item } from "@/features/microsoft/types/microsoft.types";
import { FOLDER_MAX_CRUMBS } from "./folder-table.constants";
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

// Modified and middle clicks keep the browser's own link handling
export function isPlainClick(
  event: Pick<
    MouseEvent,
    "button" | "metaKey" | "ctrlKey" | "shiftKey" | "altKey"
  >,
): boolean {
  return (
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function modifiedTime(item: M365Item): number | undefined {
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
  const trailCrumbs: FolderCrumb[] = trail.map((name, index) => ({
    key: `trail-${index}`,
    name,
    depth: null,
  }));
  const folderCrumbs: FolderCrumb[] = [
    { key: "root", name: rootName, depth: 0 },
    ...path.map((entry, index) => ({
      key: `path-${index}`,
      name: entry.name,
      depth: index + 1,
    })),
  ].map((crumb, index, all) =>
    index === all.length - 1 ? { ...crumb, depth: null } : crumb,
  );

  // The trail collapses first, down to one crumb; the embedded and current folders never collapse
  const trailRoom = Math.max(FOLDER_MAX_CRUMBS - folderCrumbs.length, 1);
  const shownTrail =
    trailCrumbs.length <= trailRoom
      ? trailCrumbs
      : [
          ...trailCrumbs.slice(0, trailRoom - 1),
          { key: "trail-ellipsis", name: "…", depth: null },
        ];

  const folderRoom = FOLDER_MAX_CRUMBS - shownTrail.length;
  const shownFolders =
    folderCrumbs.length <= folderRoom
      ? folderCrumbs
      : [
          folderCrumbs[0],
          { key: "path-ellipsis", name: "…", depth: null },
          ...folderCrumbs.slice(-(folderRoom - 2)),
        ];

  return [...shownTrail, ...shownFolders];
}
