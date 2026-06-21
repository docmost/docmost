import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IBaseProperty, IBaseRow } from "@/ee/base/types/base.types";
import { timeAgo } from "@/lib/time.ts";
import classes from "@/ee/base/styles/row-detail-modal.module.css";

type RowDetailTitleProps = {
  row: IBaseRow;
  primaryProperty: IBaseProperty | undefined;
  canEdit: boolean;
  onCommit: (value: string) => void;
  onClose: () => void;
};

export function RowDetailTitle({
  row,
  primaryProperty,
  canEdit,
  onCommit,
  onClose,
}: RowDetailTitleProps) {
  const { t } = useTranslation();
  const initial = primaryProperty
    ? (((row.cells ?? {})[primaryProperty.id] as string) ?? "")
    : "";
  const [value, setValue] = useState(initial);

  // Re-sync when the row changes underneath us (navigation or remote edit).
  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const updatedAgo = row.updatedAt ? timeAgo(new Date(row.updatedAt)) : "";

  return (
    <header className={classes.header}>
      {canEdit ? (
        <input
          type="text"
          className={classes.titleInput}
          {...(!initial ? { "data-autofocus": true } : {})}
          placeholder={t("Untitled")}
          aria-label={primaryProperty?.name ?? t("Untitled")}
          value={value}
          maxLength={1000}
          onChange={(e) => setValue(e.currentTarget.value)}
          onBlur={() => {
            if (value !== initial) onCommit(value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
              onClose();
            }
          }}
        />
      ) : (
        <h1 className={classes.titleStatic}>{value || t("Untitled")}</h1>
      )}
      {updatedAgo && (
        <div className={classes.metaRow}>
          <span>{t("Updated {{when}}", { when: updatedAgo })}</span>
        </div>
      )}
    </header>
  );
}
