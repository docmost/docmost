import { useState } from "react";
import { Select } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { useSearchSuggestionsQuery } from "@/features/search/queries/search-query";
import { useUpdateSpaceMutation } from "@/features/space/queries/space-query";
import { ISpace } from "@/features/space/types/space.types";

type SpaceHomePageSelectProps = {
  space: ISpace;
  readOnly?: boolean;
};

export default function SpaceHomePageSelect({
  space,
  readOnly,
}: SpaceHomePageSelectProps) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchValue, 300);
  const updateSpaceMutation = useUpdateSpaceMutation();

  const currentId = space.homePageId ?? null;
  const currentLabel = space.homePage
    ? space.homePage.title || t("Untitled")
    : t("Restricted page");

  const { data: suggestion } = useSearchSuggestionsQuery({
    query: currentId && debouncedQuery === currentLabel ? "" : debouncedQuery,
    includePages: true,
    spaceId: space.id,
    limit: 25,
    preload: !readOnly,
  });

  const options = (suggestion?.pages ?? [])
    .filter((page) => page.spaceId === space.id)
    .map((page) => ({ value: page.id, label: page.title || t("Untitled") }));

  if (currentId && !options.some((option) => option.value === currentId)) {
    options.unshift({
      value: currentId,
      label: currentLabel,
    });
  }

  const handleChange = (value: string | null) => {
    if (value === currentId) return;
    updateSpaceMutation.mutate({ spaceId: space.id, homePageId: value });
  };

  return (
    <Select
      data={options}
      value={currentId}
      onChange={handleChange}
      placeholder={t("Space overview")}
      searchable
      clearable
      allowDeselect={false}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      filter={({ options }) => options}
      nothingFoundMessage={t("No results found")}
      variant="filled"
      disabled={readOnly}
      aria-label={t("Home page")}
    />
  );
}
