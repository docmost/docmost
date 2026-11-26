import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Skeleton } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import {
  IconCornerDownLeft,
  IconFile,
  IconSearch,
  IconTable,
  IconX,
} from "@tabler/icons-react";
import { isAxiosError } from "axios";
import { Trans, useTranslation } from "react-i18next";
import clsx from "clsx";
import type {
  IBaseProperty,
  RelationPreview,
  RelationPreviewRow,
  RelationTypeOptions,
} from "@/ee/base/types/base.types";
import {
  useRelationRowsInfiniteQuery,
  useRelationSuggestionsInfiniteQuery,
  useUpdateRelationLinksMutation,
} from "@/ee/base/queries/base-relation-query";
import { useResolvedPages } from "@/ee/base/queries/base-page-resolver-query";
import { useInfiniteListKeyboardNav } from "@/ee/base/hooks/use-infinite-list-keyboard-nav";
import cellClasses from "@/ee/base/styles/cells.module.css";
import rowDetailClasses from "@/ee/base/styles/row-detail-modal.module.css";

type RelationPickerProps = {
  pageId: string;
  rowId: string;
  property: IBaseProperty;
  preview: RelationPreview | undefined;
  onClose: () => void;
  autoFocus?: boolean;
};

type PickerOption = { row: RelationPreviewRow; linked: boolean };

const isAccessError = (error: unknown) =>
  isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0);

