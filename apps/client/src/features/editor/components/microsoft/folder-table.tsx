import {
  ActionIcon,
  Anchor,
  Breadcrumbs,
  Button,
  Table,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import {
  IconChevronDown,
  IconChevronUp,
  IconCornerLeftUp,
  IconExternalLink,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { sanitizeMicrosoftFolderUrl } from "@docmost/editor-ext";
import type {
  M365FolderView,
  M365Item,
} from "@/features/microsoft/types/microsoft.types";
import { fileTypeIcon } from "@/features/microsoft/utils/file-type-icon";
import {
  microsoftApp,
  microsoftAppIcon,
} from "@/features/microsoft/utils/microsoft-app";
import { formattedDate, timeAgo } from "@/lib/time";
import { FOLDER_ITEM_LIMIT, FOLDER_PAGE_SIZE } from "./folder-table.constants";
import type {
  FolderCrumb,
  FolderSort,
  FolderSortColumn,
} from "./folder-table.types";
import {
  isPlainClick,
  modifiedTime,
  nextFolderSort,
  sortFolderItems,
} from "./folder-table.utils";
import classes from "./microsoft-folder.module.css";

const COLUMN_COUNT = 3;

// Shared so a folder name and a file name always look the same
const nameTextProps = { size: "sm", fw: 500 } as const;
const nameLinkProps = {
  ...nameTextProps,
  className: classes.nameLink,
} as const;

type Props = {
  view: M365FolderView;
  crumbs: FolderCrumb[];
  sort: FolderSort;
  parent: { name: string; depth: number } | null;
  onSortChange: (sort: FolderSort) => void;
  onNavigate: (depth: number) => void;
  onOpenFolder: (item: M365Item) => void;
  onOpenFile?: (item: M365Item) => void;
};

function ariaSort(sort: FolderSort, column: FolderSortColumn) {
  if (sort.column !== column) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

type RowProps = {
  item: M365Item;
  onOpenFolder: (item: M365Item) => void;
  onOpenFile?: (item: M365Item) => void;
};

function FolderRow({ item, onOpenFolder, onOpenFile }: RowProps) {
  const time = modifiedTime(item);
  const modified = time === undefined ? null : new Date(time);
  const fileUrl = sanitizeMicrosoftFolderUrl(item.webUrl);

  return (
    <Table.Tr className={classes.row}>
      <Table.Td>
        <div className={classes.nameCell}>
          {fileTypeIcon({
            name: item.name,
            mimeType: item.mimeType,
            kind: item.kind,
            size: 18,
          })}
          {item.kind === "folder" ? (
            <Anchor
              component="button"
              type="button"
              {...nameLinkProps}
              title={item.name}
              onClick={() => onOpenFolder(item)}
            >
              {item.name}
            </Anchor>
          ) : fileUrl ? (
            <Anchor
              href={fileUrl}
              target="_blank"
              rel="noopener"
              {...nameLinkProps}
              title={item.name}
              onClick={(event) => {
                if (!onOpenFile || !isPlainClick(event)) return;
                event.preventDefault();
                onOpenFile(item);
              }}
            >
              {item.name}
            </Anchor>
          ) : (
            <Text span truncate="end" {...nameTextProps} title={item.name}>
              {item.name}
            </Text>
          )}
        </div>
      </Table.Td>
      <Table.Td className={classes.metaCell}>
        {modified && (
          <span title={formattedDate(modified)}>{timeAgo(modified)}</span>
        )}
      </Table.Td>
      <Table.Td className={classes.metaCell}>{item.lastModifiedBy}</Table.Td>
    </Table.Tr>
  );
}

export function FolderTable({
  view,
  crumbs,
  sort,
  parent,
  onSortChange,
  onNavigate,
  onOpenFolder,
  onOpenFile,
}: Props) {
  const { t } = useTranslation();
  const { name } = view.folder;
  const folderUrl = sanitizeMicrosoftFolderUrl(view.folder.webUrl);
  const app = microsoftApp(view.folder.webUrl);

  const items = useMemo(
    () => sortFolderItems(view.items, sort),
    [view.items, sort],
  );
  const pageCount = Math.max(1, Math.ceil(items.length / FOLDER_PAGE_SIZE));

  // Reset during render, not in an effect, so a new folder or sort never paints a stale page
  const scope = `${view.folder.itemId}:${sort.column}:${sort.direction}`;
  const [paging, setPaging] = useState({ scope, page: 0 });
  if (paging.scope !== scope) setPaging({ scope, page: 0 });
  const page = Math.min(paging.page, pageCount - 1);
  const goToPage = (next: number) => setPaging({ scope, page: next });
  const onFirstPage = page === 0;
  const onLastPage = page === pageCount - 1;
  const pageItems = items.slice(
    page * FOLDER_PAGE_SIZE,
    (page + 1) * FOLDER_PAGE_SIZE,
  );

  const columns: { column: FolderSortColumn; label: string }[] = [
    { column: "name", label: t("Name") },
    { column: "modified", label: t("Modified") },
    { column: "modifiedBy", label: t("Modified By") },
  ];
  const sortChevron =
    sort.direction === "asc" ? (
      <IconChevronUp size={14} aria-hidden />
    ) : (
      <IconChevronDown size={14} aria-hidden />
    );

  return (
    <div className={classes.frame}>
      <div className={classes.header}>
        <span role="img" aria-label={app} className={classes.appIcon}>
          {microsoftAppIcon(app, 16)}
        </span>
        <Breadcrumbs separatorMargin={4} className={classes.breadcrumbs}>
          {crumbs.map(({ key, name: crumbName, depth }, index) =>
            depth === null ? (
              <Text
                key={key}
                span
                size="sm"
                fw={index === crumbs.length - 1 ? 500 : undefined}
                className={
                  index === crumbs.length - 1
                    ? classes.currentCrumb
                    : classes.secondary
                }
              >
                {crumbName}
              </Text>
            ) : (
              <Anchor
                key={key}
                component="button"
                type="button"
                size="sm"
                onClick={() => onNavigate(depth)}
              >
                {crumbName}
              </Anchor>
            ),
          )}
        </Breadcrumbs>
        {folderUrl && (
          <Tooltip label={t("Open in {{app}}", { app })} withArrow>
            <ActionIcon
              component="a"
              href={folderUrl}
              target="_blank"
              rel="noopener"
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={t("Open {{name}} in {{app}}", { name, app })}
            >
              <IconExternalLink size={16} />
            </ActionIcon>
          </Tooltip>
        )}
      </div>

      <div className={classes.tableScroll}>
        <Table
          className={classes.table}
          aria-label={t("Contents of {{name}}", { name })}
        >
          <Table.Thead>
            <Table.Tr>
              {columns.map(({ column, label }) => (
                <Table.Th key={column} aria-sort={ariaSort(sort, column)}>
                  <UnstyledButton
                    className={classes.sortButton}
                    onClick={() => onSortChange(nextFolderSort(sort, column))}
                  >
                    {label}
                    {sort.column === column && sortChevron}
                  </UnstyledButton>
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {parent && (
              <Table.Tr className={classes.row}>
                <Table.Td colSpan={COLUMN_COUNT} className={classes.goBackCell}>
                  <UnstyledButton
                    fz="sm"
                    fw={500}
                    className={classes.goBack}
                    onClick={() => onNavigate(parent.depth)}
                  >
                    <IconCornerLeftUp size={18} stroke={1.5} aria-hidden />
                    <span className={classes.goBackLabel}>
                      {t("Go back to {{name}}", { name: parent.name })}
                    </span>
                  </UnstyledButton>
                </Table.Td>
              </Table.Tr>
            )}
            {pageItems.map((item) => (
              <FolderRow
                key={`${item.driveId}:${item.itemId}`}
                item={item}
                onOpenFolder={onOpenFolder}
                onOpenFile={onOpenFile}
              />
            ))}
            {items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={COLUMN_COUNT} className={classes.emptyCell}>
                  {t("This folder is empty")}
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className={classes.footer}>
          <Button
            variant="default"
            size="xs"
            data-disabled={onFirstPage || undefined}
            aria-disabled={onFirstPage || undefined}
            aria-label={t("Previous page of {{name}}", { name })}
            onClick={() => {
              if (!onFirstPage) goToPage(page - 1);
            }}
          >
            {t("Previous")}
          </Button>
          <Text span size="sm">{`${page + 1} / ${pageCount}`}</Text>
          <Button
            variant="default"
            size="xs"
            data-disabled={onLastPage || undefined}
            aria-disabled={onLastPage || undefined}
            aria-label={t("Next page of {{name}}", { name })}
            onClick={() => {
              if (!onLastPage) goToPage(page + 1);
            }}
          >
            {t("Next")}
          </Button>
        </div>
      )}

      {view.truncated && (
        <Text size="xs" className={classes.note}>
          {t(
            "Showing the first {{limit}} items. Open in {{app}} to see everything.",
            { limit: FOLDER_ITEM_LIMIT.toLocaleString(), app },
          )}
        </Text>
      )}
    </div>
  );
}
