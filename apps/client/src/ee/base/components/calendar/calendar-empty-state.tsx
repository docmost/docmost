import { Button, Select, Stack } from "@mantine/core";
import { IconCalendar, IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/ui/empty-state";
import { IBase, IBaseView } from "@/ee/base/types/base.types";
import { useBaseEditable } from "@/ee/base/context/base-editable";
import { useUpdateCalendarConfig } from "@/ee/base/queries/base-view-query";
import { getCalendarDateProperties } from "@/ee/base/services/calendar-events";
import { useCreateCalendarDateProperty } from "@/ee/base/components/calendar/use-create-calendar-date-property";

type CalendarEmptyStateProps = {
  base: IBase;
  view: IBaseView;
  pageId: string;
};

export function CalendarEmptyState({ base, view, pageId }: CalendarEmptyStateProps) {
  const { t } = useTranslation();
  const editable = useBaseEditable();
  const updateCalendarConfig = useUpdateCalendarConfig(pageId, view.id);
  const { createDateProperty, isCreating } = useCreateCalendarDateProperty(
    pageId,
    base.properties,
  );

  const dateProperties = getCalendarDateProperties(base.properties);
  const title = view.config?.calendar?.datePropertyId
    ? t("This calendar's date property is no longer available.")
    : t("This calendar has no date property yet.");

  if (!editable) {
    return (
      <EmptyState
        icon={IconCalendar}
        title={title}
        description={t("Records will appear here once someone with edit access chooses a date property.")}
      />
    );
  }

  const hasDateProperties = dateProperties.length > 0;

  return (
    <EmptyState
      icon={IconCalendar}
      title={title}
      description={
        hasDateProperties
          ? t("Choose a date property to show records on the calendar.")
          : t("Create a date property to show records on the calendar.")
      }
      action={
        <Stack align="center" gap="xs" mt="xs">
          {hasDateProperties && (
            <Select
              aria-label={t("Calendar by")}
              placeholder={t("Choose a property")}
              data={dateProperties.map((p) => ({ value: p.id, label: p.name }))}
              value={null}
              onChange={(value) => {
                if (value) updateCalendarConfig({ datePropertyId: value });
              }}
              w={240}
            />
          )}
          <Button
            variant={hasDateProperties ? "subtle" : "light"}
            size="sm"
            leftSection={<IconPlus size={16} />}
            loading={isCreating}
            onClick={() =>
              createDateProperty((property) =>
                updateCalendarConfig({ datePropertyId: property.id }),
              )
            }
          >
            {t("Create date property")}
          </Button>
        </Stack>
      }
    />
  );
}
