import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Popover, ActionIcon, Text, Tooltip } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { IconX, IconFileDescription } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import { IBaseProperty } from "@/ee/base/types/base.types";
import { useResolvePage } from "@/ee/base/reference/reference-store";
import { useBaseQuery } from "@/ee/base/queries/base-query";
import { searchSuggestions } from "@/features/search/services/search-service";
import { buildPageUrl, getPageTitle } from "@/features/page/page.utils";
import { usePageQuery } from "@/features/page/queries/page-query";
import { extractPageSlugId } from "@/lib";
import { useListKeyboardNav } from "@/ee/base/hooks/use-list-keyboard-nav";
import cellClasses from "@/ee/base/styles/cells.module.css";

type CellPageProps = {
  value: unknown;
  property: IBaseProperty;
  rowId: string;
  isEditing: boolean;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

type PageSuggestion = {
  id: string;
  slugId: string;
  title: string | null;
  icon: string | null;
  spaceId: string;
  space?: { id: string; slug: string; name: string } | null;
};

function parsePageId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  return null;
}

function parsePastedPageSlugId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  let path = trimmed;
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      path = new URL(trimmed).pathname;
    } catch {
      return null;
    }
  }
  const match = path.match(/\/p\/([^/?#]+)/);
  if (!match) return null;
  return extractPageSlugId(match[1]) ?? null;
}

export function CellPage({
  value,
  property,
  isEditing,
  onCommit,
  onCancel,
}: CellPageProps) {
  const pageId = parsePageId(value);
  const { data: base } = useBaseQuery(property.pageId);

  const resolvedPage = useResolvePage(property.pageId, pageId);

  if (isEditing) {
    return (
      <PagePicker
        pageId={pageId}
        resolvedPage={resolvedPage ?? null}
        spaceId={base?.spaceId}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );
  }

  if (!pageId) {
    return <span className={cellClasses.emptyValue} />;
  }

  if (resolvedPage === undefined) {
    // placeholder to avoid "Page not found" flicker on initial load
    return <span className={cellClasses.emptyValue} />;
  }

  if (resolvedPage === null) {
    return (
      <span className={cellClasses.pageMissing}>
        <IconFileDescription size={14} />
        <span>Page not found</span>
      </span>
    );
  }

  return <PagePill page={resolvedPage} />;
}

type PillPage = {
  slugId: string;
  title: string | null;
  icon: string | null;
  space: { slug: string } | null;
};

function PagePill({ page }: { page: PillPage }) {
  const { t } = useTranslation();
  const title = getPageTitle(page.title, undefined, t);
  const spaceSlug = page.space?.slug ?? "";
  const url = buildPageUrl(spaceSlug, page.slugId, title);

  return (
    <Tooltip label={title} withinPortal openDelay={400} disabled={!title}>
      <Link
        to={url}
        className={cellClasses.pagePill}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {page.icon ? (
          <span className={cellClasses.pagePillIcon}>{page.icon}</span>
        ) : (
          <IconFileDescription size={14} className={cellClasses.pagePillIconFallback} />
        )}
        <span className={cellClasses.pagePillText}>{title}</span>
      </Link>
    </Tooltip>
  );
}

type PagePickerProps = {
  pageId: string | null;
  resolvedPage: { id: string; slugId: string; title: string | null; icon: string | null; space: { id: string; slug: string; name: string } | null } | null;
  spaceId?: string;
  onCommit: (value: unknown) => void;
  onCancel: () => void;
};

function PagePicker({
  pageId,
  resolvedPage,
  spaceId,
  onCommit,
  onCancel,
}: PagePickerProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  const trimmed = debouncedSearch.trim();

  const pastedSlugId = useMemo(
    () => parsePastedPageSlugId(debouncedSearch),
    [debouncedSearch],
  );

  const { data: suggestions = [] } = useQuery({
    queryKey: ["bases", "pages", "search", trimmed, spaceId ?? ""],
    queryFn: async () => {
      const res = await searchSuggestions({
        query: trimmed,
        includePages: true,
        spaceId,
        limit: trimmed ? 25 : 5,
      });
      return (res.pages ?? []) as PageSuggestion[];
    },
    enabled: !pastedSlugId,
    staleTime: 15_000,
  });

  // Once the pasted link resolves via slugId lookup, commit and close.
  const { data: linkedPage, isFetching: resolvingLink } = usePageQuery(
    pastedSlugId ? { pageId: pastedSlugId } : {},
  );
  const linkedRef = useRef(false);
  useEffect(() => {
    if (!pastedSlugId) {
      linkedRef.current = false;
      return;
    }
    if (linkedPage && !linkedRef.current) {
      linkedRef.current = true;
      onCommit(linkedPage.id);
    }
  }, [pastedSlugId, linkedPage, onCommit]);

  const { activeIndex, setActiveIndex, handleNavKey, setOptionRef } =
    useListKeyboardNav(suggestions.length, [debouncedSearch]);

  const handleSelect = useCallback(
    (id: string) => {
      onCommit(id === pageId ? null : id);
    },
    [pageId, onCommit],
  );

  const handleRemove = useCallback(() => {
    onCommit(null);
  }, [onCommit]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
        return;
      }
      if (handleNavKey(e)) return;
      if (e.key === "Enter") {
        if (activeIndex < 0 || activeIndex >= suggestions.length) return;
        e.preventDefault();
        handleSelect(suggestions[activeIndex].id);
      }
    },
    [onCancel, handleNavKey, activeIndex, suggestions, handleSelect],
  );

  return (
    <Popover
      opened
      onChange={(o) => {
        if (!o) onCancel();
      }}
      onClose={onCancel}
      position="bottom-start"
      width={320}
      trapFocus
      closeOnClickOutside
      closeOnEscape
      hideDetached={false}
    >
      <Popover.Target>
        <div className={cellClasses.popoverTarget}>
          {resolvedPage ? <PagePill page={resolvedPage} /> : <span className={cellClasses.emptyValue} />}
        </div>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <div className={cellClasses.personTagArea}>
          {pageId && resolvedPage && (
            <span className={cellClasses.personTag}>
              {resolvedPage.icon ? (
                <span>{resolvedPage.icon}</span>
              ) : (
                <IconFileDescription
                  size={14}
                  color="var(--mantine-color-dimmed)"
                />
              )}
              <span className={cellClasses.personTagName}>
                {getPageTitle(resolvedPage.title, undefined, t)}
              </span>
              <button
                type="button"
                className={cellClasses.personTagRemove}
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
              >
                <IconX size={10} />
              </button>
            </span>
          )}
          <input
            ref={searchRef}
            className={cellClasses.personTagInput}
            placeholder={pageId ? "" : "Search for a page..."}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            onKeyDown={handleKeyDown}
            data-autofocus
          />
        </div>

        <div className={cellClasses.personDropdownDivider} />
        <div className={cellClasses.selectDropdown}>
          {pastedSlugId ? (
            <div className={cellClasses.personDropdownHint}>
              {resolvingLink || linkedPage ? "Linking page…" : "Page not found"}
            </div>
          ) : (
            <>
          {suggestions.length === 0 && (
            <div className={cellClasses.personDropdownHint}>
              {trimmed ? "No pages found" : "No pages yet"}
            </div>
          )}
          {suggestions.map((page, idx) => {
            const isSelected = page.id === pageId;
            return (
              <div
                key={page.id}
                ref={setOptionRef(idx)}
                className={clsx(
                  cellClasses.selectOption,
                  isSelected && cellClasses.selectOptionActive,
                  idx === activeIndex && cellClasses.selectOptionKeyboardActive,
                )}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => handleSelect(page.id)}
              >
                {page.icon ? (
                  <span>{page.icon}</span>
                ) : (
                  <IconFileDescription
                    size={14}
                    color="var(--mantine-color-dimmed)"
                  />
                )}
                <div className={cellClasses.pageOptionText}>
                  <span className={cellClasses.personOptionName}>
                    {getPageTitle(page.title, undefined, t)}
                  </span>
                  {page.space?.name && (
                    <Text size="xs" c="dimmed" truncate>
                      {page.space.name}
                    </Text>
                  )}
                </div>
              </div>
            );
          })}
            </>
          )}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
