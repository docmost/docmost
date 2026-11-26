import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconX } from "@tabler/icons-react";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import type {
  IBaseProperty,
  RelationPreview,
  RelationTypeOptions,
} from "@/ee/base/types/base.types";
import type { RelationCandidate } from "@/ee/base/services/base-relation-service";
import {
  useRelationCandidatesInfiniteQuery,
  useUpdateRelationLinksMutation,
} from "@/ee/base/queries/base-relation-query";
import { useResolvedPages } from "@/ee/base/queries/base-page-resolver-query";
import { useInfiniteListKeyboardNav } from "@/ee/base/hooks/use-infinite-list-keyboard-nav";
import cellClasses from "@/ee/base/styles/cells.module.css";

type RelationPickerProps = {
  pageId: string;
  rowId: string;
  property: IBaseProperty;
  preview: RelationPreview | undefined;
  onClose: () => void;
  autoFocus?: boolean;
};

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
  // links the user just changed, shown before the server answers
  const [linkedById, setLinkedById] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (autoFocus) requestAnimationFrame(() => searchRef.current?.focus());
  }, [autoFocus]);

  const baseIds = useMemo(() => [targetBaseId], [targetBaseId]);
  const baseTitle = useResolvedPages(baseIds).pages.get(targetBaseId)?.title || t("Untitled");
  const searchLabel = t("Search {{base}}", { base: baseTitle });

  const {
    data,
    error,
    hasNextPage,
    isFetching,
    fetchNextPage,
  } = useRelationCandidatesInfiniteQuery({
    pageId,
    propertyId: property.id,
    rowId,
    query,
    enabled: !preview?.restricted,
  });
  const candidates = data ?? [];
  const noAccess =
    preview?.restricted ||
    (isAxiosError(error) && [403, 404].includes(error.response?.status ?? 0));

  const updateLinks = useUpdateRelationLinksMutation(pageId);
  const chips = (preview?.rows ?? []).filter((row) => linkedById[row.id] !== false);
  const hiddenCount = (preview?.count ?? 0) - (preview?.rows.length ?? 0);

  const { activeIndex, setActiveIndex, handleNavKey, setOptionRef, listEndRef } =
    useInfiniteListKeyboardNav(candidates.length, [query], {
      hasNextPage,
      isFetching,
      fetchNextPage,
    });
  const optionId = (index: number) => `${listboxId}-${index}`;

  const isLinked = (candidate: RelationCandidate) =>
    linkedById[candidate.id] ?? candidate.linked === true;

  const setLink = (targetRowId: string, linked: boolean) => {
    setLinkedById((prev) => ({ ...prev, [targetRowId]: linked }));
    updateLinks
      .mutateAsync({
        rowId,
        propertyId: property.id,
        ...(linked ? { add: [targetRowId] } : { remove: [targetRowId] }),
      })
      .catch(() => setLinkedById(({ [targetRowId]: _failed, ...rest }) => rest));
    if (!allowMultiple) onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (handleNavKey(e)) return;
    if (e.key === "Enter") {
      const candidate = candidates[activeIndex];
      if (!candidate) return;
      e.preventDefault();
      setLink(candidate.id, !isLinked(candidate));
      return;
    }
    if (e.key === "Backspace" && search === "" && chips.length > 0) {
      e.preventDefault();
      setLink(chips[chips.length - 1].id, false);
    }
  };

  return (
    <>
      <div className={cellClasses.personTagArea}>
        {chips.map((row) => {
          const title = row.title || t("Untitled");
          return (
            <span key={row.id} className={clsx(cellClasses.badge, cellClasses.pagePill)}>
              <span className={cellClasses.pagePillText}>{title}</span>
              <button
                type="button"
                className={clsx(cellClasses.personTagRemove, cellClasses.badgeRemoveBtn)}
                aria-label={t("Remove {{name}}", { name: title })}
                onClick={(e) => {
                  e.stopPropagation();
                  setLink(row.id, false);
                  searchRef.current?.focus();
                }}
              >
                <IconX size={10} />
              </button>
            </span>
          );
        })}
        {hiddenCount > 0 && <span className={cellClasses.overflowCount}>+{hiddenCount}</span>}
        <input
          ref={searchRef}
          className={cellClasses.personTagInput}
          role="combobox"
          aria-label={searchLabel}
          aria-expanded
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={candidates[activeIndex] ? optionId(activeIndex) : undefined}
          placeholder={chips.length === 0 ? searchLabel : ""}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          onKeyDown={handleKeyDown}
          data-autofocus={autoFocus || undefined}
        />
      </div>
      <div className={cellClasses.personDropdownDivider} />
      <div
        id={listboxId}
        role="listbox"
        aria-label={baseTitle}
        aria-multiselectable={allowMultiple || undefined}
        className={cellClasses.selectDropdown}
      >
        {noAccess ? (
          <div className={cellClasses.personDropdownHint}>{t("No access")}</div>
        ) : (
          <>
            {candidates.map((candidate, index) => {
              const linked = isLinked(candidate);
              return (
                <div
                  key={candidate.id}
                  id={optionId(index)}
                  ref={setOptionRef(index)}
                  role="option"
                  aria-selected={linked}
                  className={clsx(
                    cellClasses.selectOption,
                    linked && cellClasses.selectOptionActive,
                    index === activeIndex && cellClasses.selectOptionKeyboardActive,
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  // keeps focus in the search box
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setLink(candidate.id, !linked)}
                >
                  <div className={cellClasses.personOptionText}>
                    <span className={cellClasses.personOptionName}>
                      {candidate.title || t("Untitled")}
                    </span>
                  </div>
                  {linked && (
                    <Text component="span" size="xs" c="dimmed">
                      {t("Linked")}
                    </Text>
                  )}
                </div>
              );
            })}
            {data && candidates.length === 0 && !hasNextPage && (
              <div className={cellClasses.personDropdownHint}>{t("No matching rows")}</div>
            )}
            {hasNextPage && (
              <div ref={listEndRef} aria-hidden className={cellClasses.selectDropdownEnd} />
            )}
          </>
        )}
      </div>
    </>
  );
}
