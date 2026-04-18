import { memo } from "react";
import { Transition } from "@mantine/core";
import { IconTrash, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useRowSelection } from "@/features/base/hooks/use-row-selection";
import { useDeleteSelectedRows } from "@/features/base/hooks/use-delete-selected-rows";
import classes from "@/features/base/styles/grid.module.css";

type SelectionActionBarProps = {
  baseId: string;
};

export const SelectionActionBar = memo(function SelectionActionBar({
  baseId,
}: SelectionActionBarProps) {
  const { t } = useTranslation();
  const { selectionCount, clear } = useRowSelection();
  const { deleteSelected, isPending } = useDeleteSelectedRows(baseId);

  const isOpen = selectionCount > 0;

  return (
    <Transition mounted={isOpen} transition="slide-up" duration={150}>
      {(styles) => (
        <div className={classes.selectionActionBarWrapper} style={styles}>
          <div className={classes.selectionActionBar} role="toolbar">
            <span className={classes.selectionActionBarCount}>
              {t("{{count}} selected", { count: selectionCount })}
            </span>
            <button
              type="button"
              className={classes.selectionActionBarDelete}
              disabled={isPending}
              onClick={() => void deleteSelected()}
            >
              <IconTrash size={14} />
              {t("Delete")}
            </button>
            <button
              type="button"
              className={classes.selectionActionBarClose}
              onClick={clear}
              aria-label={t("Clear selection")}
            >
              <IconX size={14} />
            </button>
          </div>
        </div>
      )}
    </Transition>
  );
});
