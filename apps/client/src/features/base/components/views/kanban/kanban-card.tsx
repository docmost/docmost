import { IBaseProperty, IBaseRow } from "@/features/base/types/base.types";
import classes from "@/features/base/styles/kanban.module.css";
import { useTranslation } from "react-i18next";

type KanbanCardProps = {
  row: IBaseRow;
  primaryProperty: IBaseProperty | undefined;
  onClick: (rowId: string) => void;
};

export function KanbanCard({ row, primaryProperty, onClick }: KanbanCardProps) {
  const { t } = useTranslation();
  const titleValue =
    primaryProperty
      ? ((row.cells ?? {})[primaryProperty.id] as string | undefined)
      : undefined;
  const titleText = titleValue?.trim().length ? titleValue : t("Untitled");
  const isEmpty = !titleValue?.trim().length;

  return (
    <div
      className={classes.card}
      role="button"
      tabIndex={0}
      onClick={() => onClick(row.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(row.id);
        }
      }}
    >
      <div
        className={
          classes.cardTitle + (isEmpty ? " " + classes.cardTitleEmpty : "")
        }
      >
        {titleText}
      </div>
    </div>
  );
}
