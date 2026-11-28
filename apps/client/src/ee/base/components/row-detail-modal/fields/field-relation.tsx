import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Popover } from "@mantine/core";
import { IconFile, IconPlus, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import type { RelationPreview, RelationTypeOptions } from "@/ee/base/types/base.types";
import { RelationPicker } from "@/ee/base/components/cells/relation-picker";
import { RelationReadList } from "@/ee/base/components/cells/relation-read-list";
import { useRelationRowHref } from "@/ee/base/hooks/use-relation-row-href";
import {
  useRelationRowsInfiniteQuery,
  useUpdateRelationLinksMutation,
} from "@/ee/base/queries/base-relation-query";
import { FieldProps, FieldShell } from "./detail-field";
import classes from "@/ee/base/styles/row-detail-modal.module.css";
import cellClasses from "@/ee/base/styles/cells.module.css";

type FieldRelationProps = FieldProps & { preview: RelationPreview | undefined };

export function FieldRelation({ property, rowId, readOnly, preview }: FieldRelationProps) {
  const { t } = useTranslation();
  const linksReadOnly = readOnly || !preview || preview.permissions?.canEdit === false;
  const { targetBaseId } = property.typeOptions as RelationTypeOptions;
  const [opened, setOpened] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // rows unlinked here, hidden until the rows stop listing them
  const [unlinkedIds, setUnlinkedIds] = useState<string[]>([]);
  // first chip a page request adds; keyboard focus moves to it once it renders
  const [focusChipIndex, setFocusChipIndex] = useState<number | null>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const addLinkRef = useRef<HTMLButtonElement>(null);
  const rowHref = useRelationRowHref(targetBaseId);
  const updateLinks = useUpdateRelationLinksMutation(property.pageId);
  const list = useRelationRowsInfiniteQuery({
    pageId: property.pageId,
    rowId,
    propertyId: property.id,
    enabled: expanded,
  });
  const { hasNextPage, isFetching, fetchNextPage, refetch } = list;
  const listData = expanded ? list.data : undefined;

  const linkedRows = useMemo(
    () => listData?.pages.flatMap((page) => page.items) ?? preview?.rows ?? [],
    [listData, preview],
  );

  useEffect(() => {
    setUnlinkedIds((ids) => ids.filter((id) => linkedRows.some((row) => row.id === id)));
  }, [linkedRows]);

  // runs before paint, so the control never shows between the new page and the hand-off
  useLayoutEffect(() => {
    if (focusChipIndex === null || !listData || isFetching) return;
    if (document.activeElement === moreRef.current) {
      chipsRef.current?.children[focusChipIndex]?.querySelector<HTMLElement>("a, button")?.focus();
    }
    setFocusChipIndex(null);
  }, [focusChipIndex, listData, isFetching]);

  if (preview?.restricted) {
    return (
      <FieldShell>
        <RelationReadList preview={preview} targetBaseId={targetBaseId} />
      </FieldShell>
    );
  }

  const unlink = (targetRowId: string) => {
    setUnlinkedIds((ids) => [...ids, targetRowId]);
    updateLinks
      .mutateAsync({ rowId, propertyId: property.id, remove: [targetRowId] })
      .catch(() => setUnlinkedIds((ids) => ids.filter((id) => id !== targetRowId)));
  };

  const closePicker = () => {
    setOpened(false);
    addLinkRef.current?.focus();
  };

  const count = preview?.count ?? 0;
  const visibleRows = linkedRows.filter((row) => !unlinkedIds.includes(row.id));
  // Show all until its first page is in (and retries it), then Show more while pages remain
  const moreToLoad = expanded ? !listData || hasNextPage : count > linkedRows.length;

  const chips = (
    <div ref={chipsRef} className={classes.fieldChips}>
      {visibleRows.map((row) => {
        const title = row.title || t("Untitled");
        const href = rowHref(row.id);
        return (
          <span
            key={row.id}
            className={clsx(cellClasses.badge, cellClasses.pagePill)}
          >
            <IconFile size={14} stroke={1.75} aria-hidden className={cellClasses.pagePillIconFallback} />
            {href ? (
              <Link
                to={href}
                className={clsx(cellClasses.pagePillText, classes.fieldChipLink)}
                aria-label={t("Open {{name}}", { name: title })}
                onClick={(e) => e.stopPropagation()}
              >
                {title}
              </Link>
            ) : (
              <span className={cellClasses.pagePillText}>{title}</span>
            )}
            {!linksReadOnly && (
              <button
                type="button"
                className={clsx(cellClasses.personTagRemove, cellClasses.badgeRemoveBtn)}
                aria-label={t("Remove {{name}}", { name: title })}
                onClick={(e) => {
                  e.stopPropagation();
                  unlink(row.id);
                }}
              >
                <IconX size={10} />
              </button>
            )}
          </span>
        );
      })}
      {(moreToLoad || focusChipIndex !== null) && (
        <button
          ref={moreRef}
          type="button"
          className={classes.fieldChipButton}
          aria-label={
            listData
              ? t("Show more rows for {{name}}", { name: property.name })
              : t("Show all {{count}} rows for {{name}}", { count, name: property.name })
          }
          aria-busy={isFetching || undefined}
          onClick={(e) => {
            e.stopPropagation();
            if (isFetching) return;
            setFocusChipIndex(visibleRows.length);
            if (!expanded) setExpanded(true);
            else if (!listData) refetch();
            else fetchNextPage();
          }}
        >
          {listData ? t("Show more") : t("Show all ({{count}})", { count })}
        </button>
      )}
      {!linksReadOnly && (
        // opens the picker through the shell's click
        <button
          ref={addLinkRef}
          type="button"
          className={classes.fieldChipButton}
          aria-label={t("Link a row for {{name}}", { name: property.name })}
          aria-haspopup="dialog"
          aria-expanded={opened}
        >
          <IconPlus size={12} />
          {t("Link a row")}
        </button>
      )}
    </div>
  );

  if (linksReadOnly) {
    return (
      <FieldShell role="group" aria-label={property.name}>
        {chips}
      </FieldShell>
    );
  }

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-start"
      width="target"
      shadow="md"
      withinPortal
      withRoles={false}
      trapFocus
      closeOnClickOutside
      closeOnEscape={false}
      hideDetached={false}
    >
      <Popover.Target>
        <FieldShell
          cursor="pointer"
          active={opened}
          role="group"
          aria-label={property.name}
          onClick={() => setOpened((o) => !o)}
        >
          {chips}
        </FieldShell>
      </Popover.Target>
      <Popover.Dropdown
        p={0}
        role="dialog"
        aria-label={t("Link rows for {{name}}", { name: property.name })}
      >
        <RelationPicker
          pageId={property.pageId}
          rowId={rowId}
          property={property}
          preview={preview}
          onClose={closePicker}
          autoFocus
        />
      </Popover.Dropdown>
    </Popover>
  );
}
