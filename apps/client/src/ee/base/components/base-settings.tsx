import { useMemo, useState } from "react";
import { ActionIcon, Button, Group, Modal, Select, Stack, Tooltip } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconDatabaseCog } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { IBase } from "@/ee/base/types/base.types";
import { useUpdateBaseMutation } from "@/ee/base/queries/base-query";
import { listTimeZones, timeZoneName } from "@/ee/base/utils/time-zones";

type BaseSettingsButtonProps = {
  base: IBase;
};

export function BaseSettingsButton({ base }: BaseSettingsButtonProps) {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Tooltip label={t("Base settings")}>
        <ActionIcon
          variant="subtle"
          size="sm"
          color="gray"
          onClick={open}
          aria-label={t("Base settings")}
        >
          <IconDatabaseCog size={16} />
        </ActionIcon>
      </Tooltip>
      <Modal
        opened={opened}
        onClose={close}
        title={t("Base settings")}
        centered
        size="sm"
      >
        {opened && <BaseSettingsForm base={base} onClose={close} />}
      </Modal>
    </>
  );
}

type BaseSettingsFormProps = {
  base: IBase;
  onClose: () => void;
};

function BaseSettingsForm({ base, onClose }: BaseSettingsFormProps) {
  const { t } = useTranslation();
  const updateBaseMutation = useUpdateBaseMutation();
  const stored = base.baseTimeZone ?? "UTC";
  const [timeZone, setTimeZone] = useState(stored);
  const timeZoneOptions = useMemo(
    () =>
      listTimeZones(stored).map((zone) => ({
        value: zone,
        label: timeZoneName(zone),
      })),
    [stored],
  );

  const handleSave = () => {
    updateBaseMutation.mutate(
      { pageId: base.id, timeZone },
      { onSuccess: onClose },
    );
  };

  return (
    <Stack>
      <Select
        label={t("Time zone")}
        description={t("Formulas and date conversions use this time zone")}
        searchable
        allowDeselect={false}
        nothingFoundMessage={t("No options found")}
        maxDropdownHeight={280}
        data={timeZoneOptions}
        value={timeZone}
        onChange={(value) => value && setTimeZone(value)}
      />
      <Group justify="flex-end" gap="xs">
        <Button variant="default" onClick={onClose}>
          {t("Cancel")}
        </Button>
        <Button
          onClick={handleSave}
          disabled={timeZone === stored}
          loading={updateBaseMutation.isPending}
        >
          {t("Save")}
        </Button>
      </Group>
    </Stack>
  );
}
