import { Menu, Modal, Skeleton, Text, Tooltip } from "@mantine/core";
import { useWindowEvent } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { modals } from "@mantine/modals";
import {
  IconChevronDown,
  IconChevronUp,
  IconDotsVertical,
  IconLink,
  IconLock,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IBase, IBaseRow } from "@/ee/base/types/base.types";
import {
  useBaseRowQuery,
  useDeleteRowMutation,
  useUpdateRowMutation,
} from "@/ee/base/queries/base-row-query";
import { propertyMenuCloseRequestAtomFamily } from "@/ee/base/atoms/base-atoms";
import { getDescriptor } from "@/ee/base/property-types/property-type.registry";
import { useBaseEditable } from "@/ee/base/context/base-editable";
import { useClipboard } from "@/hooks/use-clipboard";
import { CreatePropertyPopover } from "@/ee/base/components/property/create-property-popover";
import { RowDetailTitle } from "./row-detail-title";
import { PropertyRow } from "./property-row";
import classes from "@/ee/base/styles/row-detail-modal.module.css";

type RowDetailModalProps = {
  base: IBase;
  rows: IBaseRow[];
  openRowId: string | null;
  onClose: () => void;
  onNavigate: (rowId: string) => void;
};

export function RowDetailModal({
  base,
  rows,
  openRowId,
  onClose,
  onNavigate,
}: RowDetailModalProps) {
  const { t } = useTranslation();
  const canEdit = useBaseEditable();
  const updateRowMutation = useUpdateRowMutation();
  const deleteRowMutation = useDeleteRowMutation();
  const clipboard = useClipboard({ timeout: 500 });

  const rowIndex = useMemo(
    () => (openRowId ? rows.findIndex((r) => r.id === openRowId) : -1),
    [openRowId, rows],
  );
  const rowFromList = rowIndex >= 0 ? rows[rowIndex] : undefined;
  // Deep links (?row=) can target rows outside the loaded pages or filtered
  // out of the active view — fetch by id instead of closing. Close only
  // when the server confirms the row is gone.
  const rowQuery = useBaseRowQuery(base.id, openRowId ?? undefined, {
    enabled: !!openRowId && !rowFromList,
  });
  const row = rowFromList ?? rowQuery.data;
  const primaryProperty = useMemo(
    () => base.properties.find((p) => p.isPrimary),
    [base.properties],
  );

  const rowMissing = !!openRowId && !rowFromList && rowQuery.isError;
  useEffect(() => {
    if (rowMissing) onClose();
  }, [rowMissing, onClose]);

  const isSaving = updateRowMutation.isPending;
  const opened = !!openRowId;

  // One field menu open at a time, mirroring the grid header's semantics.
  // The shared closeRequest atom asks an open dirty PropertyMenuContent to
  // run its discard-confirm flow instead of being torn down mid-edit.
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [newPropertyId, setNewPropertyId] = useState<string | null>(null);
  const clearNewProperty = useCallback(() => setNewPropertyId(null), []);
  const menuDirtyRef = useRef(false);
  const [closeRequest, setCloseRequest] = useAtom(
    propertyMenuCloseRequestAtomFamily(base.id),
  ) as unknown as [number, (val: number) => void];

  useEffect(() => {
    setOpenMenuId(null);
    menuDirtyRef.current = false;
  }, [openRowId]);

  const handleMenuDirtyChange = useCallback((dirty: boolean) => {
    menuDirtyRef.current = dirty;
  }, []);

  const requestMenuClose = useCallback(() => {
    if (menuDirtyRef.current) {
      setCloseRequest(closeRequest + 1);
    } else {
      setOpenMenuId(null);
    }
  }, [closeRequest, setCloseRequest]);

  const handleMenuOpenChange = useCallback(
    (propertyId: string, nextOpened: boolean) => {
      if (!nextOpened) {
        setOpenMenuId(null);
        menuDirtyRef.current = false;
        return;
      }
      if (openMenuId && openMenuId !== propertyId && menuDirtyRef.current) {
        setCloseRequest(closeRequest + 1);
        return;
      }
      setOpenMenuId(propertyId);
    },
    [openMenuId, closeRequest, setCloseRequest],
  );

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("[data-position]")) return;
      if (target.closest("[data-property-menu-target]")) return;
      requestMenuClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openMenuId, requestMenuClose]);

  const hasPrev = rowIndex > 0;
  const hasNext = rowIndex >= 0 && rowIndex < rows.length - 1;
  const navigate = useCallback(
    (delta: number) => {
      if (rowIndex === -1) return;
      const next = rows[rowIndex + delta];
      if (next) onNavigate(next.id);
    },
    [rows, rowIndex, onNavigate],
  );

  const handleCopyLink = useCallback(() => {
    clipboard.copy(window.location.href);
    notifications.show({ message: t("Link copied") });
  }, [clipboard, t]);

  const handleDeleteRecord = useCallback(() => {
    if (!row) return;
    const rowId = row.id;
    modals.openConfirmModal({
      title: t("Delete record?"),
      centered: true,
      children: <Text size="sm">{t("This action cannot be undone.")}</Text>,
      labels: { confirm: t("Delete"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => {
        deleteRowMutation.mutate({ rowId, pageId: base.id });
        onClose();
      },
    });
  }, [row, base.id, deleteRowMutation, onClose, t]);

  // Mantine's closeOnEscape runs a capture-phase window listener that fires
  // before inner popovers and inputs see the key, so we manage Esc ourselves
  // and yield to: nested dialogs (delete confirm), open popovers
  // ([data-position]) and editable elements. Arrows step records under the
  // same yield rules. Mantine puts role="dialog" and our content class on
  // the same element, which distinguishes this modal from nested ones.
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const isEscape = event.key === "Escape";
      const isArrow = event.key === "ArrowUp" || event.key === "ArrowDown";
      if ((!isEscape && !isArrow) || event.isComposing || !opened) return;
      const target = event.target as HTMLElement | null;
      if (target) {
        const dialog = target.closest('[role="dialog"]');
        if (dialog && !dialog.classList.contains(classes.modalContent)) {
          return;
        }
        if (
          target.closest("[data-position]") ||
          target.matches("input, textarea, select, [contenteditable='true']")
        ) {
          return;
        }
      }
      if (isEscape) {
        if (openMenuId) {
          requestMenuClose();
          return;
        }
        onClose();
        return;
      }
      if (openMenuId) return;
      event.preventDefault();
      navigate(event.key === "ArrowUp" ? -1 : 1);
    },
    [opened, openMenuId, requestMenuClose, onClose, navigate],
  );
  useWindowEvent("keydown", handleKeyDown, { capture: true });

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="lg"
      centered
      withCloseButton={false}
      closeOnEscape={false}
      closeOnClickOutside={!openMenuId}
      padding={0}
      radius="md"
      title={null}
      classNames={{ content: classes.modalContent }}
      removeScrollProps={{ noIsolation: true }}
    >
      {row ? (
        <>
          <div className={classes.topBar}>
            <div className={classes.topBarGroup}>
              <Tooltip label={t("Previous record")} openDelay={400}>
                <button
                  type="button"
                  className={classes.iconButton}
                  onClick={() => navigate(-1)}
                  disabled={!hasPrev}
                  aria-label={t("Previous record")}
                >
                  <IconChevronUp size={16} />
                </button>
              </Tooltip>
              <Tooltip label={t("Next record")} openDelay={400}>
                <button
                  type="button"
                  className={classes.iconButton}
                  onClick={() => navigate(1)}
                  disabled={!hasNext}
                  aria-label={t("Next record")}
                >
                  <IconChevronDown size={16} />
                </button>
              </Tooltip>
            </div>
            <div className={classes.topBarGroup}>
              <Menu position="bottom-end" shadow="md" withinPortal>
                <Menu.Target>
                  <button
                    type="button"
                    className={classes.iconButton}
                    aria-label={t("Record actions")}
                  >
                    <IconDotsVertical size={16} />
                  </button>
                </Menu.Target>
                <Menu.Dropdown>
                  <Menu.Item
                    leftSection={<IconLink size={14} />}
                    onClick={handleCopyLink}
                  >
                    {t("Copy link")}
                  </Menu.Item>
                  {canEdit && (
                    <>
                      <Menu.Divider />
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={handleDeleteRecord}
                      >
                        {t("Delete record")}
                      </Menu.Item>
                    </>
                  )}
                </Menu.Dropdown>
              </Menu>
              <button
                type="button"
                className={classes.iconButton}
                onClick={onClose}
                aria-label={t("Close")}
              >
                <IconX size={16} />
              </button>
            </div>
          </div>

          <RowDetailTitle
            row={row}
            primaryProperty={primaryProperty}
            canEdit={canEdit}
            onClose={onClose}
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
                    pageId={base.id}
                    autoFocusValue={property.id === newPropertyId}
                    onAutoFocused={clearNewProperty}
                    menuOpened={openMenuId === property.id}
                    onMenuOpenChange={(nextOpened) =>
                      handleMenuOpenChange(property.id, nextOpened)
                    }
                    onMenuDirtyChange={handleMenuDirtyChange}
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
              <CreatePropertyPopover
                pageId={base.id}
                properties={base.properties}
                onPropertyCreated={(p) => setNewPropertyId(p.id)}
                renderTarget={(open) => (
                  <button
                    type="button"
                    className={classes.addPropertyRow}
                    onClick={open}
                  >
                    <span className={classes.addPropertyLabel}>
                      <IconPlus size={15} />
                      {t("Add property")}
                    </span>
                  </button>
                )}
              />
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
              {rowIndex >= 0 && rows.length > 1 && (
                <>
                  <kbd className={classes.kbd}>↑</kbd>
                  <kbd className={classes.kbd}>↓</kbd>
                  <span>{t("to navigate")}</span>
                  <span className={classes.kbdSeparator} />
                </>
              )}
              <kbd className={classes.kbd}>Esc</kbd>
              <span>{t("to close")}</span>
            </div>
          </footer>
        </>
      ) : (
        <RowDetailSkeleton base={base} />
      )}
    </Modal>
  );
}

