import { Popover, Select, Stack, Text, Switch, Group, UnstyledButton } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { IBase, IBaseView } from "@/ee/base/types/base.types";
import { useUpdateViewMutation } from "@/ee/base/queries/base-view-query";
import { useKanbanColumns } from "@/ee/base/hooks/use-kanban-columns";
import { choiceColor } from "@/ee/base/components/cells/choice-color";
import cellClasses from "@/ee/base/styles/cells.module.css";

type KanbanGroupByPickerProps = {
  base: IBase;
  view: IBaseView;
  pageId: string;
  children: React.ReactNode;
};

export function KanbanGroupByPicker({ base, view, pageId, children }: KanbanGroupByPickerProps) {
  const { t } = useTranslation();
  const updateView = useUpdateViewMutation();
  const { allGroups, hasValidGroupBy } = useKanbanColumns(base, view);

  const data = base.properties
    .filter((p) => p.type === "select" || p.type === "status")
    .map((p) => ({ value: p.id, label: p.name }));

  const handleChange = (value: string | null) => {
    updateView.mutate({
      viewId: view.id,
      pageId,
      config: { groupByPropertyId: value ?? null },
    });
  };

  const toggleGroup = (key: string, currentlyHidden: boolean) => {
    const current = view.config?.hiddenChoiceIds ?? [];
    const next = currentlyHidden
      ? current.filter((k) => k !== key)
      : [...current, key];
    updateView.mutate({ viewId: view.id, pageId, config: { hiddenChoiceIds: next } });
  };

  return (
    <Popover
      position="bottom-end"
      shadow="md"
      width={300}
      withinPortal
      trapFocus
      closeOnEscape
      closeOnClickOutside
    >
      <Popover.Target>{children}</Popover.Target>
      <Popover.Dropdown p="xs">
        <Stack gap={8}>
          <Text size="xs" fw={600} c="dimmed">
            {t("Group by")}
          </Text>
          <Select
            size="xs"
            placeholder={t("Select a property")}
            data={data}
            value={view.config?.groupByPropertyId ?? null}
            onChange={handleChange}
            clearable
          />
          {hasValidGroupBy && allGroups.length > 0 && (
            <Stack gap={4}>
              <Text size="xs" fw={600} c="dimmed">
                {t("Groups")}
              </Text>
              <Stack gap={0}>
                {allGroups.map((g) => {
                  const dotColor = g.color
                    ? (choiceColor(g.color).color as string)
                    : "light-dark(var(--mantine-color-gray-4), var(--mantine-color-dark-3))";
                  return (
                    <UnstyledButton
                      key={g.key}
                      className={cellClasses.menuItem}
                      onClick={() => toggleGroup(g.key, g.hidden)}
                    >
                      <Group gap={8} wrap="nowrap" style={{ flex: 1 }}>
                        <span
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            flexShrink: 0,
                            background: dotColor,
                          }}
                        />
                        <Text
                          size="sm"
                          style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                        >
                          {g.isNoValue ? t("No value") : g.name}
                        </Text>
                      </Group>
                      <Switch
                        size="xs"
                        checked={!g.hidden}
                        onChange={() => {}}
                        onClick={(e) => e.stopPropagation()}
                        styles={{ track: { cursor: "pointer" } }}
                      />
                    </UnstyledButton>
                  );
                })}
              </Stack>
            </Stack>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
