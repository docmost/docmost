import type { FolderSort } from "./folder-table.types";

export const FOLDER_PAGE_SIZE = 20;
export const FOLDER_ITEM_LIMIT = 1000;
export const FOLDER_MAX_CRUMBS = 5;
export const FOLDER_TAIL_CRUMBS = 3;
export const FOLDER_SKELETON_ROWS = 5;
export const FOLDER_SKELETON_NAME_WIDTHS = ["55%", "40%", "65%", "35%", "50%"];

export const DEFAULT_FOLDER_SORT: FolderSort = {
  column: "name",
  direction: "asc",
};
