import { useCallback } from "react";
import {
  Popover,
  Stack,
  Group,
  Select,
  ActionIcon,
  Text,
  UnstyledButton,
} from "@mantine/core";
import { IconPlus, IconTrash, IconSortAscending } from "@tabler/icons-react";
import {
  IBaseProperty,
  ViewSortConfig,
} from "@/features/base/types/base.types";
import { useTranslation } from "react-i18next";

type ViewSortConfigProps = {
  opened: boolean;
  onClose: () => void;
  sorts: ViewSortConfig[];
  properties: IBaseProperty[];
  onChange: (sorts: ViewSortConfig[]) => void;
  children: React.ReactNode;
};

export function ViewSortConfigPopover({
  opened,
  onClose,
  sorts,
  properties,
  onChange,
  children,
}: ViewSortConfigProps) {
  const { t } = useTranslation();

  const propertyOptions = properties.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const directionOptions = [
    { value: "asc", label: t("Ascending") },
    { value: "desc", label: t("Descending") },
  ];

  const handleAdd = useCallback(() => {
    const usedIds = new Set(sorts.map((s) => s.propertyId));
    const available = properties.find((p) => !usedIds.has(p.id));
    if (!available) return;
    onChange([...sorts, { propertyId: available.id, direction: "asc" }]);
  }, [sorts, properties, onChange]);

  const handleRemove = useCallback(
    (index: number) => {
      onChange(sorts.filter((_, i) => i !== index));
    },
    [sorts, onChange],
  );

  const handlePropertyChange = useCallback(
    (index: number, propertyId: string | null) => {
      if (!propertyId) return;
      onChange(
        sorts.map((s, i) => (i === index ? { ...s, propertyId } : s)),
      );
    },
    [sorts, onChange],
  );

  const handleDirectionChange = useCallback(
    (index: number, direction: string | null) => {
      if (!direction) return;
      onChange(
        sorts.map((s, i) =>
          i === index
            ? { ...s, direction: direction as "asc" | "desc" }
            : s,
        ),
      );
    },
    [sorts, onChange],
  );

  return (
    <Popover
      opened={opened}
      onClose={onClose}
      position="bottom-end"
      shadow="md"
      width={340}
      trapFocus
      withinPortal
    >
      <Popover.Target>{children}</Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="xs" fw={600} c="dimmed">
            {t("Sort by")}
          </Text>

          {sorts.length === 0 && (
            <Text size="xs" c="dimmed">
              {t("No sorts applied")}
            </Text>
          )}

          {sorts.map((sort, index) => (
            <Group key={index} gap="xs" wrap="nowrap">
              <Select
                size="xs"
                data={propertyOptions}
                value={sort.propertyId}
                onChange={(val) => handlePropertyChange(index, val)}
                style={{ flex: 1 }}
              />
              <Select
                size="xs"
                data={directionOptions}
                value={sort.direction}
                onChange={(val) => handleDirectionChange(index, val)}
                w={110}
              />
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={() => handleRemove(index)}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          ))}

          <UnstyledButton
            onClick={handleAdd}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 0",
              fontSize: "var(--mantine-font-size-xs)",
              color: "var(--mantine-color-blue-6)",
            }}
          >
            <IconPlus size={14} />
            {t("Add sort")}
          </UnstyledButton>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
