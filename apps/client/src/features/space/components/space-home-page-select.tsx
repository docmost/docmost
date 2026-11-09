import { useRef, useState } from "react";
import { Select, Text, Tooltip } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { modals } from "@mantine/modals";
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
  const clearButtonRef = useRef<HTMLButtonElement>(null);

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

  const getConfirmMessage = (value: string | null) => {
    if (!value) {
      return t(
        "Are you sure you want to remove '{{title}}' as the home page? The space overview will take its place.",
        { title: currentLabel },
      );
    }

    const title = options.find((option) => option.value === value)?.label;
    return currentId
      ? t(
          "Are you sure you want to make '{{title}}' the home page of this space?",
          { title },
        )
      : t(
          "Are you sure you want to make '{{title}}' the home page of this space? It will replace the space overview.",
          { title },
        );
  };

  const handleChange = (value: string | null) => {
    if (value === currentId) return;

    modals.openConfirmModal({
      title: value ? t("Set home page") : t("Remove home page"),
      children: <Text size="sm">{getConfirmMessage(value)}</Text>,
      centered: true,
      labels: { confirm: t("Confirm"), cancel: t("Cancel") },
      onConfirm: () =>
        updateSpaceMutation.mutate({ spaceId: space.id, homePageId: value }),
      // Put the saved home back in the input; a confirmed change replaces it on save.
      onClose: () => setSearchValue(currentId ? currentLabel : ""),
    });
  };

  return (
    <>
      <Select
        data={options}
        value={currentId}
        onChange={handleChange}
        placeholder={t("Space overview")}
        searchable
        clearable
        clearButtonProps={{ ref: clearButtonRef }}
        allowDeselect={false}
        openOnFocus={false}
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        filter={({ options }) => options}
        nothingFoundMessage={t("No results found")}
        variant="filled"
        disabled={readOnly}
        aria-label={t("Home page")}
      />
      <Tooltip
        label={t("Remove home page")}
        target={clearButtonRef}
        openDelay={250}
        withArrow
      />
    </>
  );
}
