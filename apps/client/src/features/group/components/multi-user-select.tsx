import React, { useEffect, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query.ts";
import { IUser } from "@/features/user/types/user.types.ts";
import {
  Avatar,
  Group,
  MultiSelect,
  MultiSelectProps,
  Text,
} from "@mantine/core";

interface MultiUserSelectProps {
  onChange: (value: string[]) => void;
}

const renderMultiSelectOption: MultiSelectProps["renderOption"] = ({
  option,
}) => (
  <Group gap="sm">
    <Avatar src={option?.["avatarUrl"]} size={36} radius="xl" />
    <div>
      <Text size="sm">{option.label}</Text>
      <Text size="xs" opacity={0.5}>
        {option?.["email"]}
      </Text>
    </div>
  </Group>
);

export function MultiUserSelect({ onChange }: MultiUserSelectProps) {
  const [searchValue, setSearchValue] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchValue, 500);
  const { data: users, isLoading } = useWorkspaceMembersQuery({
    query: debouncedQuery,
    limit: 50,
  });
  const [data, setData] = useState([]);

  useEffect(() => {
    if (users) {
      const usersData = users?.items.map((user: IUser) => {
        return {
          value: user.id,
          label: user.name,
          avatarUrl: user.avatarUrl,
          email: user.email,
        };
      });
      if (usersData.length > 0) {
        setData(usersData);
      }
    }
  }, [users]);

  return (
    <MultiSelect
      data={data}
      renderOption={renderMultiSelectOption}
      hidePickedOptions
      maxDropdownHeight={300}
      label="Add group members"
      placeholder="Search for users"
      searchable
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      variant="filled"
      onChange={onChange}
      nothingFoundMessage="Nothing found..."
      maxValues={50}
    />
  );
}
