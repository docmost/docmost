import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Popover, ActionIcon, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useQuery } from "@tanstack/react-query";
import { IconX, IconFileDescription } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import clsx from "clsx";
import { IBaseProperty } from "@/features/base/types/base.types";
import { useResolvedPages } from "@/features/base/queries/base-page-resolver-query";
import { useBaseQuery } from "@/features/base/queries/base-query";
import { searchSuggestions } from "@/features/search/services/search-service";
import { buildPageUrl } from "@/features/page/page.utils";
import { useListKeyboardNav } from "@/features/base/hooks/use-list-keyboard-nav";
import cellClasses from "@/features/base/styles/cells.module.css";

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

export function CellPage({
  value,
  property,
  isEditing,
  onCommit,
  onCancel,
}: CellPageProps) {
  const pageId = parsePageId(value);
  const { data: base } = useBaseQuery(property.baseId);

  const ids = useMemo(() => (pageId ? [pageId] : []), [pageId]);
  const { pages } = useResolvedPages(ids);
  const resolvedPage = pageId ? pages.get(pageId) : undefined;

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
    // Still resolving — render an empty pill-shaped placeholder to avoid
    // the "Page not found" flicker on initial load.
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
  const title = page.title || "Untitled";
  const spaceSlug = page.space?.slug ?? "";
  const url = buildPageUrl(spaceSlug, page.slugId, title);

  return (
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
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 250);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  const trimmed = debouncedSearch.trim();
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
    staleTime: 15_000,
  });

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
    <Popover opened onClose={onCancel} position="bottom-start" width={320} trapFocus>
      <Popover.Target>
        <div style={{ width: "100%", height: "100%" }}>
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
                <IconFileDescription size={14} />
              )}
              <span className={cellClasses.personTagName}>
                {resolvedPage.title || "Untitled"}
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
          />
        </div>

        <div className={cellClasses.personDropdownDivider} />
        <div className={cellClasses.selectDropdown}>
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
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(page.id)}
              >
                {page.icon ? (
                  <span>{page.icon}</span>
                ) : (
                  <IconFileDescription size={14} />
                )}
                <span className={cellClasses.personOptionName}>
                  {page.title || "Untitled"}
                </span>
                {page.space?.name && (
                  <Text size="xs" c="dimmed" ml="auto" truncate>
                    {page.space.name}
                  </Text>
                )}
              </div>
            );
          })}
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}
