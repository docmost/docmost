import { ReactNode, useMemo, useState } from "react";
import {
  Group,
  Menu,
  ScrollArea,
  Text,
  TextInput,
  useComputedColorScheme,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { IconCheck, IconSearch } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useWorkspaceLabelsQuery } from "@/features/label/queries/label-query.ts";
import { getLabelColor } from "@/features/label/utils/label-colors.ts";
import { CheckboxMenuItem } from "@/components/ui/checkbox-menu-item";

type LabelFilterMenuProps = {
  value: string[];
  onChange: (labelIds: string[]) => void;
  children: ReactNode;
  width?: number;
  position?:
    | "bottom-start"
    | "bottom-end"
    | "bottom"
    | "top-start"
    | "top-end"
    | "top";
  zIndex?: number;
  opened?: boolean;
  onOpenChange?: (opened: boolean) => void;
};

export function LabelFilterMenu({
  value,
  onChange,
  children,
  width = 280,
  position = "bottom-end",
  zIndex,
  opened,
  onOpenChange,
}: LabelFilterMenuProps) {
  const { t } = useTranslation();
  const scheme = useComputedColorScheme("light");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery] = useDebouncedValue(searchQuery, 300);

  const { data, isLoading } = useWorkspaceLabelsQuery(debouncedQuery, true);
  const labels = data?.items ?? [];

  const selectedSet = useMemo(() => new Set(value), [value]);

  const toggleLabel = (labelId: string) => {
    if (selectedSet.has(labelId)) {
      onChange(value.filter((id) => id !== labelId));
    } else {
      onChange([...value, labelId]);
    }
  };

  return (
    <Menu
      shadow="md"
      width={width}
      position={position}
      zIndex={zIndex}
      opened={opened}
      onChange={onOpenChange}
      closeOnItemClick={false}
    >
      <Menu.Target>{children}</Menu.Target>
      <Menu.Dropdown>
        <TextInput
          placeholder={t("Find a label")}
          data-autofocus
          autoFocus
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="sm"
          variant="filled"
          radius="sm"
          styles={{ input: { marginBottom: 8 } }}
        />

        <ScrollArea.Autosize mah={280}>
          {labels.length === 0 && (
            <Text size="xs" c="dimmed" px="xs" py="sm">
              {isLoading ? t("Loading...") : t("No labels found")}
            </Text>
          )}

          {labels.map((label) => {
            const isChecked = selectedSet.has(label.id);
            const color = getLabelColor(label.name, scheme);
            return (
              <Menu.Item
                key={label.id}
                type="button"
                component={CheckboxMenuItem}
                aria-checked={isChecked}
                onClick={() => toggleLabel(label.id)}
              >
                <Group flex="1" gap="xs">
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: color.dot,
                      flexShrink: 0,
                    }}
                  />
                  <Text size="sm" fw={500} style={{ flex: 1 }} truncate>
                    {label.name}
                  </Text>
                  {isChecked && <IconCheck size={20} aria-hidden />}
                </Group>
              </Menu.Item>
            );
          })}
        </ScrollArea.Autosize>
      </Menu.Dropdown>
    </Menu>
  );
}
