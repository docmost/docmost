import React, { useEffect, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { Group, MultiSelect, MultiSelectProps, Text } from "@mantine/core";
import { IGroup } from "@/features/group/types/group.types.ts";
import { useSearchSuggestionsQuery } from "@/features/search/queries/search-query.ts";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { IUser } from "@/features/user/types/user.types.ts";
import { IconGroupCircle } from "@/components/icons/icon-people-circle.tsx";
import { useTranslation } from "react-i18next";

interface MultiMemberSelectProps {
  value?: string[];
  onChange: (value: string[]) => void;
  excludeIds?: string[];
}

const renderMultiSelectOption: MultiSelectProps["renderOption"] = ({
  option,
}) => (
  <Group gap="sm" wrap="nowrap">
    {option["type"] === "user" && (
      <CustomAvatar
        avatarUrl={option["avatarUrl"]}
        size={20}
        name={option.label}
      />
    )}
    {option["type"] === "group" && <IconGroupCircle />}
    <div>
      <Text size="sm" lineClamp={1}>{option.label}</Text>
      {option["type"] === "user" && option["email"] && (
        <Text size="xs" c="dimmed" lineClamp={1}>{option["email"]}</Text>
      )}
    </div>
  </Group>
);

export function MultiMemberSelect({ value, onChange, excludeIds = [] }: MultiMemberSelectProps) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchValue, 500);
  const { data: suggestion, isLoading } = useSearchSuggestionsQuery({
    query: debouncedQuery,
    includeUsers: true,
    includeGroups: true,
  });
  const [data, setData] = useState([]);

  useEffect(() => {
    if (suggestion) {
      // Extract user and group items
      const userItems = suggestion?.users.map((user: IUser) => ({
        value: `user-${user.id}`,
        label: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl,
        type: "user",
      }));

      const groupItems = suggestion?.groups.map((group: IGroup) => ({
        value: `group-${group.id}`,
        label: group.name,
        type: "group",
      }));

      // Create fresh data structure based on current search results, excluding existing members
      const filteredUserItems = userItems
        ? userItems.filter((u) => !excludeIds.includes(u.value))
        : [];
      const filteredGroupItems = groupItems
        ? groupItems.filter((g) => !excludeIds.includes(g.value))
        : [];

      const newData = [];
      
      if (filteredUserItems.length > 0) {
        newData.push({
          group: t("Select a user"),
          items: filteredUserItems,
        });
      }
      
      if (filteredGroupItems.length > 0) {
        newData.push({
          group: t("Select a group"),
          items: filteredGroupItems,
        });
      }

      setData(newData);
    }
  }, [suggestion, t]);

  return (
    <MultiSelect
      data={data}
      value={value}
      renderOption={renderMultiSelectOption}
      hidePickedOptions
      maxDropdownHeight={300}
      label={t("Add members")}
      placeholder={t("Search for users and groups")}
      searchable
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      filter={({ options }) => options}
      clearable
      variant="filled"
      onChange={onChange}
      maxValues={50}
    />
  );
}
