export type FolderSortColumn = "name" | "modified" | "modifiedBy";

export type FolderSort = {
  column: FolderSortColumn;
  direction: "asc" | "desc";
};

export type FolderPathEntry = { driveId: string; itemId: string; name: string };

// depth is the path length to navigate to; null means the crumb is not clickable
export type FolderCrumb = { key: string; name: string; depth: number | null };
