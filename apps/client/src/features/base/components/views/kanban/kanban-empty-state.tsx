import { Stack, Text } from "@mantine/core";
import { IconColumns3 } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IBase } from "@/features/base/types/base.types";
import { KanbanGroupByPicker } from "./kanban-group-by-picker";
import { CreatePropertyPopover } from "@/features/base/components/property/create-property-popover";

type KanbanEmptyStateProps = {
  base: IBase;
  onPick: (propertyId: string) => void;
};

export function KanbanEmptyState({ base, onPick }: KanbanEmptyStateProps) {
  const { t } = useTranslation();
  const hasGroupable = base.properties.some(
    (p) => p.type === "select" || p.type === "status",
  );

  return (
    <Stack align="center" gap="md" p="xl" mt={48}>
      <IconColumns3 size={48} color="var(--mantine-color-gray-5)" />
      <Text size="lg" fw={500}>
        {t("Choose a property to group by")}
      </Text>
      {hasGroupable ? (
        <KanbanGroupByPicker
          properties={base.properties}
          value={null}
          onChange={onPick}
        />
      ) : (
        <Stack align="center" gap="xs">
          <Text size="sm" c="dimmed">
            {t("Create a select or status property to use the kanban view.")}
          </Text>
          <CreatePropertyPopover
            pageId={base.id}
            properties={base.properties}
            onPropertyCreated={() => {
              // The base query invalidates on property create — the empty
              // state will re-render with the picker variant. The user
              // then picks the new property explicitly. (Auto-picking the
              // new property requires receiving its id from the create
              // mutation, which the current popover doesn't expose. Keep
              // the explicit step for now.)
            }}
          />
        </Stack>
      )}
    </Stack>
  );
}
