import { useCallback, useEffect, useState } from "react";
import {
  Popover,
  Stack,
  Group,
  Select,
  ActionIcon,
  Text,
  UnstyledButton,
  Button,
} from "@mantine/core";
import { IconPlus, IconTrash } from "@tabler/icons-react";
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
  const [draft, setDraft] = useState<ViewSortConfig | null>(null);

  // Discard any half-configured draft when the popover closes.
  useEffect(() => {
    if (!opened) setDraft(null);
  }, [opened]);

  const propertyOptions = properties.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const directionOptions = [
    { value: "asc", label: t("Ascending") },
    { value: "desc", label: t("Descending") },
  ];

  const handleStartDraft = useCallback(() => {
    const usedIds = new Set(sorts.map((s) => s.propertyId));
    const available = properties.find((p) => !usedIds.has(p.id));
    if (!available) return;
    setDraft({ propertyId: available.id, direction: "asc" });
  }, [sorts, properties]);

  const handleSaveDraft = useCallback(() => {
    if (!draft) return;
    onChange([...sorts, draft]);
    setDraft(null);
  }, [draft, sorts, onChange]);

  const handleCancelDraft = useCallback(() => {
    setDraft(null);
  }, []);

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

  const canAddMore = properties.length > sorts.length + (draft ? 1 : 0);

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

          {sorts.length === 0 && !draft && (
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

          {draft && (
            <Stack gap={6}>
              <Group gap="xs" wrap="nowrap">
                <Select
                  size="xs"
                  data={propertyOptions}
                  value={draft.propertyId}
                  onChange={(val) =>
                    val && setDraft({ ...draft, propertyId: val })
                  }
                  style={{ flex: 1 }}
                />
                <Select
                  size="xs"
                  data={directionOptions}
                  value={draft.direction}
                  onChange={(val) =>
                    val &&
                    setDraft({
                      ...draft,
                      direction: val as "asc" | "desc",
                    })
                  }
                  w={110}
                />
              </Group>
              <Group justify="flex-end" gap="xs">
                <Button
                  variant="default"
                  size="xs"
                  onClick={handleCancelDraft}
                >
                  {t("Cancel")}
                </Button>
                <Button size="xs" onClick={handleSaveDraft}>
                  {t("Save")}
                </Button>
              </Group>
            </Stack>
          )}

          {!draft && canAddMore && (
            <UnstyledButton
              onClick={handleStartDraft}
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
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
