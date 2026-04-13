import { useState } from "react";
import { Select } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import { useSearchSuggestionsQuery } from "@/features/search/queries/search-query";
import {
  renderUserSelectOption,
  toUserOptions,
  UserOptionItem,
} from "./user-option";

type VerifierPickerProps = {
  excludeIds: string[];
  disabled?: boolean;
  onSelect: (user: UserOptionItem) => void;
  placeholder?: string;
};

export function VerifierPicker({
  excludeIds,
  disabled,
  onSelect,
  placeholder,
}: VerifierPickerProps) {
  const { t } = useTranslation();
  const [searchValue, setSearchValue] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchValue, 300);

  const { data: suggestion } = useSearchSuggestionsQuery({
    query: debouncedQuery,
    includeUsers: true,
    includeGroups: false,
    preload: true,
  });

  const excludeSet = new Set(excludeIds);
  const options = toUserOptions(suggestion?.users).filter(
    (u) => !excludeSet.has(u.value),
  );

  const handleChange = (userId: string | null) => {
    if (!userId) return;
    const picked = options.find((u) => u.value === userId);
    if (!picked) return;
    onSelect(picked);
    setSearchValue("");
  };

  return (
    <Select
      data={options}
      value={null}
      onChange={handleChange}
      renderOption={renderUserSelectOption}
      placeholder={placeholder ?? t("Add verifier")}
      searchable
      searchValue={searchValue}
      onSearchChange={setSearchValue}
      filter={({ options }) => options}
      variant="filled"
      disabled={disabled}
      nothingFoundMessage={t("No user found")}
    />
  );
}
