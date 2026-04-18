import { useState, useCallback, useRef, useEffect } from "react";
import {
  UnstyledButton,
  TextInput,
  Button,
  Stack,
  Text,
  Group,
  ActionIcon,
  Divider,
  ScrollArea,
} from "@mantine/core";
import {
  IconTrash,
  IconPencil,
  IconChevronRight,
  IconSettings,
} from "@tabler/icons-react";
import { IBaseProperty } from "@/features/base/types/base.types";
import { useAtom } from "jotai";
import { propertyMenuCloseRequestAtom } from "@/features/base/atoms/base-atoms";
import {
  useUpdatePropertyMutation,
  useDeletePropertyMutation,
} from "@/features/base/queries/base-property-query";
import { propertyTypes } from "./property-type-picker";
import { PropertyOptions } from "./property-options";
import { useTranslation } from "react-i18next";
import { isSystemPropertyType } from "@/features/base/hooks/use-base-table";
import cellClasses from "@/features/base/styles/cells.module.css";

type PropertyMenuContentProps = {
  property: IBaseProperty;
  opened: boolean;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
};

type MenuPanel = "main" | "rename" | "options" | "confirmDelete" | "confirmDiscard";

export function PropertyMenuContent({
  property,
  opened,
  onClose,
  onDirtyChange,
}: PropertyMenuContentProps) {
  const { t } = useTranslation();
  const [panel, setPanel] = useState<MenuPanel>("main");
  const [renameValue, setRenameValue] = useState(property.name);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [optionsDirty, setOptionsDirty] = useState(false);
  const pendingActionRef = useRef<"back" | "close" | null>(null);
  const [closeRequest] = useAtom(propertyMenuCloseRequestAtom) as unknown as [number];
  const closeRequestRef = useRef(closeRequest);

  const updatePropertyMutation = useUpdatePropertyMutation();
  const deletePropertyMutation = useDeletePropertyMutation();

  useEffect(() => {
    if (opened) {
      setPanel("main");
      setRenameValue(property.name);
      setOptionsDirty(false);
    }
  }, [opened, property.name]);

  useEffect(() => {
    if (panel === "rename") {
      setTimeout(() => renameInputRef.current?.select(), 0);
    }
  }, [panel]);

  const handleOptionsDirtyChange = useCallback(
    (dirty: boolean) => {
      setOptionsDirty(dirty);
      onDirtyChange?.(dirty);
    },
    [onDirtyChange],
  );

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== property.name) {
      updatePropertyMutation.mutate({
        propertyId: property.id,
        baseId: property.baseId,
        name: trimmed,
      });
    }
  }, [renameValue, property, updatePropertyMutation]);

  const handleRenameAndClose = useCallback(() => {
    commitRename();
    onClose();
  }, [commitRename, onClose]);

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === "Enter") {
        e.preventDefault();
        handleRenameAndClose();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    },
    [handleRenameAndClose, onClose],
  );

  const handleOptionsUpdate = useCallback(
    (typeOptions: Record<string, unknown>) => {
      updatePropertyMutation.mutate({
        propertyId: property.id,
        baseId: property.baseId,
        typeOptions,
      });
      setOptionsDirty(false);
    },
    [property, updatePropertyMutation],
  );

  const handleDelete = useCallback(() => {
    deletePropertyMutation.mutate({
      propertyId: property.id,
      baseId: property.baseId,
    });
    onClose();
  }, [property, deletePropertyMutation, onClose]);

  const handleOptionsBack = useCallback(() => {
    if (optionsDirty) {
      pendingActionRef.current = "back";
      setPanel("confirmDiscard");
    } else {
      setPanel("main");
    }
  }, [optionsDirty]);

  const requestClose = useCallback(() => {
    if (panel === "options" && optionsDirty) {
      pendingActionRef.current = "close";
      setPanel("confirmDiscard");
    } else {
      onClose();
    }
  }, [panel, optionsDirty, onClose]);

  useEffect(() => {
    if (closeRequest !== closeRequestRef.current) {
      closeRequestRef.current = closeRequest;
      if (opened) {
        requestClose();
      }
    }
  }, [closeRequest, opened, requestClose]);

  const handleConfirmDiscard = useCallback(() => {
    setOptionsDirty(false);
    onDirtyChange?.(false);
    const action = pendingActionRef.current;
    pendingActionRef.current = null;
    if (action === "back") {
      setPanel("main");
    } else {
      onClose();
    }
  }, [onClose, onDirtyChange]);

  const handleCancelDiscard = useCallback(() => {
    pendingActionRef.current = null;
    setPanel("options");
  }, []);

  return (
    <>
      {panel === "main" && (
        <MainPanel
          property={property}
          onRename={() => setPanel("rename")}
          onOptions={() => setPanel("options")}
          onDelete={() => setPanel("confirmDelete")}
        />
      )}
      {panel === "rename" && (
        <Stack gap="xs" p="sm">
          <Text size="xs" fw={600} c="dimmed">
            {t("Rename property")}
          </Text>
          <TextInput
            ref={renameInputRef}
            size="xs"
            value={renameValue}
            onChange={(e) => setRenameValue(e.currentTarget.value)}
            onKeyDown={handleRenameKeyDown}
          />
          <Divider />
          <Group justify="flex-end" gap="xs">
            <Button variant="default" size="xs" onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button
              size="xs"
              onClick={handleRenameAndClose}
              disabled={!renameValue.trim() || renameValue.trim() === property.name}
            >
              {t("Save")}
            </Button>
          </Group>
        </Stack>
      )}
      {(panel === "options" || panel === "confirmDiscard") && (
        <Stack gap="xs" p="sm" style={panel === "confirmDiscard" ? { display: "none" } : undefined}>
          <Group gap="xs">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="xs"
              onClick={handleOptionsBack}
            >
              <IconChevronRight
                size={14}
                style={{ transform: "rotate(180deg)" }}
              />
            </ActionIcon>
            <Text size="xs" fw={600} c="dimmed">
              {t("Property options")}
            </Text>
          </Group>
          <ScrollArea.Autosize mah={400} scrollbarSize={6} offsetScrollbars>
            <PropertyOptions
              property={property}
              onUpdate={handleOptionsUpdate}
              onClose={onClose}
              onDirtyChange={handleOptionsDirtyChange}
            />
          </ScrollArea.Autosize>
        </Stack>
      )}
      {panel === "confirmDelete" && (
        <Stack gap="xs" p="sm">
          <Text size="sm" fw={600}>
            {t("Delete property")}
          </Text>
          <Text size="xs" c="dimmed">
            {t("Are you sure you want to delete")} <b>{property.name}</b>?{" "}
            {t("All data in this column will be lost.")}
          </Text>
          <Group gap="xs" justify="flex-end">
            <Button
              variant="default"
              size="xs"
              onClick={() => setPanel("main")}
            >
              {t("Cancel")}
            </Button>
            <Button
              color="red"
              size="xs"
              onClick={handleDelete}
            >
              {t("Delete")}
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
    </>
  );
}

// Expose requestClose for use by parent (grid-header-cell)
PropertyMenuContent.displayName = "PropertyMenuContent";

function MenuItem({
  icon,
  label,
  rightIcon,
  color,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  rightIcon?: React.ReactNode;
  color?: string;
  onClick: () => void;
}) {
  return (
    <UnstyledButton
      className={cellClasses.menuItem}
      onClick={onClick}
      style={{ color: color ? `var(--mantine-color-${color}-6)` : undefined }}
    >
      <Group gap={8} wrap="nowrap" style={{ flex: 1 }}>
        {icon}
        <Text size="sm">{label}</Text>
      </Group>
      {rightIcon}
    </UnstyledButton>
  );
}

function MainPanel({
  property,
  onRename,
  onOptions,
  onDelete,
}: {
  property: IBaseProperty;
  onRename: () => void;
  onOptions: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();

  const isSystem = isSystemPropertyType(property.type);

  const hasOptions =
    !isSystem &&
    (property.type === "select" ||
    property.type === "multiSelect" ||
    property.type === "status" ||
    property.type === "number" ||
    property.type === "date");

  const typeDef = propertyTypes.find((pt) => pt.type === property.type);
  const TypeIcon = typeDef?.icon;

  return (
    <Stack gap={0} p={4}>
      <MenuItem
        icon={<IconPencil size={14} />}
        label={t("Rename")}
        onClick={onRename}
      />
      {!isSystem && (
        <Stack gap={4} px="sm" py={6}>
          <Text size="xs" c="dimmed">{t("Type")}</Text>
          <TextInput
            size="xs"
            value={typeDef ? t(typeDef.labelKey) : property.type}
            disabled
            leftSection={TypeIcon ? <TypeIcon size={14} /> : null}
            readOnly
          />
        </Stack>
      )}
      {hasOptions && (
        <MenuItem
          icon={<IconSettings size={14} />}
          label={t("Options")}
          rightIcon={<IconChevronRight size={14} />}
          onClick={onOptions}
        />
      )}
      {!property.isPrimary && (
        <>
          <Divider my={4} />
          <MenuItem
            icon={<IconTrash size={14} />}
            label={t("Delete property")}
            color="red"
            onClick={onDelete}
          />
        </>
      )}
    </Stack>
  );
}

