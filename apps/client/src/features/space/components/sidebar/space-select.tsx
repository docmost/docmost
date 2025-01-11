import { useEffect, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { Avatar, Group, Select, SelectProps, Text } from "@mantine/core";
import { useGetSpacesQuery } from "@/features/space/queries/space-query.ts";
import { ISpace } from "../../types/space.types";
import { useTranslation } from "react-i18next";

interface SpaceSelectProps {
  onChange: (value: string) => void;
  value?: string;
  label?: string;
}

const renderSelectOption: SelectProps["renderOption"] = ({ option }) => (
  <Group gap="sm">
    <Avatar color="initials" variant="filled" name={option.label} size={20} />
    <div>
      <Text size="sm">{option.label}</Text>
    </div>
  </Group>
);

export function SpaceSelect({ onChange, label, value }: SpaceSelectProps) {
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
        (user) =>
          !data.find((existingUser) => existingUser.value === user.value),
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
      clearable
      variant="filled"
      onChange={onChange}
      nothingFoundMessage={t("No space found")}
      limit={50}
      checkIconPosition="right"
      comboboxProps={{ width: 300, withinPortal: false }}
      dropdownOpened
    />
  );
}
