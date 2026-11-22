import { MultiSelect, Select } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspaceLabelsQuery } from "@/features/label/queries/label-query";
import { normalizeLabelName } from "@/features/label/utils/normalize-label";

interface LabelFilterProps {
  label: string;
  value: string[];
  onChange: (value: string[]) => void;
  required?: boolean;
  maxValues: number;
  isWithinLength: (name: string) => boolean;
}

export function LabelFilter({
  label,
  value,
  onChange,
  required,
  maxValues,
  isWithinLength,
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
      label={label}
      required={required}
      searchable
      hidePickedOptions
      placeholder={t("Choose labels")}
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
}: {
  value: Match;
  onChange: (match: Match) => void;
}) {
  const { t } = useTranslation();
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
