import React, { useState, useEffect } from "react";
import { TextInput, Group } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export interface SearchInputProps {
  placeholder?: string;
  debounceDelay?: number;
  onSearch: (value: string) => void;
}

export function SearchInput({
  placeholder,
  debounceDelay = 500,
  onSearch,
}: SearchInputProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState("");
  const [debouncedValue] = useDebouncedValue(value, debounceDelay);

  useEffect(() => {
    onSearch(debouncedValue);
  }, [debouncedValue, onSearch]);

  return (
    <Group mb="sm">
      <TextInput
        size="sm"
        placeholder={placeholder || t("Search...")}
        leftSection={<IconSearch size={16} />}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
      />
    </Group>
  );
}
