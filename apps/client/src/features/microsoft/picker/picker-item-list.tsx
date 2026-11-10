import { Checkbox, Loader, Text, UnstyledButton } from "@mantine/core";
import { IconChevronRight } from "@tabler/icons-react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { modifiedTime } from "@/features/editor/components/microsoft/folder-table.utils";
import { fileTypeIcon } from "@/features/microsoft/utils/file-type-icon";
import { M365Item } from "@/features/microsoft/types/microsoft.types";
import { timeAgo } from "@/lib/time";
import classes from "./picker.module.css";

export function itemKey(item: Pick<M365Item, "driveId" | "itemId">): string {
  return `${item.driveId}:${item.itemId}`;
}

type Props = {
  items: M365Item[];
  loading: boolean;
  selectedKeys: Set<string>;
  emptyLabel: string;
  onToggle: (item: M365Item) => void;
  onOpenFolder: (item: M365Item) => void;
};

export function PickerItemList({ items, loading, selectedKeys, emptyLabel, onToggle, onOpenFolder }: Props) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className={clsx(classes.list, classes.empty)}>
        <Loader size="sm" />
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className={clsx(classes.list, classes.empty)}>
        <Text size="sm" c="dimmed">
          {emptyLabel}
        </Text>
      </div>
    );
  }

  return (
    <div className={classes.list} role="listbox" aria-multiselectable>
      {items.map((item) => {
        const key = itemKey(item);
        const selected = selectedKeys.has(key);
        const isFolder = item.kind === "folder";
        const time = modifiedTime(item);
        const subtitle = [
          item.lastModifiedBy,
          time === undefined ? null : timeAgo(new Date(time)),
        ]
          .filter(Boolean)
          .join(" • ");

        return (
          <UnstyledButton
            key={key}
            role="option"
            aria-selected={selected}
            className={clsx(classes.row, selected && classes.rowSelected)}
            onClick={() => (isFolder ? onOpenFolder(item) : onToggle(item))}
          >
            {isFolder ? (
              <span style={{ width: 20 }} />
            ) : (
              <Checkbox
                checked={selected}
                readOnly
                tabIndex={-1}
                aria-label={t("Select {{name}}", { name: item.name })}
              />
            )}
            {fileTypeIcon({ name: item.name, mimeType: item.mimeType, kind: item.kind, size: 22 })}
            <div className={classes.rowMain}>
              <Text size="sm" fw={500} truncate>
                {item.name}
              </Text>
              {subtitle && (
                <Text size="xs" c="dimmed" truncate>
                  {subtitle}
                </Text>
              )}
            </div>
            {isFolder && <IconChevronRight size={16} stroke={1.5} />}
          </UnstyledButton>
        );
      })}
    </div>
  );
}
