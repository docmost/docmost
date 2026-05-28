import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IBaseProperty, IBaseRow } from "@/features/base/types/base.types";
import { timeAgo } from "@/lib/time.ts";
import classes from "./row-detail-modal.module.css";

type RowDetailTitleProps = {
  row: IBaseRow;
  primaryProperty: IBaseProperty | undefined;
  canEdit: boolean;
  onCommit: (value: string) => void;
};

export function RowDetailTitle({
  row,
  primaryProperty,
  canEdit,
  onCommit,
}: RowDetailTitleProps) {
  const { t } = useTranslation();
  const initial = primaryProperty
    ? (((row.cells ?? {})[primaryProperty.id] as string) ?? "")
    : "";
  const [value, setValue] = useState(initial);

  // Re-sync if the underlying row changes (e.g. another client updated it).
  useEffect(() => {
    setValue(initial);
  }, [initial]);

  const updatedAgo = row.updatedAt ? timeAgo(new Date(row.updatedAt)) : "";
  // UUID7-derived display token: the last 4 hex chars are the random
  // tail of the UUID, so they distinguish rows that were created close
  // together better than the time prefix would.
  const idToken = row.id
    ? `#${row.id.replace(/-/g, "").slice(-4).toUpperCase()}`
    : "";

  return (
    <header className={classes.header}>
      {canEdit ? (
        <input
          autoFocus
          type="text"
          className={classes.titleInput}
          placeholder={t("Untitled")}
          value={value}
          onChange={(e) => setValue(e.currentTarget.value)}
          onBlur={() => {
            if (value !== initial) onCommit(value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.currentTarget as HTMLInputElement).blur();
            }
          }}
        />
      ) : (
        <h1 className={classes.titleStatic}>
          {value || t("Untitled")}
        </h1>
      )}
      <div className={classes.metaRow}>
        {updatedAgo && (
          <span>{t("Updated {{when}}", { when: updatedAgo })}</span>
        )}
        {updatedAgo && idToken && <span className={classes.metaDot} />}
        {idToken && <span>{idToken}</span>}
      </div>
    </header>
  );
}
