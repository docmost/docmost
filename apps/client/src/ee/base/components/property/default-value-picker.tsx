import { Group, MultiSelect, Select, Text } from "@mantine/core";
import { IconCheck } from "@tabler/icons-react";
import { Choice } from "@/ee/base/types/base.types";
import { choiceColor } from "@/ee/base/components/cells/choice-color";
import { useTranslation } from "react-i18next";
import type { ComboboxItem } from "@mantine/core";

type DefaultValuePickerProps = {
  choices: Choice[];
  value: string | string[] | null;
  multiple?: boolean;
  onChange: (value: string | string[] | null) => void;
  dropdownPortalTarget?: HTMLElement | null;
};

export function DefaultValuePicker({
  choices,
  value,
  multiple,
  onChange,
  dropdownPortalTarget,
}: DefaultValuePickerProps) {
  const { t } = useTranslation();
  const data = choices.map((c) => ({ value: c.id, label: c.name }));
  const comboboxProps = {
    portalProps: { target: dropdownPortalTarget ?? undefined },
  };

  const renderOption = ({
    option,
    checked,
  }: {
    option: ComboboxItem;
    checked?: boolean;
  }) => {
    const choice = choices.find((c) => c.id === option.value);
    const colors = choice ? choiceColor(choice.color) : undefined;
    return (
      <Group gap={6} wrap="nowrap" justify="space-between" style={{ flex: 1 }}>
        <Group gap={6} wrap="nowrap">
          {colors && (
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                backgroundColor: colors.backgroundColor as string,
                border: `2px solid ${colors.color as string}`,
                flexShrink: 0,
              }}
            />
          )}
          <Text size="xs">{option.label}</Text>
        </Group>
        {checked && (
          <IconCheck size={14} color="var(--mantine-color-dimmed)" />
        )}
      </Group>
    );
  };

  if (multiple) {
    const selected = (
      Array.isArray(value) ? value : value ? [value] : []
    ).filter((id) => choices.some((c) => c.id === id));
    return (
      <MultiSelect
        size="xs"
        label={t("Default value")}
        placeholder={selected.length ? undefined : t("None")}
        data={data}
        value={selected}
        onChange={(vals) => onChange(vals.length ? vals : null)}
        clearable
        comboboxProps={comboboxProps}
        renderOption={renderOption}
      />
    );
  }

  const single =
    typeof value === "string" && choices.some((c) => c.id === value)
      ? value
      : null;
  return (
    <Select
      size="xs"
      label={t("Default value")}
      placeholder={t("None")}
      data={data}
      value={single}
      onChange={(val) => onChange(val)}
      clearable
      comboboxProps={comboboxProps}
      renderOption={renderOption}
    />
  );
}
