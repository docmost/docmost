import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  Popover,
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
} from "@/ee/base/types/base.types";
import { useCreatePropertyMutation } from "@/ee/base/queries/base-property-query";
import { PropertyTypePicker } from "./property-type-picker";
import { PropertyOptions } from "./property-options";
import {
  getDescriptor,
  defaultTypeOptionsFor,
  propertyTypes,
} from "@/ee/base/property-types/property-type.registry";
import { FormulaEditor } from "../formula/formula-editor";
import classes from "@/ee/base/styles/grid.module.css";

type CreatePropertyPopoverProps = {
  pageId: string;
  properties?: IBaseProperty[];
  onPropertyCreated?: (property: IBaseProperty) => void;
  /** Custom trigger; must return a ref-forwarding element for Popover.Target.
   *  Defaults to the grid's + column button. */
  renderTarget?: (open: () => void) => React.ReactElement;
};

type Panel = "typePicker" | "configure" | "confirmDiscard";

const noop = () => {};

export function CreatePropertyPopover({ pageId, properties, onPropertyCreated, renderTarget }: CreatePropertyPopoverProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [panel, setPanel] = useState<Panel>("typePicker");
  const [selectedType, setSelectedType] = useState<BasePropertyType | null>(null);
  const [name, setName] = useState("");
  const [typeOptions, setTypeOptions] = useState<Record<string, unknown>>({});
  // Portal target for nested Select dropdowns to avoid triggering closeOnClickOutside.
  const [dropdownNode, setDropdownNode] = useState<HTMLDivElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<"bottom-start" | "top-start">(
    "bottom-start",
  );

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

  const nameTaken = useMemo(() => {
    const trimmed = name.trim().toLowerCase();
    if (!trimmed) return false;
    return (properties ?? []).some(
      (p) => p.name.trim().toLowerCase() === trimmed,
    );
  }, [name, properties]);

  // Fall back to the type label when Name is blank, suffixing a counter if taken.
  const fallbackName = useMemo(() => {
    const base = selectedTypeLabel || "Property";
    const existing = new Set(
      (properties ?? []).map((p) => p.name.trim().toLowerCase()),
    );
    if (!existing.has(base.toLowerCase())) return base;
    for (let i = 1; i < 1000; i++) {
      const candidate = `${base} ${i}`;
      if (!existing.has(candidate.toLowerCase())) return candidate;
    }
    return `${base} ${Date.now()}`;
  }, [selectedTypeLabel, properties]);

  const resetState = useCallback(() => {
    setPanel("typePicker");
    setSelectedType(null);
    setName("");
    setTypeOptions({});
  }, []);

  const handleOpen = useCallback(
    (event?: React.SyntheticEvent) => {
      resetState();
      const trigger = event?.currentTarget as HTMLElement | undefined;
      if (trigger) {
        const rect = trigger.getBoundingClientRect();
        const spaceAbove = rect.top;
        const spaceBelow = window.innerHeight - rect.bottom;
        setPosition(spaceAbove > spaceBelow ? "top-start" : "bottom-start");
      }
      setOpened(true);
    },
    [resetState],
  );

  const handleClose = useCallback(() => {
    // Don't reset state here: resetting mid-close flashes the type picker.
    // handleOpen resets on the next open instead.
    setOpened(false);
  }, []);

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
    setTypeOptions(defaultTypeOptionsFor(type));
    setPanel("configure");
  }, []);

  useEffect(() => {
    if (panel === "configure") {
      setTimeout(() => nameInputRef.current?.focus(), 0);
    }
  }, [panel]);

  const handleCreate = useCallback(() => {
    if (!selectedType || nameTaken) return;
    const finalName = name.trim() || fallbackName;
    createPropertyMutation.mutate(
      {
        pageId,
        name: finalName,
        type: selectedType,
        typeOptions: Object.keys(typeOptions).length > 0
          ? typeOptions as TypeOptions
          : undefined,
      },
      {
        onSuccess: (created) => {
          onPropertyCreated?.(created);
        },
      },
    );
    handleClose();
  }, [selectedType, nameTaken, name, fallbackName, typeOptions, pageId, createPropertyMutation, handleClose, onPropertyCreated]);

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
    pageId,
    name: name || "",
    type: selectedType ?? "text",
    position: "",
    typeOptions: typeOptions as TypeOptions,
    isPrimary: false,
    workspaceId: "",
    createdAt: "",
    updatedAt: "",
  }), [pageId, name, selectedType, typeOptions]);

  const TypeIcon = selectedTypeIcon;
  const showOptions = !!selectedType && (getDescriptor(selectedType)?.hasOptions ?? false);

  return (
    <>
      <Popover
        opened={opened}
        onChange={(o) => {
          if (!o) attemptClose();
        }}
        position={position}
        shadow="md"
        closeOnClickOutside
        closeOnEscape={false}
        withinPortal
        hideDetached={false}
        middlewares={{
          flip: false,
          shift: true,
          size: {
            padding: 8,
            apply: ({ availableHeight }) => {
              const el = scrollRef.current;
              if (el) el.style.maxHeight = `${availableHeight}px`;
            },
          },
        }}
      >
        <Popover.Target>
          {renderTarget ? (
            renderTarget(handleOpen)
          ) : (
            <div
              className={classes.addColumnButton}
              onClick={handleOpen}
              role="button"
              tabIndex={0}
            >
              <IconPlus size={16} />
            </div>
          )}
        </Popover.Target>
        <Popover.Dropdown
          ref={setDropdownNode}
          p={0}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
          style={{
            zIndex: 300,
            width: selectedType === "formula" ? 460 : undefined,
            minWidth: selectedType === "formula" ? undefined : 320,
            maxWidth: "calc(100vw - 32px)",
          }}
        >
          <div ref={scrollRef} style={{ overflowY: "auto", overflowX: "hidden" }}>
          {panel === "typePicker" && (
            <Stack gap={0} p={4}>
              <ScrollArea.Autosize
                mah="min(60vh, 400px)"
                scrollbarSize={6}
                offsetScrollbars
              >
                <PropertyTypePicker
                  onSelect={handleTypeSelect}
                  showSearch
                />
              </ScrollArea.Autosize>
            </Stack>
          )}
          {panel === "configure" && selectedType === "formula" && (
            <Stack gap="xs" p="sm">
              <TextInput
                ref={nameInputRef}
                size="xs"
                label={t("Name")}
                placeholder={fallbackName}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                error={nameTaken ? t("A property with this name already exists") : undefined}
              />
              <FormulaEditor
                properties={properties ?? []}
                editingPropertyId={null}
                name={name.trim() || undefined}
                onCancel={handleBackToTypePicker}
                disabled={nameTaken}
                onSave={(source, ast, resultType, dependencies) => {
                  if (nameTaken) return;
                  createPropertyMutation.mutate(
                    {
                      pageId,
                      name: name.trim() || fallbackName,
                      type: "formula",
                      typeOptions: {
                        source,
                        ast,
                        resultType,
                        dependencies,
                        astVersion: 1,
                      } as TypeOptions,
                    },
                    { onSuccess: (created) => onPropertyCreated?.(created) },
                  );
                  handleClose();
                }}
              />
            </Stack>
          )}
          {(panel === "configure" || panel === "confirmDiscard") && selectedType !== "formula" && (
            <Stack gap={0} p="sm" style={panel === "confirmDiscard" ? { display: "none" } : undefined}>
              <TextInput
                ref={nameInputRef}
                size="xs"
                label={t("Name")}
                placeholder={fallbackName}
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                onKeyDown={handleNameKeyDown}
                error={nameTaken ? t("A property with this name already exists") : undefined}
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
                      dropdownPortalTarget={dropdownNode}
                    />
                  </ScrollArea.Autosize>
                </>
              )}

              <Divider my="xs" />
              <Group gap="xs" justify="flex-end">
                <Button variant="default" size="xs" onClick={attemptClose}>
                  {t("Cancel")}
                </Button>
                <Button size="xs" onClick={handleCreate} disabled={nameTaken}>
                  {t("Create property")}
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
          </div>
        </Popover.Dropdown>
      </Popover>
    </>
  );
}
