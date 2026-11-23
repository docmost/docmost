import {
  MultiSelect,
  type MultiSelectProps,
  useComputedColorScheme,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspaceLabelsQuery } from "@/features/label/queries/label-query";
import { normalizeLabelName } from "@/features/label/utils/normalize-label";
import { LabelChip } from "./label-chip";
import { LabelOption } from "./label-option";
import classes from "@/features/label/label.module.css";

interface LabelFilterProps extends Pick<
  MultiSelectProps,
  | "id"
  | "aria-label"
  | "label"
  | "placeholder"
  | "required"
  | "description"
  | "autoFocus"
  | "className"
> {
  value: string[];
  onChange: (value: string[]) => void;
  maxValues: number;
  isWithinLength: (name: string) => boolean;
}

export function LabelFilter({
  value,
  onChange,
  placeholder,
  maxValues,
  isWithinLength,
  ...inputProps
}: LabelFilterProps) {
  const { t } = useTranslation();
  const scheme = useComputedColorScheme("light");
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 200);
  const { data } = useWorkspaceLabelsQuery(debouncedSearch, true);
  const candidate = normalizeLabelName(search);
  const suggestions =
    data?.items.map(({ name }) => normalizeLabelName(name)) ?? [];
  const names = new Set(value);
  for (const name of [...suggestions, candidate]) {
    if (name && isWithinLength(name)) names.add(name);
  }
  return (
    <MultiSelect
      {...inputProps}
      aria-required={inputProps.required || undefined}
      inputWrapperOrder={["label", "input", "description", "error"]}
      searchable
      hidePickedOptions
      classNames={{ option: classes.popoverItem }}
      maxDropdownHeight={240}
      scrollAreaProps={{
        scrollbars: "y",
        styles: { content: { minWidth: 0 } },
      }}
      renderOption={({ option }) => (
        <LabelOption name={option.label} scheme={scheme} />
      )}
      renderPill={({ value, onRemove }) => (
        <LabelChip label={{ name: value }} onRemove={onRemove} />
      )}
      placeholder={placeholder ?? t("Choose labels")}
      searchValue={search}
      onSearchChange={setSearch}
      data={[...names]}
      value={value}
      onChange={onChange}
      maxValues={maxValues}
      filter={({ options }) =>
        options.filter(
          (item) =>
            "label" in item && item.label.toLowerCase().includes(candidate),
        )
      }
      comboboxProps={{ withinPortal: false }}
    />
  );
}
