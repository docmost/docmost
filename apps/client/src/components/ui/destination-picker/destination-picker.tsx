import { useState, useCallback } from "react";
import { TextInput, ScrollArea, Loader } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch, IconFile } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import { useSearchSuggestionsQuery } from "@/features/search/queries/search-query";
import { ISpace } from "@/features/space/types/space.types";
import { IPage } from "@/features/page/types/page.types";
import { DestinationSelection } from "./destination-picker.types";
import { SpaceRow } from "./space-row";
import classes from "./destination-picker.module.css";

type DestinationPickerProps = {
  onSelectionChange: (selection: DestinationSelection | null) => void;
  excludePageId?: string;
  pageLimit?: number;
};

export function DestinationPicker({
  onSelectionChange,
  excludePageId,
  pageLimit = 15,
}: DestinationPickerProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [selection, setSelection] = useState<DestinationSelection | null>(null);
  const [debouncedQuery] = useDebouncedValue(searchQuery, 300);

  const { data: spacesData, isLoading: spacesLoading } = useGetSpacesQuery({
    limit: 100,
  });

  const searchEnabled = debouncedQuery && debouncedQuery.length >= 2;

  const { data: searchData, isLoading: searchLoading } =
    useSearchSuggestionsQuery({
      query: searchEnabled ? debouncedQuery : "",
      includePages: true,
      limit: 20,
    });

  const isSearching = !!searchEnabled;

  const selectedId =
    selection?.type === "space" ? selection.spaceId : selection?.pageId ?? null;

  const updateSelection = useCallback(
    (next: DestinationSelection | null) => {
      setSelection(next);
      onSelectionChange(next);
    },
    [onSelectionChange],
  );

  const handleSearchResultClick = (page: Partial<IPage>) => {
    if (!page.space || !page.id) return;

    updateSelection({
      type: "page",
      spaceId: page.space.id,
      pageId: page.id,
      page,
      space: page.space,
    });
    setSearchQuery("");
  };

  const handleSelectSpace = useCallback(
    (space: ISpace) => {
      updateSelection({ type: "space", spaceId: space.id, space });
    },
    [updateSelection],
  );

  const handleSelectPage = useCallback(
    (page: Partial<IPage>, space: ISpace) => {
      if (!page.id) return;
      updateSelection({
        type: "page",
        spaceId: page.spaceId ?? space.id,
        pageId: page.id,
        page,
        space,
      });
    },
    [updateSelection],
  );

  return (
    <>
      <TextInput
        leftSection={<IconSearch size={16} />}
        placeholder={t("Search pages and spaces...")}
        variant="filled"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.currentTarget.value)}
        className={classes.searchInput}
      />

      <ScrollArea h="50vh" offsetScrollbars className={classes.scrollArea}>
        {isSearching ? (
          searchLoading ? (
            <div className={classes.emptyState}>
              <Loader size="xs" />
            </div>
          ) : searchData?.pages && searchData.pages.length > 0 ? (
            searchData.pages.map(
              (page) =>
                page && (
                  <div
                    key={page.id}
                    className={classes.searchResult}
                    onClick={() => handleSearchResultClick(page)}
                  >
                    <div className={classes.iconWrapper}>
                      {page.icon ? (
                        page.icon
                      ) : (
                        <IconFile
                          size={16}
                          color="var(--mantine-color-gray-5)"
                        />
                      )}
                    </div>
                    <div className={classes.pageTitle}>
                      {page.title || t("Untitled")}
                    </div>
                    {page.space && (
                      <div className={classes.spaceName}>
                        {page.space.name}
                      </div>
                    )}
                  </div>
                ),
            )
          ) : (
            <div className={classes.emptyState}>{t("No results found")}</div>
          )
        ) : spacesLoading ? (
          <div className={classes.emptyState}>
            <Loader size="xs" />
          </div>
        ) : (
          spacesData?.items?.map((space) => (
            <SpaceRow
              key={space.id}
              space={space}
              limit={pageLimit}
              selectedId={selectedId}
              excludePageId={excludePageId}
              onSelectSpace={handleSelectSpace}
              onSelectPage={handleSelectPage}
            />
          ))
        )}
      </ScrollArea>

      {selection && (
        <div className={classes.selectedIndicator}>
          {selection.type === "space"
            ? selection.space.name
            : `${selection.space.name} / ${selection.page.title || t("Untitled")}`}
        </div>
      )}
    </>
  );
}
