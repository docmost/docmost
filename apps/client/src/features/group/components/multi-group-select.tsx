import React, { useEffect, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { Group, MultiSelect, MultiSelectProps, Text } from "@mantine/core";
import { useGetGroupsQuery } from "@/features/group/queries/group-query.ts";
import { IGroup } from "@/features/group/types/group.types.ts";
import { IconUsersGroup } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

interface MultiGroupSelectProps {
  onChange: (value: string[]) => void;
  label?: string;
  description?: string;
  mt?: string;
}

const renderMultiSelectOption: MultiSelectProps["renderOption"] = ({
  option,
}) => (
  <Group gap="sm">
    {<IconUsersGroup size={18} />}
    <div>
      <Text size="sm">{option.label}</Text>
    </div>
  </Group>
);

export function MultiGroupSelect({
  onChange,
  label,
  description,
  mt,
}: MultiGroupSelectProps) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchValue, 500);
  const { data: groups, isLoading } = useGetGroupsQuery({
    query: debouncedQuery,
    limit: 25,
  });
  const [data, setData] = useState([]);

  useEffect(() => {
    if (groups) {
      const groupsData = groups?.items.map((group: IGroup) => {
        return {
          value: group.id,
          label: group.name,
        };
      });

      // Filter out existing users by their ids
      const filteredGroupData = groupsData.filter(
        (user) =>
          !data.find((existingUser) => existingUser.value === user.value),
      );

      // Combine existing data with new search data
      setData((prevData) => [...prevData, ...filteredGroupData]);
    }
  }, [groups]);

  return (
    <MultiSelect
      data={data}
      renderOption={renderMultiSelectOption}
      hidePickedOptions
      maxDropdownHeight={300}
      description={description}
      label={label || t("Add groups")}
      placeholder={t("Search for groups")}
      mt={mt}
      searchable
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      clearable
      variant="filled"
      onChange={onChange}
      nothingFoundMessage={t("No group found")}
      maxValues={50}
    />
  );
}
