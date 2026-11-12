import { ReactNode, useState } from "react";
import { Badge, Group, MultiSelect, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { AvatarIconType } from "@/features/attachments/types/attachment.types";
import { useLegalHoldSpacesQuery } from "@/ee/legal-hold/queries/legal-hold-query";
import type { LegalHoldSpaceView } from "@/ee/legal-hold/types/legal-hold.types";

const MAX_SPACES = 1000;

type SpaceMultiSelectProps = {
  value: string[];
  onChange: (value: string[]) => void;
  // the hold's current spaces, so their pills show names before any search
  initialSpaces: LegalHoldSpaceView[];
  error?: ReactNode;
};

export function SpaceMultiSelect({
  value,
  onChange,
  initialSpaces,
  error,
}: SpaceMultiSelectProps) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);
  const { data } = useLegalHoldSpacesQuery({
    query: debouncedSearch,
    limit: 50,
  });
  const [pickedSpaces, setPickedSpaces] = useState(
    () => new Map(initialSpaces.map((space) => [space.id, space])),
  );

  const results = data?.items ?? [];
  const spacesById = new Map([
    ...results.map((space) => [space.id, space] as const),
    ...pickedSpaces,
  ]);
  const options = [
    ...value.map((id) => pickedSpaces.get(id)).filter((space) => !!space),
    ...results.filter((space) => !value.includes(space.id)),
  ].map((space) => ({
    value: space.id,
    label: space.name || space.slug || t("Deleted space"),
  }));

  // search results change with every query, so remember what was picked
  const handleChange = (ids: string[]) => {
    setPickedSpaces((previous) => {
      const next = new Map(previous);
      results
        .filter((space) => ids.includes(space.id))
        .forEach((space) => next.set(space.id, space));
      return next;
    });
    onChange(ids);
  };

  return (
    <MultiSelect
      label={t("Spaces")}
      description={t("Everything in these spaces is kept.")}
      placeholder={t("Search for spaces")}
      nothingFoundMessage={t("No space found")}
      data={options}
      value={value}
      onChange={handleChange}
      error={error}
      searchable
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      // the server already matched names and slugs
      filter={({ options }) => options}
      hidePickedOptions
      maxValues={MAX_SPACES}
      maxDropdownHeight={300}
      renderOption={({ option }) => {
        const space = spacesById.get(option.value);
        return (
          <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <CustomAvatar
              color="initials"
              variant="filled"
              type={AvatarIconType.SPACE_ICON}
              avatarUrl={space?.logo}
              size={20}
              name={option.label}
              aria-hidden
            />
            <Text size="sm" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
              {option.label}
            </Text>
            {space?.archivedAt && (
              <Badge size="sm" variant="light" color="gray">
                {t("Archived")}
              </Badge>
            )}
          </Group>
        );
      }}
    />
  );
}
