import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  Popover,
  Portal,
  TextInput,
  Button,
  Group,
  Stack,
  Divider,
  UnstyledButton,
  Text,
  ScrollArea,
} from "@mantine/core";
import { IconPlus, IconChevronRight } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import {
  BasePropertyType,
  IBaseProperty,
  TypeOptions,
} from "@/features/base/types/base.types";
import { useCreatePropertyMutation } from "@/features/base/queries/base-property-query";
import { PropertyTypePicker, propertyTypes } from "./property-type-picker";
import { PropertyOptions } from "./property-options";
import classes from "@/features/base/styles/grid.module.css";

type CreatePropertyPopoverProps = {
  baseId: string;
  onPropertyCreated?: () => void;
};

type Panel = "typePicker" | "configure" | "confirmDiscard";

const noop = () => {};

// Keep in sync with the switch cases in PropertyOptions
const typesWithOptions = new Set<BasePropertyType>([
  "select",
  "multiSelect",
  "status",
  "number",
  "date",
  "person",
]);

export function CreatePropertyPopover({ baseId, onPropertyCreated }: CreatePropertyPopoverProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [panel, setPanel] = useState<Panel>("typePicker");
  const [selectedType, setSelectedType] = useState<BasePropertyType | null>(null);
  const [name, setName] = useState("");
  const [typeOptions, setTypeOptions] = useState<Record<string, unknown>>({});
  const nameInputRef = useRef<HTMLInputElement>(null);

  const createPropertyMutation = useCreatePropertyMutation();

  const selectedTypeDef = useMemo(
    () => propertyTypes.find((pt) => pt.type === selectedType),
    [selectedType],
  );
  const selectedTypeLabel = selectedTypeDef ? t(selectedTypeDef.labelKey) : "";
  const selectedTypeIcon = selectedTypeDef?.icon;

  const hasContent = useMemo(() => {
    return name.trim().length > 0 || Object.keys(typeOptions).length > 0;
  }, [name, typeOptions]);

  const resetState = useCallback(() => {
    setPanel("typePicker");
    setSelectedType(null);
    setName("");
    setTypeOptions({});
  }, []);

  const handleOpen = useCallback(() => {
    resetState();
    setOpened(true);
  }, [resetState]);

  const handleClose = useCallback(() => {
    setOpened(false);
    resetState();
  }, [resetState]);

  const attemptClose = useCallback(() => {
    if (panel === "configure" && hasContent) {
      setPanel("confirmDiscard");
    } else {
      handleClose();
    }
  }, [panel, hasContent, handleClose]);

  const handleConfirmDiscard = useCallback(() => {
    handleClose();
  }, [handleClose]);

  const handleCancelDiscard = useCallback(() => {
    setPanel("configure");
  }, []);

  const handleTypeSelect = useCallback((type: BasePropertyType) => {
    setSelectedType(type);
    setTypeOptions({});
    setPanel("configure");
  }, []);

  useEffect(() => {
    if (panel === "configure") {
      setTimeout(() => nameInputRef.current?.focus(), 0);
    }
  }, [panel]);

  const handleCreate = useCallback(() => {
    if (!selectedType) return;
    const finalName = name.trim() || selectedTypeLabel;
    createPropertyMutation.mutate(
      {
        baseId,
        name: finalName,
        type: selectedType,
        typeOptions: Object.keys(typeOptions).length > 0
          ? typeOptions as TypeOptions
          : undefined,
      },
      {
        onSuccess: () => {
          onPropertyCreated?.();
        },
      },
    );
    handleClose();
  }, [selectedType, name, selectedTypeLabel, typeOptions, baseId, createPropertyMutation, handleClose, onPropertyCreated]);

  const handleBackToTypePicker = useCallback(() => {
    setPanel("typePicker");
    setTypeOptions({});
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (panel === "confirmDiscard") {
          handleCancelDiscard();
        } else if (panel === "configure") {
          handleBackToTypePicker();
        } else {
          handleClose();
        }
      }
    },
    [panel, handleBackToTypePicker, handleClose, handleCancelDiscard],
  );

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleCreate();
      }
    },
    [handleCreate],
  );

  const handleOptionsUpdate = useCallback(
    (newTypeOptions: Record<string, unknown>) => {
      setTypeOptions(newTypeOptions);
    },
    [],
  );

  const syntheticProperty: IBaseProperty = useMemo(() => ({
    id: "",
    baseId,
    name: name || "",
    type: selectedType ?? "text",
    position: "",
    typeOptions: typeOptions as TypeOptions,
    isPrimary: false,
    workspaceId: "",
    createdAt: "",
    updatedAt: "",
  }), [baseId, name, selectedType, typeOptions]);

  const TypeIcon = selectedTypeIcon;
  const showOptions = selectedType && typesWithOptions.has(selectedType);

  return (
    <>
      {opened && (
        <Portal>
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 299,
            }}
            onClick={attemptClose}
          />
        </Portal>
      )}
      <Popover
        opened={opened}
        onClose={noop}
        position="bottom-start"
        shadow="md"
        width={320}
        withinPortal
      >
        <Popover.Target>
          <div
            className={classes.addColumnButton}
            onClick={handleOpen}
            role="button"
            tabIndex={0}
          >
            <IconPlus size={16} />
          </div>
        </Popover.Target>
        <Popover.Dropdown
          p={0}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          style={{ zIndex: 300 }}
        >
          {panel === "typePicker" && (
            <Stack gap={0} p={4}>
              <PropertyTypePicker
                onSelect={handleTypeSelect}
                showSearch
              />
            </Stack>
          )}
          {(panel === "configure" || panel === "confirmDiscard") && (
            <Stack gap={0} p="sm" style={panel === "confirmDiscard" ? { display: "none" } : undefined}>
              <TextInput
                ref={nameInputRef}
                size="xs"
                label={t("Name")}
                placeholder={selectedTypeLabel}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                onKeyDown={handleNameKeyDown}
                mb="xs"
              />
              <UnstyledButton
                onClick={handleBackToTypePicker}
                py={6}
                px={0}
                mb={showOptions ? "xs" : 0}
              >
                <Group gap={8} wrap="nowrap">
                  {TypeIcon && <TypeIcon size={14} />}
                  <Text size="sm" style={{ flex: 1 }}>
                    {selectedTypeLabel}
                  </Text>
                  <IconChevronRight size={14} />
                </Group>
              </UnstyledButton>

              {showOptions && (
                <>
                  <Divider mb="xs" />
                  <ScrollArea.Autosize mah={300} scrollbarSize={6} offsetScrollbars>
                    <PropertyOptions
                      property={syntheticProperty}
                      onUpdate={handleOptionsUpdate}
                      onClose={noop}
                      onDirtyChange={noop}
                      hideButtons
                    />
                  </ScrollArea.Autosize>
                </>
              )}

              <Divider my="xs" />
              <Group gap="xs" justify="flex-end">
                <Button variant="default" size="xs" onClick={attemptClose}>
                  {t("Cancel")}
                </Button>
                <Button size="xs" onClick={handleCreate}>
                  {t("Create field")}
                </Button>
              </Group>
            </Stack>
          )}
          {panel === "confirmDiscard" && (
            <Stack gap="xs" p="sm">
              <Text size="sm" fw={600}>
                {t("Unsaved changes")}
              </Text>
              <Text size="xs" c="dimmed">
                {t("You have unsaved changes. Do you want to discard them?")}
              </Text>
              <Group gap="xs" justify="flex-end">
                <Button
                  variant="default"
                  size="xs"
                  onClick={handleCancelDiscard}
                >
                  {t("Keep editing")}
                </Button>
                <Button
                  color="red"
                  size="xs"
                  onClick={handleConfirmDiscard}
                >
                  {t("Discard")}
                </Button>
              </Group>
            </Stack>
          )}
        </Popover.Dropdown>
      </Popover>
    </>
  );
}
