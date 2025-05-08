import { useEffect, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { Avatar, Group, Select, SelectProps, Text } from "@mantine/core";
import { useGetSpacesQuery } from "@/features/space/queries/space-query.ts";
import { ISpace } from "../../types/space.types";
import { useTranslation } from "react-i18next";

interface SpaceSelectProps {
  onChange: (value: ISpace) => void;
  value?: string;
  label?: string;
  width?: number;
  opened?: boolean;
  clearable?: boolean;
}

const renderSelectOption: SelectProps["renderOption"] = ({ option }) => (
  <Group gap="sm" wrap="nowrap">
    <Avatar color="initials" variant="filled" name={option.label} size={20} />
    <div>
      <Text size="sm" lineClamp={1}>
        {option.label}
      </Text>
    </div>
  </Group>
);

export function SpaceSelect({
  onChange,
  label,
  value,
  width,
  opened,
  clearable,
}: SpaceSelectProps) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchValue, 500);
  const { data: spaces, isLoading } = useGetSpacesQuery({
    query: debouncedQuery,
    limit: 50,
  });
  const [data, setData] = useState([]);

  useEffect(() => {
    if (spaces) {
      const spaceData = spaces?.items
        .filter((space: ISpace) => space.slug !== value)
        .map((space: ISpace) => {
          return {
            label: space.name,
            value: space.slug,
          };
        });

      const filteredSpaceData = spaceData.filter(
        (space) =>
          !data.find((existingSpace) => existingSpace.value === space.value),
      );
      setData((prevData) => [...prevData, ...filteredSpaceData]);
    }
  }, [spaces]);

  return (
    <Select
      data={data}
      renderOption={renderSelectOption}
      maxDropdownHeight={300}
      //label={label || 'Select space'}
      placeholder={t("Search for spaces")}
      searchable
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      clearable={clearable}
      variant="filled"
      onChange={(slug) =>
        onChange(spaces.items?.find((item) => item.slug === slug))
      }
      // duct tape
      onClick={(e) => e.stopPropagation()}
      nothingFoundMessage={t("No space found")}
      limit={50}
      checkIconPosition="right"
      comboboxProps={{ width, withinPortal: false }}
      dropdownOpened={opened}
    />
  );
}
