import { useCallback } from "react";
import { Stack, Text, Select, Button } from "@mantine/core";
import { v7 as uuid7 } from "uuid";
import { useTranslation } from "react-i18next";
import { IBase, IBaseView } from "@/ee/base/types/base.types";
import { useUpdateViewMutation } from "@/ee/base/queries/base-view-query";
import { useCreatePropertyMutation } from "@/ee/base/queries/base-property-query";

type KanbanEmptyStateProps = {
  base: IBase;
  view: IBaseView;
  pageId: string;
  editable: boolean;
};

export function KanbanEmptyState({ base, view, pageId, editable }: KanbanEmptyStateProps) {
  const { t } = useTranslation();
  const updateView = useUpdateViewMutation();
  const createProperty = useCreatePropertyMutation();

  const groupableProperties = base.properties.filter(
    (p) => p.type === "select" || p.type === "status",
  );

  const selectData = groupableProperties.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const handleSelect = useCallback(
    (value: string | null) => {
      if (!value) return;
      updateView.mutate({ viewId: view.id, pageId, config: { groupByPropertyId: value } });
    },
    [updateView, view.id, pageId],
  );

  const handleCreateStatus = useCallback(() => {
    const todoId = uuid7();
    const inProgressId = uuid7();
    const completeId = uuid7();
    createProperty.mutate(
      {
        pageId,
        name: t("Status"),
        type: "status",
        typeOptions: {
          choices: [
            { id: todoId, name: t("Not started"), color: "gray", category: "todo" },
            { id: inProgressId, name: t("In progress"), color: "blue", category: "inProgress" },
            { id: completeId, name: t("Done"), color: "green", category: "complete" },
          ],
          choiceOrder: [todoId, inProgressId, completeId],
        },
      },
      {
        onSuccess: (newProperty) => {
          updateView.mutate({
            viewId: view.id,
            pageId,
            config: { groupByPropertyId: newProperty.id },
          });
        },
      },
    );
  }, [createProperty, updateView, view.id, pageId, t]);

  if (!editable) {
    return (
      <Stack align="center" justify="center" gap="md" style={{ flex: 1 }}>
        <Text fw={500}>{t("This board has no grouping property yet.")}</Text>
      </Stack>
    );
  }

  return (
    <Stack align="center" justify="center" gap="md" style={{ flex: 1 }}>
      <Text fw={500}>{t("Group this board by a select or status property.")}</Text>
      {groupableProperties.length > 0 ? (
        <Select
          placeholder={t("Choose a property")}
          data={selectData}
          value={view.config?.groupByPropertyId ?? null}
          onChange={handleSelect}
          w={240}
        />
      ) : (
        <Button
          variant="light"
          size="sm"
          onClick={handleCreateStatus}
          loading={createProperty.isPending}
        >
          {t("Create a status property")}
        </Button>
      )}
    </Stack>
  );
}
