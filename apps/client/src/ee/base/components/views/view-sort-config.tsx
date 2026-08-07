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
} from "@/ee/base/types/base.types";
import { useTranslation } from "react-i18next";
import { useEscapeClose } from "@/ee/base/hooks/use-escape-close";
import viewClasses from "@/ee/base/styles/views.module.css";

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
  useEscapeClose(opened, onClose);
  const [draft, setDraft] = useState<ViewSortConfig | null>(null);

  useEffect(() => {
    if (!opened) setDraft(null);
  }, [opened]);

  // Page props sort by raw UUID; hide until title-based sort is supported.
  const sortableProperties = properties.filter((p) => p.type !== "page");

  const propertyOptions = sortableProperties.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const directionOptions = [
    { value: "asc", label: t("Ascending") },
    { value: "desc", label: t("Descending") },
  ];

  const handleStartDraft = useCallback(() => {
    const usedIds = new Set(sorts.map((s) => s.propertyId));
    const available = sortableProperties.find((p) => !usedIds.has(p.id));
    if (!available) return;
    setDraft({ propertyId: available.id, direction: "asc" });
  }, [sorts, sortableProperties]);

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

  const canAddMore =
    sortableProperties.length > sorts.length + (draft ? 1 : 0);

  return (
    <Popover
      opened={opened}
      onChange={(o) => {
        if (!o) onClose();
      }}
      onClose={onClose}
      position="bottom-end"
      shadow="md"
      width={340}
      trapFocus
      closeOnEscape
      closeOnClickOutside
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
                comboboxProps={{ withinPortal: false }}
                data={propertyOptions}
                value={sort.propertyId}
                onChange={(val) => handlePropertyChange(index, val)}
                style={{ flex: 1 }}
              />
              <Select
                size="xs"
                comboboxProps={{ withinPortal: false }}
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
                  comboboxProps={{ withinPortal: false }}
                  data={propertyOptions}
                  value={draft.propertyId}
                  onChange={(val) =>
                    val && setDraft({ ...draft, propertyId: val })
                  }
                  style={{ flex: 1 }}
                />
                <Select
                  size="xs"
                  comboboxProps={{ withinPortal: false }}
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
              className={viewClasses.addActionButton}
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
