import { useMemo, useCallback } from "react";
import { Popover, Switch, Stack, Text, Group, Divider, UnstyledButton } from "@mantine/core";
import { Table } from "@tanstack/react-table";
import { IBaseRow, IBaseProperty } from "@/ee/base/types/base.types";
import { propertyTypes } from "@/ee/base/property-types/property-type.registry";
import { useTranslation } from "react-i18next";
import { useEscapeClose } from "@/ee/base/hooks/use-escape-close";
import cellClasses from "@/ee/base/styles/cells.module.css";
import viewClasses from "@/ee/base/styles/views.module.css";

type ViewPropertyVisibilityProps = {
  opened: boolean;
  onClose: () => void;
  table: Table<IBaseRow>;
  properties: IBaseProperty[];
  onPersist: () => void;
  children: React.ReactNode;
};

export function ViewPropertyVisibility({
  opened,
  onClose,
  table,
  properties,
  onPersist,
  children,
}: ViewPropertyVisibilityProps) {
  const { t } = useTranslation();
  useEscapeClose(opened, onClose);

  const columns = useMemo(() => {
    return table
      .getAllLeafColumns()
      .filter((col) => col.id !== "__row_number");
  }, [table, properties]);

  const allVisible = columns.every((col) => col.getIsVisible());
  const noneVisible = columns.filter((col) => col.getCanHide()).every((col) => !col.getIsVisible());

  const handleToggle = useCallback(
    (columnId: string, visible: boolean) => {
      const col = table.getColumn(columnId);
      if (!col) return;
      col.toggleVisibility(visible);
      onPersist();
    },
    [table, onPersist],
  );

  const handleShowAll = useCallback(() => {
    columns.forEach((col) => {
      if (col.getCanHide()) {
        col.toggleVisibility(true);
      }
    });
    onPersist();
  }, [columns, onPersist]);

  const handleHideAll = useCallback(() => {
    columns.forEach((col) => {
      if (col.getCanHide()) {
        col.toggleVisibility(false);
      }
    });
    onPersist();
  }, [columns, onPersist]);

  return (
    <Popover
      opened={opened}
      onChange={(o) => {
        if (!o) onClose();
      }}
      onClose={onClose}
      position="bottom-end"
      shadow="md"
      width={260}
      trapFocus
      closeOnEscape
      closeOnClickOutside
      withinPortal
    >
      <Popover.Target>{children}</Popover.Target>
      <Popover.Dropdown p="xs">
        <Stack gap={4}>
          <Group justify="space-between" px={4} py={2}>
            <Text size="xs" fw={600} c="dimmed">
              {t("Properties")}
            </Text>
            <Group gap={8}>
              <UnstyledButton
                onClick={handleShowAll}
                disabled={allVisible}
                style={{ opacity: allVisible ? 0.4 : 1 }}
              >
                <Text size="xs" c="blue">
                  {t("Show all")}
                </Text>
              </UnstyledButton>
              <UnstyledButton
                onClick={handleHideAll}
                disabled={noneVisible}
                style={{ opacity: noneVisible ? 0.4 : 1 }}
              >
                <Text size="xs" c="blue">
                  {t("Hide all")}
                </Text>
              </UnstyledButton>
            </Group>
          </Group>

          <Divider />

          <Stack gap={0}>
            {columns.map((col) => {
              const property = col.columnDef.meta?.property as IBaseProperty | undefined;
              if (!property) return null;

              const canHide = col.getCanHide();
              const isVisible = col.getIsVisible();
              const typeConfig = propertyTypes.find((pt) => pt.type === property.type);
              const TypeIcon = typeConfig?.icon;

              return (
                <UnstyledButton
                  key={col.id}
                  role="switch"
                  aria-checked={isVisible}
                  aria-disabled={!canHide || undefined}
                  className={cellClasses.menuItem}
                  onClick={() => {
                    if (canHide) {
                      handleToggle(col.id, !isVisible);
                    }
                  }}
                  style={{ opacity: canHide ? 1 : 0.5 }}
                >
                  <Group gap={8} wrap="nowrap" style={{ flex: 1 }}>
                    {TypeIcon && <TypeIcon size={14} style={{ flexShrink: 0 }} />}
                    <Text size="sm" className={viewClasses.fieldNameText}>
                      {property.name}
                    </Text>
                  </Group>
                  <Switch
                    size="xs"
                    checked={isVisible}
                    disabled={!canHide}
                    tabIndex={-1}
                    aria-hidden
                    onChange={() => {}}
                    // Clicking the track synthesizes a second click on the hidden input which bubbles
                    // to UnstyledButton, firing handleToggle twice. stopPropagation blocks only that
                    // synthetic input click so handleToggle fires exactly once.
                    onClick={(e) => e.stopPropagation()}
                    styles={{ track: { cursor: canHide ? "pointer" : "not-allowed" } }}
                  />
                </UnstyledButton>
              );
            })}
          </Stack>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
