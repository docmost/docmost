import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Popover } from "@mantine/core";
import { IconPlus, IconX } from "@tabler/icons-react";
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
  const { targetBaseId } = property.typeOptions as RelationTypeOptions;
  const [opened, setOpened] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // rows unlinked here, hidden until the rows stop listing them
  const [unlinkedIds, setUnlinkedIds] = useState<string[]>([]);
  const addLinkRef = useRef<HTMLButtonElement>(null);
  const rowHref = useRelationRowHref(targetBaseId);
  const updateLinks = useUpdateRelationLinksMutation(property.pageId);
  const list = useRelationRowsInfiniteQuery({
    pageId: property.pageId,
    rowId,
    propertyId: property.id,
    enabled: expanded,
  });
  const { hasNextPage, isFetching, isError, fetchNextPage, refetch } = list;
  const listData = expanded ? list.data : undefined;

  const linkedRows = useMemo(
    () => listData?.pages.flatMap((page) => page.items) ?? preview?.rows ?? [],
    [listData, preview],
  );

  useEffect(() => {
    setUnlinkedIds((ids) => ids.filter((id) => linkedRows.some((row) => row.id === id)));
  }, [linkedRows]);

  useEffect(() => {
    if (expanded && hasNextPage && !isFetching && !isError) fetchNextPage();
  }, [expanded, hasNextPage, isFetching, isError, fetchNextPage]);

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
  // after a failed request the button retries it
  const showAll = expanded ? isError && !isFetching : count > linkedRows.length;

  const chips = (
    <div className={classes.fieldChips}>
      {linkedRows
        .filter((row) => !unlinkedIds.includes(row.id))
        .map((row) => {
          const title = row.title || t("Untitled");
          const href = rowHref(row.id);
          return (
            <span key={row.id} className={clsx(cellClasses.badge, cellClasses.pagePill)}>
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
              {!readOnly && (
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
      {showAll && (
        <button
          type="button"
          className={classes.fieldChipButton}
          onClick={(e) => {
            e.stopPropagation();
            if (!expanded) setExpanded(true);
            else if (hasNextPage) fetchNextPage();
            else refetch();
          }}
        >
          {t("Show all ({{count}})", { count })}
        </button>
      )}
      {!readOnly && (
        // opens the picker through the shell's click
        <button
          ref={addLinkRef}
          type="button"
          className={classes.fieldChipButton}
          aria-haspopup="dialog"
          aria-expanded={opened}
        >
          <IconPlus size={12} />
          {t("Add a link")}
        </button>
      )}
    </div>
  );

  if (readOnly) {
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
      <Popover.Dropdown p={0} role="dialog" aria-label={property.name}>
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
