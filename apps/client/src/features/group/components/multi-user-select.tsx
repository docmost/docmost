import React, { useEffect, useState } from "react";
import { useDebouncedValue } from "@mantine/hooks";
import { useWorkspaceMembersQuery } from "@/features/workspace/queries/workspace-query.ts";
import { IUser } from "@/features/user/types/user.types.ts";
import { Group, MultiSelect, MultiSelectProps, Text } from "@mantine/core";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { useTranslation } from "react-i18next";

interface MultiUserSelectProps {
  onChange: (value: string[]) => void;
  label?: string;
}

const renderMultiSelectOption: MultiSelectProps["renderOption"] = ({
  option,
}) => (
  <Group gap="sm" wrap="nowrap">
    <CustomAvatar
      avatarUrl={option?.["avatarUrl"]}
      name={option.label}
      size={36}
    />
    <div>
      <Text size="sm" lineClamp={1}>{option.label}</Text>
      <Text size="xs" opacity={0.5}>
        {option?.["email"]}
      </Text>
    </div>
  </Group>
);

export function MultiUserSelect({ onChange, label }: MultiUserSelectProps) {
  const { t } = useTranslation();
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

      // Filter out existing users by their ids
      const filteredUsersData = usersData.filter(
        (user) =>
          !data.find((existingUser) => existingUser.value === user.value),
      );

      // Combine existing data with new search data
      setData((prevData) => [...prevData, ...filteredUsersData]);
    }
  }, [users]);

  return (
    <MultiSelect
      data={data}
      renderOption={renderMultiSelectOption}
      hidePickedOptions
      maxDropdownHeight={300}
      label={label || t("Add members")}
      placeholder={t("Search for users")}
      searchable
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      clearable
      variant="filled"
      onChange={onChange}
      nothingFoundMessage={t("No user found")}
      maxValues={50}
    />
  );
}
