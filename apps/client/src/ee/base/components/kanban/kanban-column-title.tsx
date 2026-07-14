import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Group, Popover, Text, TextInput, UnstyledButton } from "@mantine/core";
import { IBaseProperty, KanbanColumn, SelectTypeOptions } from "@/ee/base/types/base.types";
import { useUpdatePropertyMutation } from "@/ee/base/queries/base-property-query";
import classes from "@/ee/base/styles/kanban.module.css";

type KanbanColumnTitleProps = {
  column: KanbanColumn;
  property: IBaseProperty | undefined;
  pageId: string;
  canEdit: boolean;
};

export function KanbanColumnTitle({ column, property, pageId, canEdit }: KanbanColumnTitleProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const [draft, setDraft] = useState("");
  const updateProperty = useUpdatePropertyMutation();

  const commit = useCallback(() => {
    setOpened(false);
    const name = draft.trim();
    const options = property?.typeOptions as SelectTypeOptions | undefined;
    if (!property || !options || !name || name === column.name) return;
    if (!options.choices.some((c) => c.id === column.key)) return;
    updateProperty.mutate({
      propertyId: property.id,
      pageId,
      typeOptions: {
        ...options,
        choices: options.choices.map((c) =>
          c.id === column.key ? { ...c, name } : c,
        ),
      },
    });
  }, [draft, property, column.name, column.key, pageId, updateProperty]);

  const toggle = useCallback(() => {
    if (opened) {
      commit();
    } else {
      setDraft(column.name);
      setOpened(true);
    }
  }, [opened, commit, column.name]);

  const cancel = useCallback(() => setOpened(false), []);

  if (!canEdit || column.isNoValue || !property) {
    return (
      <Text fw={600} size="sm" flex={1} truncate>
        {column.isNoValue ? t("No value") : column.name}
      </Text>
    );
  }

  return (
    <Popover
      opened={opened}
      onChange={(next) => {
        if (!next) commit();
      }}
      position="bottom-start"
      shadow="md"
      width={240}
      withinPortal
      trapFocus
      returnFocus
      closeOnClickOutside
      closeOnEscape={false}
    >
      <Popover.Target>
        <UnstyledButton className={classes.columnTitleButton} onClick={toggle}>
          <Text fw={600} size="sm" truncate flex={1} ta="left">
            {column.name}
          </Text>
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown
        p="xs"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            cancel();
          }
        }}
      >
        <Group gap="xs" wrap="nowrap">
          <TextInput
            size="xs"
            flex={1}
            value={draft}
            data-autofocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setDraft(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
          />
          <Button size="xs" onClick={commit}>
            {t("Done")}
          </Button>
        </Group>
      </Popover.Dropdown>
    </Popover>
  );
}
