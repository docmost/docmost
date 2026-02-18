import React, { useState, useEffect } from "react";
import { TextInput, Group } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "./search-input.module.css";

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
    <Group mb="sm" className={classes.wrapper}>
      <TextInput
        size="sm"
        placeholder={placeholder || t("Search...")}
        leftSection={<IconSearch size={15} stroke={1.75} />}
        radius="md"
        className={classes.input}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
      />
    </Group>
  );
}
