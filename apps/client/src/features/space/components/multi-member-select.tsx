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
  onChange: (value: string[]) => void;
}

const renderMultiSelectOption: MultiSelectProps["renderOption"] = ({
  option,
}) => (
  <Group gap="sm">
    {option["type"] === "user" && (
      <CustomAvatar
        avatarUrl={option["avatarUrl"]}
        size={20}
        name={option.label}
      />
    )}
    {option["type"] === "group" && <IconGroupCircle />}
    <div>
      <Text size="sm">{option.label}</Text>
    </div>
  </Group>
);

export function MultiMemberSelect({ onChange }: MultiMemberSelectProps) {
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
        avatarUrl: user.avatarUrl,
        type: "user",
      }));

      const groupItems = suggestion?.groups.map((group: IGroup) => ({
        value: `group-${group.id}`,
        label: group.name,
        type: "group",
      }));

      // Function to merge items into groups without duplicates
      const mergeItemsIntoGroups = (existingGroups, newItems, groupName) => {
        const existingValues = new Set(
          existingGroups.flatMap((group) =>
            group.items.map((item) => item.value),
          ),
        );
        const newItemsFiltered = newItems.filter(
          (item) => !existingValues.has(item.value),
        );

        const updatedGroups = existingGroups.map((group) => {
          if (group.group === groupName) {
            return { ...group, items: [...group.items, ...newItemsFiltered] };
          }
          return group;
        });

        // Use spread syntax to avoid mutation
        return updatedGroups.some((group) => group.group === groupName)
          ? updatedGroups
          : [...updatedGroups, { group: groupName, items: newItemsFiltered }];
      };

      // Merge user items into groups
      const updatedUserGroups = mergeItemsIntoGroups(
        data,
        userItems,
        "Select a user",
      );

      // Merge group items into groups
      const finalData = mergeItemsIntoGroups(
        updatedUserGroups,
        groupItems,
        "Select a group",
      );

      setData(finalData);
    }
  }, [suggestion, data]);

  return (
    <MultiSelect
      data={data}
      renderOption={renderMultiSelectOption}
      hidePickedOptions
      maxDropdownHeight={300}
      label={t("Add members")}
      placeholder={t("Search for users and groups")}
      searchable
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      clearable
      variant="filled"
      onChange={onChange}
      maxValues={50}
    />
  );
}
