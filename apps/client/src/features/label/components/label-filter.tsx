import {
  Group,
  MultiSelect,
  SegmentedControl,
  Select,
  Text,
  type MultiSelectProps,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspaceLabelsQuery } from "@/features/label/queries/label-query";
import { normalizeLabelName } from "@/features/label/utils/normalize-label";

interface LabelFilterProps extends Pick<
  MultiSelectProps,
  | "id"
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
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 200);
  const { data } = useWorkspaceLabelsQuery(debouncedSearch, true);
  const candidate = normalizeLabelName(search);
  const names = new Set([
    ...value,
    ...(data?.items.map((item) => item.name) ?? []),
  ]);
  if (candidate && isWithinLength(candidate)) names.add(candidate);
  return (
    <MultiSelect
      {...inputProps}
      aria-required={inputProps.required || undefined}
      inputWrapperOrder={["label", "input", "description", "error"]}
      searchable
      hidePickedOptions
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

type Match = "any" | "all";

export function LabelMatchSelect({
  value,
  onChange,
  inline = false,
}: {
  value: Match;
  onChange: (match: Match) => void;
  inline?: boolean;
}) {
  const { t } = useTranslation();
  if (inline) {
    return (
      <Group gap={8} wrap="nowrap">
        <Text component="span" size="sm" c="dimmed">
          {t("Match")}
        </Text>
        <SegmentedControl<Match>
          aria-label={t("Label matching")}
          size="xs"
          radius="md"
          value={value}
          onChange={onChange}
          data={[
            { value: "any", label: t("Any") },
            { value: "all", label: t("All") },
          ]}
        />
      </Group>
    );
  }
  return (
    <Select
      label={t("Label matching")}
      allowDeselect={false}
      value={value}
      data={[
        { value: "any", label: t("Match any label") },
        { value: "all", label: t("Match all labels") },
      ]}
      onChange={(match) => onChange(match as Match)}
      comboboxProps={{ withinPortal: false }}
    />
  );
}
