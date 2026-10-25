import type { SubpagesSortBy } from "@docmost/editor-ext";
import { sortPositionKeys } from "@/features/page/tree/utils/utils";

export type SubpageListItem = {
  id: string;
  slugId: string;
  title: string;
  icon?: string;
  position: string;
  hasChildren: boolean;
  updatedAt?: Date | string;
};

export function sortSubpages(
  items: SubpageListItem[],
  sortBy: SubpagesSortBy,
): SubpageListItem[] {
  const sortedItems = [...items];

  if (sortBy === "title-asc") {
    return sortedItems.sort((a, b) =>
      (a.title || "").localeCompare(b.title || "", undefined, {
        sensitivity: "base",
        numeric: true,
      }),
    );
  }

  if (sortBy === "recent") {
    return sortedItems.sort(
      (a, b) =>
        new Date(b.updatedAt ?? 0).getTime() -
        new Date(a.updatedAt ?? 0).getTime(),
    );
  }

  return sortPositionKeys(sortedItems);
}
