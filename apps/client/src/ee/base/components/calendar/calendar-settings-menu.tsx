import { useState } from "react";
import {
  ActionIcon,
  Button,
  Popover,
  Select,
  Stack,
  Switch,
  Text,
  Tooltip,
} from "@mantine/core";
import { IconPlus, IconSettings } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IBase, IBaseView } from "@/ee/base/types/base.types";
import { useUpdateCalendarConfig } from "@/ee/base/queries/base-view-query";
import { getCalendarDateProperties } from "@/ee/base/services/calendar-events";
import { useCreateCalendarDateProperty } from "@/ee/base/components/calendar/use-create-calendar-date-property";

type CalendarSettingsMenuProps = {
  base: IBase;
  view: IBaseView;
  pageId: string;
};

export function CalendarSettingsMenu({ base, view, pageId }: CalendarSettingsMenuProps) {
  const { t } = useTranslation();
  const [opened, setOpened] = useState(false);
  const updateCalendarConfig = useUpdateCalendarConfig(pageId, view.id);
  const { createDateProperty, isCreating } = useCreateCalendarDateProperty(
    pageId,
    base.properties,
  );
  const calendarConfig = view.config?.calendar;

  const dateProperties = getCalendarDateProperties(base.properties);
  const datePropertyId =
    dateProperties.find((p) => p.id === calendarConfig?.datePropertyId)?.id ?? null;

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      position="bottom-end"
      shadow="md"
      width={260}
      withinPortal
      trapFocus
      closeOnEscape
      closeOnClickOutside
    >
      <Popover.Target>
        <Tooltip label={t("Calendar settings")}>
          <ActionIcon
            variant="subtle"
            size="sm"
            color="gray"
            aria-label={t("Calendar settings")}
            onClick={() => setOpened((o) => !o)}
          >
            <IconSettings size={16} />
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown p="xs">
        <Stack gap={8}>
          <Text size="xs" fw={600} c="dimmed">
            {t("Calendar by")}
          </Text>
          <Select
            size="xs"
            aria-label={t("Calendar by")}
            placeholder={t("Select a property")}
            nothingFoundMessage={t("No date properties")}
            data={dateProperties.map((p) => ({ value: p.id, label: p.name }))}
            value={datePropertyId}
            onChange={(value) => {
              if (value && value !== datePropertyId) {
                updateCalendarConfig({ datePropertyId: value });
              }
            }}
            allowDeselect={false}
            comboboxProps={{ withinPortal: false }}
          />
          <Button
            variant="subtle"
            color="gray"
            size="xs"
            justify="flex-start"
            leftSection={<IconPlus size={14} />}
            loading={isCreating}
            onClick={() =>
              createDateProperty((property) =>
                updateCalendarConfig({ datePropertyId: property.id }),
              )
            }
          >
            {t("Create date property")}
          </Button>
          <Switch
            size="xs"
            label={t("Show weekends")}
            checked={calendarConfig?.showWeekends ?? true}
            onChange={(event) =>
              updateCalendarConfig({ showWeekends: event.currentTarget.checked })
            }
          />
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
