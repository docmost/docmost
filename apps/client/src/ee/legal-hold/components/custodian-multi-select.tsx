import { ReactNode, useState } from "react";
import { Badge, Group, MultiSelect, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { CustomAvatar } from "@/components/ui/custom-avatar";
import { useLegalHoldUsersQuery } from "@/ee/legal-hold/queries/legal-hold-query";
import type { LegalHoldUserView } from "@/ee/legal-hold/types/legal-hold.types";

const MAX_CUSTODIANS = 1000;

type CustodianMultiSelectProps = {
  value: string[];
  onChange: (value: string[]) => void;
  // the hold's current custodians, so their pills show names before any search
  initialCustodians: LegalHoldUserView[];
  error?: ReactNode;
};

export function CustodianMultiSelect({
  value,
  onChange,
  initialCustodians,
  error,
}: CustodianMultiSelectProps) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch] = useDebouncedValue(searchValue, 300);
  const { data } = useLegalHoldUsersQuery({
    query: debouncedSearch,
    limit: 50,
  });
  const [pickedUsers, setPickedUsers] = useState(
    () => new Map(initialCustodians.map((user) => [user.id, user])),
  );

  const results = data?.items ?? [];
  const usersById = new Map([
    ...results.map((user) => [user.id, user] as const),
    ...pickedUsers,
  ]);
  const options = [
    ...value.map((id) => pickedUsers.get(id)).filter((user) => !!user),
    ...results.filter((user) => !value.includes(user.id)),
  ].map((user) => ({ value: user.id, label: user.name || user.email }));

  // search results change with every query, so remember who was picked
  const handleChange = (ids: string[]) => {
    setPickedUsers((previous) => {
      const next = new Map(previous);
      results
        .filter((user) => ids.includes(user.id))
        .forEach((user) => next.set(user.id, user));
      return next;
    });
    onChange(ids);
  };

  return (
    <MultiSelect
      label={t("Custodians")}
      description={t("Content these members created or edited is kept.")}
      placeholder={t("Search for users")}
      nothingFoundMessage={t("No user found")}
      data={options}
      value={value}
      onChange={handleChange}
      error={error}
      searchable
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      // the server already matched names and emails
      filter={({ options }) => options}
      hidePickedOptions
      maxValues={MAX_CUSTODIANS}
      maxDropdownHeight={300}
      renderOption={({ option }) => {
        const user = usersById.get(option.value);
        return (
          <Group gap="sm" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
            <CustomAvatar
              avatarUrl={user?.avatarUrl}
              size={20}
              name={option.label}
              aria-hidden
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Text size="sm" lineClamp={1}>
                {option.label}
              </Text>
              {user?.name && (
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {user.email}
                </Text>
              )}
            </div>
            {user?.deactivatedAt && (
              <Badge size="sm" variant="light" color="orange">
                {t("Deactivated")}
              </Badge>
            )}
          </Group>
        );
      }}
    />
  );
}
