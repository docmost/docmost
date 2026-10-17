import { useEffect, useRef, useState } from "react";
import { useDebouncedCallback } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { IBaseProperty, IBaseRow } from "@/ee/base/types/base.types";
import { timeAgo } from "@/lib/time.ts";
import { AUTOSAVE_DELAY_MS } from "@/ee/base/constants/autosave";
import classes from "@/ee/base/styles/row-detail-modal.module.css";

type RowDetailTitleProps = {
  row: IBaseRow;
  primaryProperty: IBaseProperty | undefined;
  canEdit: boolean;
  onCommit: (value: string) => void;
  onEditingChange?: (editing: boolean) => void;
};

export function RowDetailTitle({
  row,
  primaryProperty,
  canEdit,
  onCommit,
  onEditingChange,
}: RowDetailTitleProps) {
  const { t } = useTranslation();
  const initial = primaryProperty
    ? (((row.cells ?? {})[primaryProperty.id] as string) ?? "")
    : "";
  const [value, setValue] = useState(initial);
  const focusedRef = useRef(false);

  const save = () => {
    if (value !== initial) onCommit(value);
  };
  const autosave = useDebouncedCallback(save, AUTOSAVE_DELAY_MS);

  const commit = () => {
    focusedRef.current = false;
    onEditingChange?.(false);
    autosave.cancel();
    save();
  };

  // Re-sync when the row changes underneath us (navigation or remote edit), but not mid-typing.
  useEffect(() => {
    if (!focusedRef.current) setValue(initial);
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
          onFocus={() => {
            focusedRef.current = true;
            onEditingChange?.(true);
          }}
          onChange={(e) => {
            setValue(e.currentTarget.value);
            autosave();
          }}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.currentTarget.blur();
            } else if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
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
