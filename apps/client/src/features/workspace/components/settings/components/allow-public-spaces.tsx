import { Group, Text, Switch } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useAtom } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";

export default function AllowPublicSpaces() {
  const { t } = useTranslation();
  const [workspace] = useAtom(workspaceAtom);

  return (
    <>
      <Group justify="space-between" wrap="nowrap" gap="xl">
        <div>
          <Text size="md">{t("Allow public spaces")}</Text>
          <Text size="sm" c="dimmed">
            {t("Space admins can publish their spaces to the web.")}
          </Text>
        </div>

        <AllowPublicSpacesToggle />
      </Group>

      {workspace?.settings?.publicSpaces?.enabled === true && (
        <Group justify="space-between" wrap="nowrap" gap="xl" mt="md">
          <div>
            <Text size="md">{t("Show public directory")}</Text>
            <Text size="sm" c="dimmed">
              {t("List published spaces at /docs for anyone to browse.")}
            </Text>
          </div>

          <PublicSpacesDirectoryToggle />
        </Group>
      )}
    </>
  );
}

function PublicSpacesDirectoryToggle() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [checked, setChecked] = useState(
    workspace?.settings?.publicSpaces?.directory === true,
  );

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    try {
      const updatedWorkspace = await updateWorkspace({
        publicSpacesDirectory: value,
      });
      setChecked(value);
      setWorkspace(updatedWorkspace);
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message,
        color: "red",
      });
    }
  };

  return (
    <Switch
      checked={checked}
      onChange={handleChange}
      aria-label={t("Toggle show public directory")}
    />
  );
}

function AllowPublicSpacesToggle() {
  const { t } = useTranslation();
  const [workspace, setWorkspace] = useAtom(workspaceAtom);
  const [checked, setChecked] = useState(
    workspace?.settings?.publicSpaces?.enabled === true,
  );

  const applyChange = async (value: boolean) => {
    try {
      const updatedWorkspace = await updateWorkspace({
        allowPublicSpaces: value,
      });
      setChecked(value);
      setWorkspace(updatedWorkspace);
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message,
        color: "red",
      });
    }
  };

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    modals.openConfirmModal({
      title: value ? t("Allow public spaces") : t("Disable public spaces"),
      children: (
        <Text size="sm">
          {value
            ? t(
                "Space admins will be able to make their spaces publicly readable by anyone on the internet. Are you sure?",
              )
            : t(
                "This will immediately unpublish every published space. Re-enabling later will not republish them. Are you sure?",
              )}
        </Text>
      ),
      centered: true,
      labels: {
        confirm: value ? t("Allow") : t("Disable"),
        cancel: t("Cancel"),
      },
      confirmProps: value ? undefined : { color: "red" },
      onConfirm: () => applyChange(value),
    });
  };

  return (
    <Switch
      checked={checked}
      onChange={handleChange}
      aria-label={t("Toggle allow public spaces")}
    />
  );
}