/** Hydration state for deep-linked rows: the schema is already loaded, so
 *  render the real labels and shimmer only the unknown values. Matching the
 *  final layout avoids a size jump when the row arrives. */
function RowDetailSkeleton({ base }: { base: IBase }) {
  return (
    <>
      <div className={classes.topBar}>
        <div className={classes.topBarGroup}>
          <Skeleton height={28} width={28} radius={6} />
          <Skeleton height={28} width={28} radius={6} />
        </div>
        <div className={classes.topBarGroup}>
          <Skeleton height={28} width={28} radius={6} />
          <Skeleton height={28} width={28} radius={6} />
        </div>
      </div>
      <header className={classes.header}>
        <Skeleton height={30} width="45%" radius={8} />
        <div className={classes.metaRow}>
          <Skeleton height={12} width={150} radius={4} />
        </div>
      </header>
      <div className={classes.body}>
        <div className={classes.propertyList}>
          {base.properties
            .filter((p) => !p.isPrimary)
            .map((property) => {
              const Icon = getDescriptor(property.type)?.icon;
              return (
                <div key={property.id} className={classes.propertyRow}>
                  <div className={classes.propertyLabel}>
                    {Icon && (
                      <Icon size={15} className={classes.propertyLabelIcon} />
                    )}
                    <span className={classes.propertyLabelText}>
                      {property.name}
                    </span>
                  </div>
                  <Skeleton
                    height={property.type === "longText" ? 82 : 34}
                    radius={7}
                    style={{ flex: 1 }}
                  />
                </div>
              );
            })}
        </div>
      </div>
    </>
  );
}
