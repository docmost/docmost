import { useState } from "react";
import {
  Button,
  Divider,
  Group,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { PropertyOptions } from "@/ee/base/components/property/property-options";
import { isLossyConversion } from "@/ee/base/components/property/conversion-warning";
import { PropertyChangeConfirmation } from "@/ee/base/components/property/property-change-confirmation";
import { RemoveTimeConfirmation } from "@/ee/base/components/property/remove-time-confirmation";
import { useViewerDateContext } from "@/ee/base/hooks/use-viewer-date-context";
import {
  CHOICE_TYPES,
  defaultTypeOptionsFor,
  getDescriptor,
  typeOptionsForConversion,
} from "@/ee/base/property-types/property-type.registry";
import type { TypeOptions } from "@/ee/base/types/base.types";
import { dateTypeOptionsOf } from "@/ee/base/utils/date-format";
import {
  PAGE_PROPERTY_TYPES,
  type PageProperty,
  type PagePropertyChange,
  type PagePropertyType,
} from "./page-property.types";

type Props = {
  pageId: string;
  properties: PageProperty[];
  property?: PageProperty;
  onClose: () => void;
  onSave: (change: PagePropertyChange, onSuccess: () => void) => void;
  saving: boolean;
};

export function PagePropertyDialog({
  pageId,
  properties,
  property,
  onClose,
  onSave,
  saving,
}: Props) {
  const { t } = useTranslation();
  const { timeZone } = useViewerDateContext();
  const [name, setName] = useState(property?.name ?? "");
  const [config, setConfig] = useState(() => ({
    type: property?.type ?? ("text" as PagePropertyType),
    typeOptions: property?.typeOptions ?? defaultTypeOptionsFor("text"),
  }));
  const { type } = config;
  const [options, setOptions] = useState<TypeOptions>(config.typeOptions);
  const [optionsDirty, setOptionsDirty] = useState(false);
  const [unit, setUnit] = useState((options as { unit?: string }).unit ?? "");
  const [confirmation, setConfirmation] = useState<
    "delete" | "removeTime" | "convert" | null
  >(null);
  const [dropdownNode, setDropdownNode] = useState<HTMLDivElement | null>(null);
  const trimmedName = name.trim();
  const duplicate = properties.some(
    (p) =>
      p.id !== property?.id &&
      p.name.toLowerCase() === trimmedName.toLowerCase(),
  );
  const TypeIcon = getDescriptor(type).icon;

  const changeType = (next: PagePropertyType) => {
    if (!next || next === type) return;
    const source =
      property && !CHOICE_TYPES.has(type)
        ? property
        : { type, typeOptions: options };
    const nextOptions =
      next === property?.type
        ? property.typeOptions
        : typeOptionsForConversion(source, next);
    setConfig({ type: next, typeOptions: nextOptions });
    setOptions(nextOptions);
    setOptionsDirty(false);
    setUnit((nextOptions as { unit?: string }).unit ?? "");
  };

  const apply = () => {
    if (!trimmedName || duplicate || saving) return;
    const originalUnit =
      (property?.typeOptions as { unit?: string } | undefined)?.unit ?? "";
    const typeOptions: Record<string, unknown> = { ...options };
    if (type === "number") {
      if (unit.trim()) typeOptions.unit = unit.trim();
      else delete typeOptions.unit;
    }
    if (property) {
      const changes: PagePropertyChange = {
        action: "update",
        propertyId: property.id,
        expectedSchemaVersion: property.schemaVersion,
      };
      if (trimmedName !== property.name) changes.name = trimmedName;
      if (type !== property.type) changes.type = type;
      if (
        type !== property.type ||
        optionsDirty ||
        unit.trim() !== originalUnit
      ) {
        if (type === property.type) {
          for (const key of Object.keys(property.typeOptions)) {
            if (typeOptions[key] === undefined) typeOptions[key] = null;
          }
        }
        changes.typeOptions = typeOptions;
        if (type === "date" || property.type === "date")
          changes.timeZone = timeZone;
      }
      if (!changes.name && !changes.type && !changes.typeOptions)
        return onClose();
      onSave(changes, onClose);
    } else {
      onSave(
        { action: "create", name: trimmedName, type, typeOptions },
        onClose,
      );
    }
  };

  const save = () => {
    if (!trimmedName || duplicate || saving) return;
    if (
      property?.type === "date" &&
      type === "date" &&
      dateTypeOptionsOf(property.typeOptions).includeTime &&
      !dateTypeOptionsOf(options).includeTime
    ) {
      setConfirmation("removeTime");
    } else if (
      property &&
      property.type !== type &&
      isLossyConversion(property.type, type)
    ) {
      setConfirmation("convert");
    } else {
      apply();
    }
  };

  return (
    <Modal
      opened
      onClose={onClose}
      title={
        confirmation === "delete"
          ? t("Delete property")
          : property
            ? t("Edit property")
            : t("Add property")
      }
      centered
      size="sm"
    >
      {confirmation === "delete" && (
        <Stack>
          <Text size="sm">
            {t("Delete {{name}} and its value from this page?", {
              name: property.name,
            })}
          </Text>
          <Group justify="flex-end" gap="xs">
            <Button
              variant="default"
              size="xs"
              onClick={() => setConfirmation(null)}
            >
              {t("Cancel")}
            </Button>
            <Button
              color="red"
              size="xs"
              loading={saving}
              onClick={() =>
                onSave({ action: "delete", propertyId: property.id }, onClose)
              }
            >
              {t("Delete property")}
            </Button>
          </Group>
        </Stack>
      )}
      {confirmation === "removeTime" && (
        <RemoveTimeConfirmation
          propertyName={property.name}
          description={t(
            "The date keeps its day in your time zone and loses the time.",
          )}
          loading={saving}
          onCancel={() => setConfirmation(null)}
          onConfirm={apply}
        />
      )}
      {confirmation === "convert" && (
        <PropertyChangeConfirmation
          title={t("Change type to {{label}}?", {
            label: t(getDescriptor(type).labelKey),
          })}
          description={t(
            "Changing the type may replace or clear the current value.",
          )}
          confirmLabel={t("Apply")}
          destructive
          loading={saving}
          onCancel={() => setConfirmation(null)}
          onConfirm={apply}
        />
      )}
      <Stack
        gap="sm"
        ref={setDropdownNode}
        style={{ display: confirmation ? "none" : undefined }}
      >
        <TextInput
          label={t("Name")}
          size="sm"
          value={name}
          data-autofocus
          maxLength={255}
          onChange={(event) => setName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) save();
          }}
          error={duplicate && t("A property with this name already exists")}
        />
        <Select
          label={t("Type")}
          size="sm"
          allowDeselect={false}
          value={type}
          leftSection={<TypeIcon size={16} />}
          data={PAGE_PROPERTY_TYPES.map((kind) => ({
            value: kind,
            label: t(getDescriptor(kind).labelKey),
          }))}
          comboboxProps={{ withinPortal: false }}
          onChange={changeType}
        />
        <PropertyOptions
          key={type}
          property={{ pageId, name, ...config }}
          onUpdate={setOptions}
          onDirtyChange={setOptionsDirty}
          onClose={onClose}
          hideButtons
          dropdownPortalTarget={dropdownNode}
        />
        {type === "number" && (
          <TextInput
            size="xs"
            label={t("Unit")}
            value={unit}
            maxLength={64}
            onChange={(event) => setUnit(event.currentTarget.value)}
          />
        )}
        <Divider />
        <Group justify={property ? "space-between" : "flex-end"} gap="xs">
          {property && (
            <Button
              size="xs"
              variant="subtle"
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={() => setConfirmation("delete")}
            >
              {t("Delete")}
            </Button>
          )}
          <Group gap="xs">
            <Button variant="default" size="xs" onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button
              size="xs"
              loading={saving}
              disabled={!trimmedName || duplicate}
              onClick={save}
            >
              {property ? t("Save") : t("Create property")}
            </Button>
          </Group>
        </Group>
      </Stack>
    </Modal>
  );
}
