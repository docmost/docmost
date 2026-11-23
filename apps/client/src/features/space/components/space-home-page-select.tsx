import { ReactNode, useState } from "react";
import {
  Button,
  Center,
  CheckIcon,
  Combobox,
  Flex,
  Group,
  InputBase,
  ScrollArea,
  Text,
  useCombobox,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { modals } from "@mantine/modals";
import { IconHome, IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { AutoTooltipText } from "@/components/ui/auto-tooltip-text.tsx";
import { useSearchSuggestionsQuery } from "@/features/search/queries/search-query";
import { useUpdateSpaceMutation } from "@/features/space/queries/space-query";
import { ISpace } from "@/features/space/types/space.types";
import { getPageIcon } from "@/lib";

type SpaceHomePageSelectProps = {
  space: ISpace;
  readOnly?: boolean;
};

type HomeOption = {
  value: string;
  label: string;
  icon: ReactNode;
};

export default function SpaceHomePageSelect({
  space,
  readOnly,
}: SpaceHomePageSelectProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search.trim(), 300);
  const updateSpaceMutation = useUpdateSpaceMutation();

  const combobox = useCombobox({
    onDropdownOpen: () => combobox.focusSearchInput(),
    onDropdownClose: () => {
      combobox.resetSelectedOption();
      combobox.focusTarget();
      setSearch("");
    },
  });

  const { data: suggestion } = useSearchSuggestionsQuery({
    query: debouncedSearch,
    includePages: true,
    spaceId: space.id,
    limit: 25,
    preload: !readOnly,
  });

  const currentId = space.homePageId ?? null;
  const currentLabel = !currentId
    ? t("Space overview")
    : space.homePage
      ? space.homePage.title || t("Untitled")
      : t("Restricted page");
  const currentIcon = currentId ? (
    getPageIcon(space.homePage?.icon)
  ) : (
    <IconHome size={18} color="var(--mantine-color-gray-6)" aria-hidden="true" />
  );

  const pageOptions: HomeOption[] = (suggestion?.pages ?? [])
    .filter((page) => page.spaceId === space.id)
    .map((page) => ({
      value: page.id,
      label: page.title || t("Untitled"),
      icon: getPageIcon(page.icon),
    }));

  // Unfiltered, the current home leads the list.
  const options: HomeOption[] =
    debouncedSearch || !currentId
      ? pageOptions
      : [
          { value: currentId, label: currentLabel, icon: currentIcon },
          ...pageOptions.filter((option) => option.value !== currentId),
        ];

  const handleOptionSubmit = (value: string) => {
    combobox.closeDropdown();
    if (value === currentId) return;

    const title = options.find((option) => option.value === value)?.label;
    const message = currentId
      ? t(
          "Are you sure you want to make '{{title}}' the home page of this space?",
          { title },
        )
      : t(
          "Are you sure you want to make '{{title}}' the home page of this space? It will replace the space overview.",
          { title },
        );

    // Open once the dropdown has handed focus back to the button, so the dialog returns it there.
    setTimeout(() =>
      modals.openConfirmModal({
        title: t("Set home page"),
        children: <Text size="sm">{message}</Text>,
        centered: true,
        labels: { confirm: t("Confirm"), cancel: t("Cancel") },
        onConfirm: () =>
          updateSpaceMutation.mutate({ spaceId: space.id, homePageId: value }),
      }),
    );
  };

  const openResetModal = () =>
    modals.openConfirmModal({
      title: t("Reset home page"),
      children: (
        <Text size="sm">
          {t(
            "Are you sure you want to reset the home page? The space overview will replace '{{title}}'.",
            { title: currentLabel },
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Confirm"), cancel: t("Cancel") },
      onConfirm: () =>
        updateSpaceMutation.mutate(
          { spaceId: space.id, homePageId: null },
          // The Reset button goes away, so focus moves to the picker.
          { onSuccess: () => combobox.focusTarget() },
        ),
    });

  return (
    <Flex
      gap="xs"
      direction={{ base: "column", xs: "row" }}
      align={{ base: "flex-start", xs: "center" }}
    >
      <Combobox store={combobox} onOptionSubmit={handleOptionSubmit}>
        <Combobox.Target withAriaAttributes={false}>
          <InputBase
            component="button"
            type="button"
            pointer
            w={260}
            variant="filled"
            leftSection={currentIcon}
            rightSection={<Combobox.Chevron />}
            rightSectionPointerEvents="none"
            onClick={() => combobox.toggleDropdown()}
            disabled={readOnly}
            aria-label={t("Home page: {{title}}", { title: currentLabel })}
          >
            <AutoTooltipText
              span
              size="sm"
              display="block"
              tooltipProps={{ withinPortal: true }}
            >
              {currentLabel}
            </AutoTooltipText>
          </InputBase>
        </Combobox.Target>

        <Combobox.Dropdown>
          <Combobox.Search
            value={search}
            onChange={(event) => {
              combobox.updateSelectedOptionIndex();
              setSearch(event.currentTarget.value);
            }}
            leftSection={<IconSearch size={16} />}
            placeholder={t("Search pages...")}
            aria-label={t("Search pages...")}
          />
          <Combobox.Options>
            <ScrollArea.Autosize
              mah={220}
              type="scroll"
              scrollbars="y"
              scrollbarSize="var(--combobox-padding)"
              offsetScrollbars="y"
              // Autosize content grows to its widest line; cap it so long titles truncate.
              styles={{ content: { minWidth: 0 } }}
            >
              {options.length > 0 ? (
                options.map((option) => (
                  <Combobox.Option
                    value={option.value}
                    key={option.value}
                    active={option.value === currentId}
                  >
                    <Group gap="xs" wrap="nowrap">
                      <Center w={20}>{option.icon}</Center>
                      <AutoTooltipText
                        size="sm"
                        flex={1}
                        tooltipProps={{ withinPortal: true }}
                      >
                        {option.label}
                      </AutoTooltipText>
                      {option.value === currentId && (
                        <CheckIcon size={12} opacity={0.4} />
                      )}
                    </Group>
                  </Combobox.Option>
                ))
              ) : (
                <Combobox.Empty>{t("No results found")}</Combobox.Empty>
              )}
            </ScrollArea.Autosize>
          </Combobox.Options>
        </Combobox.Dropdown>
      </Combobox>

      {currentId && !readOnly && (
        <Button
          variant="default"
          onClick={openResetModal}
          aria-label={t("Reset home page")}
        >
          {t("Reset")}
        </Button>
      )}
    </Flex>
  );
}
