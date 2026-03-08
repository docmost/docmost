import { useMemo, useCallback } from "react";
import { Popover, Switch, Stack, Text, Group, Divider, UnstyledButton } from "@mantine/core";
import { IconEye, IconEyeOff } from "@tabler/icons-react";
import { Table } from "@tanstack/react-table";
import { IBaseRow, IBaseProperty } from "@/features/base/types/base.types";
import { propertyTypes } from "@/features/base/components/property/property-type-picker";
import { useTranslation } from "react-i18next";
import cellClasses from "@/features/base/styles/cells.module.css";

type ViewFieldVisibilityProps = {
  opened: boolean;
  onClose: () => void;
  table: Table<IBaseRow>;
  onPersist: () => void;
  children: React.ReactNode;
};

export function ViewFieldVisibility({
  opened,
  onClose,
  table,
  onPersist,
  children,
}: ViewFieldVisibilityProps) {
  const { t } = useTranslation();

  const columns = useMemo(() => {
    return table
      .getAllLeafColumns()
      .filter((col) => col.id !== "__row_number");
  }, [table]);

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
      onClose={onClose}
      position="bottom-end"
      shadow="md"
      width={260}
      withinPortal
    >
      <Popover.Target>{children}</Popover.Target>
      <Popover.Dropdown p="xs">
        <Stack gap={4}>
          <Group justify="space-between" px={4} py={2}>
            <Text size="xs" fw={600} c="dimmed">
              {t("Fields")}
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
                    <Text size="sm" style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {property.name}
                    </Text>
                  </Group>
                  <Switch
                    size="xs"
                    checked={isVisible}
                    disabled={!canHide}
                    onChange={() => {}}
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
