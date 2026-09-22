import { sortPositionKeys } from "@/features/page/tree/utils/utils";

export type SubpagesSortBy = "default" | "title-asc" | "title-desc";

export type SubpageListItem = {
  id: string;
  slugId: string;
  title: string;
  icon?: string;
  position: string;
  hasChildren: boolean;
};

export function sortSubpages(
  items: SubpageListItem[],
  sortBy: SubpagesSortBy = "default"
) {
  const sortedItems = [...items];

  if (sortBy === "default") {
    return sortPositionKeys(sortedItems);
  }

  return sortedItems.sort((a, b) => {
    const result = (a.title || "").localeCompare(
      b.title || "",
      undefined,
      {
        sensitivity: "base",
      }
    );
    return sortBy === "title-desc" ? -result : result;
  });
}
