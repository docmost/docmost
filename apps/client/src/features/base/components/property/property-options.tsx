import { useCallback } from "react";
import { Stack, NumberInput, Select, Switch, Text } from "@mantine/core";
import {
  IBaseProperty,
  SelectTypeOptions,
  NumberTypeOptions,
  DateTypeOptions,
  PersonTypeOptions,
  Choice,
} from "@/features/base/types/base.types";
import { ChoiceEditor } from "./choice-editor";
import { useTranslation } from "react-i18next";

type PropertyOptionsProps = {
  property: IBaseProperty;
  onUpdate: (typeOptions: Record<string, unknown>) => void;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  hideButtons?: boolean;
};

export function PropertyOptions({ property, onUpdate, onClose, onDirtyChange, hideButtons }: PropertyOptionsProps) {
  const { t } = useTranslation();

  switch (property.type) {
    case "select":
    case "multiSelect":
      return (
        <SelectOptions
          property={property}
          onUpdate={onUpdate}
          onClose={onClose}
          onDirtyChange={onDirtyChange}
          hideButtons={hideButtons}
        />
      );
    case "status":
      return (
        <StatusOptions
          property={property}
          onUpdate={onUpdate}
          onClose={onClose}
          onDirtyChange={onDirtyChange}
          hideButtons={hideButtons}
        />
      );
    case "number":
      return (
        <NumberOptions
          property={property}
          onUpdate={onUpdate}
        />
      );
    case "date":
      return (
        <DateOptions
          property={property}
          onUpdate={onUpdate}
        />
      );
    case "person":
      return (
        <PersonOptions
          property={property}
          onUpdate={onUpdate}
        />
      );
    default:
      return (
        <Text size="xs" c="dimmed">
          {t("No options for this property type")}
        </Text>
      );
  }
}

function SelectOptions({
  property,
  onUpdate,
  onClose,
  onDirtyChange,
  hideButtons,
}: {
  property: IBaseProperty;
  onUpdate: (typeOptions: Record<string, unknown>) => void;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  hideButtons?: boolean;
}) {
  const options = property.typeOptions as SelectTypeOptions | undefined;
  const choices = options?.choices ?? [];

  const handleSave = useCallback(
    (newChoices: Choice[]) => {
      onUpdate({
        ...property.typeOptions,
        choices: newChoices,
        choiceOrder: newChoices.map((c) => c.id),
      });
    },
    [property.typeOptions, onUpdate],
  );

  return (
    <ChoiceEditor
      initialChoices={choices}
      onSave={handleSave}
      onClose={onClose}
      onDirtyChange={onDirtyChange}
      showCategories={false}
      hideButtons={hideButtons}
    />
  );
}

function StatusOptions({
  property,
  onUpdate,
  onClose,
  onDirtyChange,
  hideButtons,
}: {
  property: IBaseProperty;
  onUpdate: (typeOptions: Record<string, unknown>) => void;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  hideButtons?: boolean;
}) {
  const options = property.typeOptions as SelectTypeOptions | undefined;
  const choices = options?.choices ?? [];

  const handleSave = useCallback(
    (newChoices: Choice[]) => {
      onUpdate({
        ...property.typeOptions,
        choices: newChoices,
        choiceOrder: newChoices.map((c) => c.id),
      });
    },
    [property.typeOptions, onUpdate],
  );

  return (
    <ChoiceEditor
      initialChoices={choices}
      onSave={handleSave}
      onClose={onClose}
      onDirtyChange={onDirtyChange}
      showCategories
      hideButtons={hideButtons}
    />
  );
}

function NumberOptions({
  property,
  onUpdate,
}: {
  property: IBaseProperty;
  onUpdate: (typeOptions: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const options = property.typeOptions as NumberTypeOptions | undefined;

  return (
    <Stack gap="xs">
      <Select
        size="xs"
        label={t("Format")}
        allowDeselect={false}
        data={[
          { value: "plain", label: t("Number") },
          { value: "currency", label: t("Currency") },
          { value: "percent", label: t("Percent") },
          { value: "progress", label: t("Progress") },
        ]}
        value={options?.format ?? "plain"}
        onChange={(val) =>
          onUpdate({ ...property.typeOptions, format: val ?? "plain" })
        }
      />
      <NumberInput
        size="xs"
        label={t("Decimal places")}
        min={0}
        max={8}
        value={options?.precision ?? 0}
        onChange={(val) =>
          onUpdate({ ...property.typeOptions, precision: val })
        }
      />
    </Stack>
  );
}

function DateOptions({
  property,
  onUpdate,
}: {
  property: IBaseProperty;
  onUpdate: (typeOptions: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const options = property.typeOptions as DateTypeOptions | undefined;

  return (
    <Stack gap="xs">
      <Switch
        size="xs"
        label={t("Include time")}
        checked={options?.includeTime ?? false}
        onChange={(e) =>
          onUpdate({
            ...property.typeOptions,
            includeTime: e.currentTarget.checked,
          })
        }
      />
      {options?.includeTime && (
        <Select
          size="xs"
          label={t("Time format")}
          allowDeselect={false}
          data={[
            { value: "12h", label: "12-hour" },
            { value: "24h", label: "24-hour" },
          ]}
          value={options?.timeFormat ?? "12h"}
          onChange={(val) =>
            onUpdate({ ...property.typeOptions, timeFormat: val ?? "12h" })
          }
        />
      )}
    </Stack>
  );
}

function PersonOptions({
  property,
  onUpdate,
}: {
  property: IBaseProperty;
  onUpdate: (typeOptions: Record<string, unknown>) => void;
}) {
  const { t } = useTranslation();
  const options = property.typeOptions as PersonTypeOptions | undefined;

  return (
    <Stack gap="xs">
      <Switch
        size="xs"
        label={t("Allow multiple people")}
        checked={options?.allowMultiple !== false}
        onChange={(e) =>
          onUpdate({
            ...property.typeOptions,
            allowMultiple: e.currentTarget.checked,
          })
        }
      />
    </Stack>
  );
}