export function RelationPicker({
  pageId,
  rowId,
  property,
  preview,
  onClose,
  autoFocus,
}: RelationPickerProps) {
  const { t } = useTranslation();
  const { targetBaseId, allowMultiple } = property.typeOptions as RelationTypeOptions;
  const listboxId = useId();
  const searchRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const query = debouncedSearch.trim();
  // links changed here, shown in their new section until both lists refetch
  const [changes, setChanges] = useState<ReadonlyMap<string, PickerOption>>(new Map());

  useEffect(() => {
    if (autoFocus) requestAnimationFrame(() => searchRef.current?.focus());
  }, [autoFocus]);

  const baseIds = useMemo(() => [targetBaseId], [targetBaseId]);
  const base = useResolvedPages(baseIds).pages.get(targetBaseId);
  const baseTitle = base?.title || t("Untitled");
  const searchLabel = t("Search {{base}}", { base: baseTitle });

  const enabled = !preview?.restricted;
  const linkedQuery = useRelationRowsInfiniteQuery({
    pageId,
    rowId,
    propertyId: property.id,
    query,
    enabled,
  });
  const suggestionsQuery = useRelationSuggestionsInfiniteQuery({
    pageId,
    propertyId: property.id,
    rowId,
    query,
    enabled,
  });
  const updateLinks = useUpdateRelationLinksMutation(pageId);

  const serverLinked = useMemo(
    () => linkedQuery.data?.pages.flatMap((page) => page.items),
    [linkedQuery.data],
  );
  // other rows wait below until every linked row is in, so the sections never interleave
  const linkedComplete = serverLinked !== undefined && !linkedQuery.hasNextPage;
  const noAccess =
    preview?.restricted ||
    isAccessError(linkedQuery.error) ||
    isAccessError(suggestionsQuery.error);
  const loading =
    linkedQuery.isPending || (linkedComplete && suggestionsQuery.isPending);

  const serverLinkedIds = new Set(serverLinked?.map((row) => row.id));
  const lowerQuery = query.toLowerCase();
  const linkedRows = [
    ...(serverLinked ?? []).filter((row) => changes.get(row.id)?.linked !== false),
    ...[...changes.values()]
      .filter(
        ({ row, linked }) =>
          linked && !serverLinkedIds.has(row.id) && row.title.toLowerCase().includes(lowerQuery),
      )
      .map(({ row }) => row),
  ];
  const addRows = linkedComplete
    ? (suggestionsQuery.data ?? []).filter((row) => changes.get(row.id)?.linked !== true)
    : [];
  const options: PickerOption[] = [
    ...linkedRows.map((row) => ({ row, linked: true })),
    ...addRows.map((row) => ({ row, linked: false })),
  ];
  // a partly loaded list shows the row's total, which says nothing about a search
  let linkedCount: number | undefined = linkedRows.length;
  if (linkedQuery.hasNextPage) linkedCount = query ? undefined : preview?.count;

  const hasMore = linkedQuery.hasNextPage || (linkedComplete && suggestionsQuery.hasNextPage);
  const { activeIndex, setActiveIndex, handleNavKey, setOptionRef, listEndRef } =
    useInfiniteListKeyboardNav(options.length, [query], {
      hasNextPage: hasMore,
      isFetching: linkedQuery.isFetching || suggestionsQuery.isFetching,
      fetchNextPage: linkedQuery.hasNextPage
        ? linkedQuery.fetchNextPage
        : suggestionsQuery.fetchNextPage,
    });
  const optionId = (index: number) => `${listboxId}-${index}`;

  const setLink = (row: RelationPreviewRow, linked: boolean) => {
    setChanges((prev) => new Map(prev).set(row.id, { row, linked }));
    const settle = () =>
      setChanges((prev) => {
        if (prev.get(row.id)?.linked !== linked) return prev;
        const next = new Map(prev);
        next.delete(row.id);
        return next;
      });
    updateLinks
      .mutateAsync({
        rowId,
        propertyId: property.id,
        ...(linked ? { add: [row.id] } : { remove: [row.id] }),
      })
      .then(settle, settle);
    if (linked && !allowMultiple) onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (handleNavKey(e)) return;
    if (e.key === "Enter") {
      const option = options[activeIndex];
      if (!option) return;
      e.preventDefault();
      setLink(option.row, !option.linked);
    }
  };

  const renderOption = ({ row, linked }: PickerOption, index: number) => {
    const active = index === activeIndex;
    return (
      <div
        key={row.id}
        id={optionId(index)}
        ref={setOptionRef(index)}
        role="option"
        aria-selected={linked}
        className={clsx(
          cellClasses.selectOption,
          cellClasses.relationOption,
          active && cellClasses.selectOptionKeyboardActive,
        )}
        onMouseEnter={() => setActiveIndex(index)}
        // keeps focus in the search box
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setLink(row, !linked)}
      >
        <span aria-hidden className={cellClasses.relationOptionIcon}>
          <IconFile size={12} stroke={1.75} />
        </span>
        <span className={cellClasses.relationOptionTitle}>{row.title || t("Untitled")}</span>
        {linked ? (
          <span className={cellClasses.relationOptionRemove} aria-hidden>
            <IconX size={14} />
          </span>
        ) : (
          active && (
            <span className={cellClasses.relationOptionHint} aria-hidden>
              <IconCornerDownLeft size={12} />
              {t("Link")}
            </span>
          )
        )}
      </div>
    );
  };

  const linkedLabelId = `${listboxId}-linked`;
  const addLabelId = `${listboxId}-add`;

  return (
    <>
      <div className={cellClasses.relationPickerSearch}>
        <IconSearch size={16} aria-hidden className={cellClasses.relationPickerSearchIcon} />
        <input
          ref={searchRef}
          className={cellClasses.relationPickerInput}
          role="combobox"
          aria-label={searchLabel}
          aria-expanded
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={options[activeIndex] ? optionId(activeIndex) : undefined}
          placeholder={searchLabel}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          data-autofocus={autoFocus || undefined}
        />
        <kbd className={rowDetailClasses.kbd} aria-hidden>
          Esc
        </kbd>
      </div>
      <div
        id={listboxId}
        role="listbox"
        aria-label={baseTitle}
        aria-multiselectable={allowMultiple || undefined}
        aria-busy={loading || undefined}
        className={cellClasses.relationPickerList}
      >
        {noAccess ? (
          <div className={cellClasses.relationPickerEmpty}>{t("No access")}</div>
        ) : loading ? (
          [72, 56, 64].map((width) => (
            <div key={width} className={cellClasses.relationOptionSkeleton} aria-hidden>
              <Skeleton height={20} width={20} radius="sm" />
              <Skeleton height={10} width={`${width}%`} radius="xl" />
            </div>
          ))
        ) : (
          <>
            {linkedRows.length > 0 && (
              <div role="group" aria-labelledby={linkedLabelId}>
                <div id={linkedLabelId} className={cellClasses.relationPickerGroupLabel}>
                  {t("Linked")}{" "}
                  {linkedCount !== undefined && (
                    <span className={cellClasses.relationPickerCount}>{linkedCount}</span>
                  )}
                </div>
                {linkedRows.map((row, index) => renderOption({ row, linked: true }, index))}
              </div>
            )}
            {addRows.length > 0 && (
              <div role="group" aria-labelledby={addLabelId}>
                <div id={addLabelId} className={cellClasses.relationPickerGroupLabel}>
                  <Trans
                    i18nKey="Add from <base/>"
                    components={{ base: <BaseName icon={base?.icon} title={baseTitle} /> }}
                  />
                </div>
                {addRows.map((row, index) =>
                  renderOption({ row, linked: false }, linkedRows.length + index),
                )}
              </div>
            )}
            {options.length === 0 && !hasMore && (
              <div className={cellClasses.relationPickerEmpty}>
                {linkedQuery.isError || suggestionsQuery.isError
                  ? t("Failed to load rows")
                  : query
                    ? t("No matching rows")
                    : t("No rows yet")}
              </div>
            )}
          </>
        )}
        {hasMore && !noAccess && (
          <div ref={listEndRef} aria-hidden className={cellClasses.selectDropdownEnd} />
        )}
      </div>
    </>
  );
}

// a prop, not children: Trans drops the children of a self-closing tag
function BaseName({ icon, title }: { icon?: string | null; title: string }) {
  return (
    <span className={cellClasses.relationPickerBase}>
      <span className={cellClasses.relationPickerBaseIcon} aria-hidden>
        {icon || <IconTable size={14} />}
      </span>
      <span className={cellClasses.relationPickerBaseTitle}>{title}</span>
    </span>
  );
}
