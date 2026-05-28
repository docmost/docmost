import { Modal, Text } from "@mantine/core";
import { useWindowEvent } from "@mantine/hooks";
import { IconDotsVertical, IconX, IconLock } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useCallback, useEffect, useMemo } from "react";
import {
  IBase,
  IBaseRow,
} from "@/features/base/types/base.types";
import { useUpdateRowMutation } from "@/features/base/queries/base-row-query";
import { CreatePropertyPopover } from "@/features/base/components/property/create-property-popover";
import { RowDetailTitle } from "./row-detail-title";
import { PropertyRow } from "./property-row";
import classes from "./row-detail-modal.module.css";

type RowDetailModalProps = {
  base: IBase;
  rows: IBaseRow[];
  openRowId: string | null;
  canEdit: boolean;
  onClose: () => void;
};

export function RowDetailModal({
  base,
  rows,
  openRowId,
  canEdit,
  onClose,
}: RowDetailModalProps) {
  const { t } = useTranslation();
  const updateRowMutation = useUpdateRowMutation();

  const row = useMemo(
    () => (openRowId ? rows.find((r) => r.id === openRowId) : undefined),
    [openRowId, rows],
  );
  const primaryProperty = useMemo(
    () => base.properties.find((p) => p.isPrimary),
    [base.properties],
  );

  // If a row was open and disappeared (deleted, filtered out, or not yet
  // loaded into the rows page), close the modal.
  const wasOpen = !!openRowId && !row;
  useEffect(() => {
    if (wasOpen) onClose();
  }, [wasOpen, onClose]);

  const isSaving = updateRowMutation.isPending;

  // Esc handling: Mantine v8 Modal's built-in `closeOnEscape` runs a
  // *capture-phase* `window` keydown listener (see
  // `@mantine/core/.../use-modal.mjs`), which fires before any inner
  // popover or cell input gets the keypress. The result: pressing Esc
  // inside an open cell popover (or any editable cell) would close the
  // whole modal instead of dismissing the popover.
  //
  // We turn the Modal's listener off and run our own, which yields to
  // anything that's currently editing: an open Mantine Popover dropdown
  // (it carries the `data-position` attribute Mantine sets on every
  // popover) or a native editable element (input, textarea,
  // contenteditable). Only when nothing inner claims Esc do we close
  // the modal.
  const opened = !!row;
  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing || !opened) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        if (
          target.closest("[data-position]") ||
          target.matches("input, textarea, select, [contenteditable='true']")
        ) {
          return;
        }
      }
      onClose();
    },
    [opened, onClose],
  );
  useWindowEvent("keydown", handleEscape, { capture: true });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      centered
      withCloseButton={false}
      closeOnEscape={false}
      padding={0}
      radius="md"
      title={null}
      classNames={{ content: classes.modalContent }}
    >
      {row ? (
        <>
          <div className={classes.closeButtonWrap}>
            <button
              type="button"
              className={classes.iconButton}
              aria-label={t("More")}
            >
              <IconDotsVertical size={16} />
            </button>
            <button
              type="button"
              className={classes.iconButton}
              onClick={onClose}
              aria-label={t("Close")}
            >
              <IconX size={16} />
            </button>
          </div>

          <RowDetailTitle
            row={row}
            primaryProperty={primaryProperty}
            canEdit={canEdit}
            onCommit={(value) => {
              if (!primaryProperty) return;
              updateRowMutation.mutate({
                rowId: row.id,
                pageId: base.id,
                cells: { [primaryProperty.id]: value },
              });
            }}
          />

          <div className={classes.body}>
            <div className={classes.propertyList}>
              {base.properties
                .filter((p) => !p.isPrimary)
                .map((property) => (
                  <PropertyRow
                    key={property.id}
                    property={property}
                    row={row}
                    canEdit={canEdit}
                    onUpdate={(propertyId, value) => {
                      updateRowMutation.mutate({
                        rowId: row.id,
                        pageId: base.id,
                        cells: { [propertyId]: value },
                      });
                    }}
                  />
                ))}
            </div>
            {canEdit && (
              <div className={classes.addPropertyWrap}>
                <CreatePropertyPopover
                  pageId={base.id}
                  properties={base.properties}
                  onPropertyCreated={() => {
                    // The base query invalidates on success — the new
                    // property will appear as a new <PropertyRow /> on
                    // next render. Nothing else to do.
                  }}
                />
              </div>
            )}
          </div>

          <footer className={classes.footer}>
            <div className={classes.footerStatus}>
              {!canEdit ? (
                <span className={classes.lockedHint}>
                  <IconLock size={12} />
                  {t("Read-only")}
                </span>
              ) : isSaving ? (
                <>
                  <span className={classes.savingDot} />
                  <span>{t("Saving…")}</span>
                </>
              ) : null}
            </div>
            <div className={classes.kbdHint}>
              <span>{t("Press")}</span>
              <kbd className={classes.kbd}>Esc</kbd>
              <span>{t("to close")}</span>
            </div>
          </footer>
        </>
      ) : (
        <Text c="dimmed" p="md">
          {t("Loading…")}
        </Text>
      )}
    </Modal>
  );
}
