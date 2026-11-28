import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Input, InputBase, Popover, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconChevronDown, IconFile, IconX } from "@tabler/icons-react";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import type {
  IBaseProperty,
  RelationPreviewRow,
  RelationTypeOptions,
} from "@/ee/base/types/base.types";
import {
  useRelationSuggestionsInfiniteQuery,
  useResolveRelationRows,
} from "@/ee/base/queries/base-relation-query";
import { useResolvedPages } from "@/ee/base/queries/base-page-resolver-query";
import { useInfiniteListKeyboardNav } from "@/ee/base/hooks/use-infinite-list-keyboard-nav";
import { RELATION_MAX_IDS_PER_CALL } from "@/ee/base/constants/relations";
import cellClasses from "@/ee/base/styles/cells.module.css";

type FilterRelationInputProps = {
  property: IBaseProperty;
  value: string[] | undefined;
  onChange: (ids?: string[]) => void;
  portalTarget?: HTMLElement | null;
};

export function FilterRelationInput({
  property,
  value,
  onChange,
  portalTarget,
}: FilterRelationInputProps) {
  const { t } = useTranslation();
  const { targetBaseId } = property.typeOptions as RelationTypeOptions;
  const ids = value ?? [];
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [opened, setOpened] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const query = debouncedSearch.trim();
  // titles of rows picked here, known before the resolve request answers
  const [pickedTitles, setPickedTitles] = useState<Record<string, string>>({});

  const baseIds = useMemo(() => [targetBaseId], [targetBaseId]);
  const targetBase = useResolvedPages(baseIds).pages.get(targetBaseId);
  const baseTitle = targetBase?.title || t("Untitled");
  const searchLabel = t("Search {{base}}", { base: baseTitle });

  const {
    data: suggestions,
    error,
    hasNextPage,
    isFetching,
    fetchNextPage,
  } = useRelationSuggestionsInfiniteQuery({
    pageId: property.pageId,
    propertyId: property.id,
    query,
    enabled: opened && targetBase !== null,
  });
  const {
    data: resolved,
    isLoading: resolving,
    isPlaceholderData,
  } = useResolveRelationRows({
    pageId: property.pageId,
    propertyId: property.id,
    rowIds: targetBase === null ? [] : ids,
  });
  const noAccess =
    targetBase === null ||
    (isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0));

  useEffect(() => {
    if (opened) requestAnimationFrame(() => searchRef.current?.focus());
    else setSearch("");
  }, [opened]);

  const titles = new Map(Object.entries(pickedTitles));
  for (const row of resolved?.items ?? []) titles.set(row.id, row.title);
  // once this selection has loaded, an id it left out belongs to a deleted row
  const selectionLoaded = resolved !== undefined && !isPlaceholderData;
  const shownIds = selectionLoaded ? ids : ids.filter((id) => titles.has(id));
  const titleOf = (id: string) =>
    titles.has(id) ? titles.get(id) || t("Untitled") : t("Deleted row");

  const options = (suggestions ?? []).filter((row) => !ids.includes(row.id));
  const atLimit = ids.length >= RELATION_MAX_IDS_PER_CALL;
  const { activeIndex, setActiveIndex, handleNavKey, setOptionRef, listEndRef } =
    useInfiniteListKeyboardNav(options.length, [query, opened], {
      hasNextPage,
      isFetching,
      fetchNextPage,
    });
  const optionId = (index: number) => `${listboxId}-${index}`;

  const emit = (nextIds: string[]) => onChange(nextIds.length > 0 ? nextIds : undefined);

  const select = (row: RelationPreviewRow) => {
    if (atLimit) return;
    setPickedTitles((prev) => ({ ...prev, [row.id]: row.title }));
    emit([...ids, row.id]);
    setSearch("");
  };

  const remove = (id: string) => emit(ids.filter((x) => x !== id));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpened(false);
      triggerRef.current?.focus();
      return;
    }
    if (handleNavKey(e)) return;
    if (e.key === "Enter") {
      const row = options[activeIndex];
      if (!row) return;
      e.preventDefault();
      select(row);
      return;
    }
    if (e.key === "Backspace" && search === "" && shownIds.length > 0) {
      e.preventDefault();
      remove(shownIds[shownIds.length - 1]);
    }
  };

  return (
    <Popover
      opened={opened && !noAccess}
      onChange={setOpened}
      position="bottom-start"
      width={260}
      withinPortal={!!portalTarget}
      portalProps={{ target: portalTarget ?? undefined }}
      closeOnEscape={false}
      closeOnClickOutside
    >
      <Popover.Target>
        <InputBase
          ref={triggerRef}
          component="button"
          type="button"
          size="xs"
          pointer
          multiline
          w={170}
          disabled={noAccess}
          rightSection={noAccess ? undefined : <IconChevronDown size={14} />}
          rightSectionPointerEvents="none"
          onClick={() => setOpened((o) => !o)}
        >
          {noAccess ? (
            <Text span size="xs" c="dimmed">
              {t("No access")}
            </Text>
          ) : shownIds.length > 0 ? (
            <span className={cellClasses.filterTriggerChips}>
              {shownIds.map((id) => (
                <span key={id} className={clsx(cellClasses.badge, cellClasses.pagePill)}>
                  <IconFile size={14} stroke={1.75} aria-hidden className={cellClasses.pagePillIconFallback} />
                  <span className={cellClasses.pagePillText}>{titleOf(id)}</span>
                </span>
              ))}
            </span>
          ) : resolving ? null : (
            <Input.Placeholder>{t("Select")}</Input.Placeholder>
          )}
        </InputBase>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <div className={cellClasses.personTagArea}>
          {shownIds.map((id) => {
            const title = titleOf(id);
            return (
              <span key={id} className={clsx(cellClasses.badge, cellClasses.pagePill)}>
                <IconFile size={14} stroke={1.75} aria-hidden className={cellClasses.pagePillIconFallback} />
                <span className={cellClasses.pagePillText}>{title}</span>
                <button
                  type="button"
                  className={clsx(cellClasses.personTagRemove, cellClasses.badgeRemoveBtn)}
                  aria-label={t("Remove {{name}}", { name: title })}
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(id);
                    searchRef.current?.focus();
                  }}
                >
                  <IconX size={10} />
                </button>
              </span>
            );
          })}
          <input
            ref={searchRef}
            className={cellClasses.personTagInput}
            role="combobox"
            aria-label={searchLabel}
            aria-expanded
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-activedescendant={options[activeIndex] ? optionId(activeIndex) : undefined}
            placeholder={shownIds.length === 0 ? searchLabel : ""}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div className={cellClasses.personDropdownDivider} />
        {atLimit && (
          <div role="status" className={cellClasses.personDropdownHint}>
            {t("Up to {{max}} rows", { max: RELATION_MAX_IDS_PER_CALL })}
          </div>
        )}
        <div
          id={listboxId}
          role="listbox"
          aria-label={baseTitle}
          aria-multiselectable
          className={cellClasses.selectDropdown}
        >
          {options.map((row, index) => (
            <div
              key={row.id}
              id={optionId(index)}
              ref={setOptionRef(index)}
              role="option"
              aria-selected={false}
              aria-disabled={atLimit || undefined}
              className={clsx(
                cellClasses.selectOption,
                index === activeIndex && cellClasses.selectOptionKeyboardActive,
                atLimit && cellClasses.selectOptionDisabled,
              )}
              onMouseEnter={() => setActiveIndex(index)}
              // keeps focus in the search box
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => select(row)}
            >
              <div className={cellClasses.personOptionText}>
                <span className={cellClasses.personOptionName}>
                  {row.title || t("Untitled")}
                </span>
              </div>
            </div>
          ))}
          {suggestions && options.length === 0 && !hasNextPage && (
            <div className={cellClasses.personDropdownHint}>{t("No matching rows")}</div>
          )}
          {hasNextPage && (
            <div ref={listEndRef} aria-hidden className={cellClasses.selectDropdownEnd} />
          )}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
