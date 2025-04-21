import { Button, Group, Text, Modal, TextInput } from "@mantine/core";
import * as z from "zod";
import { useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import * as React from "react";
import { useForm, zodResolver } from "@mantine/form";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";
import { getSubdomainHost } from "@/lib/config.ts";
import { IWorkspace } from "@/features/workspace/types/workspace.types.ts";
import { updateWorkspace } from "@/features/workspace/services/workspace-service.ts";
import { getHostnameUrl } from "@/ee/utils.ts";
import { useAtom } from "jotai/index";
import {
  currentUserAtom,
  workspaceAtom,
} from "@/features/user/atoms/current-user-atom.ts";
import useUserRole from "@/hooks/use-user-role.tsx";
import { RESET } from "jotai/utils";

export default function ManageHostname() {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);
  const [workspace] = useAtom(workspaceAtom);
  const { isAdmin } = useUserRole();

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">{t("Hostname")}</Text>
        <Text size="sm" c="dimmed" fw={500}>
          {workspace?.hostname}.{getSubdomainHost()}
        </Text>
      </div>

      {isAdmin && (
        <Button onClick={open} variant="default">
          {t("Change hostname")}
        </Button>
      )}

      <Modal
        opened={opened}
        onClose={close}
        title={t("Change hostname")}
        centered
      >
        <ChangeHostnameForm onClose={close} />
      </Modal>
    </Group>
  );
}

const formSchema = z.object({
  hostname: z.string().min(4),
});

type FormValues = z.infer<typeof formSchema>;

interface ChangeHostnameFormProps {
  onClose?: () => void;
}
function ChangeHostnameForm({ onClose }: ChangeHostnameFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      hostname: currentUser?.workspace?.hostname,
    },
  });

  async function handleSubmit(data: Partial<IWorkspace>) {
    setIsLoading(true);

    if (data.hostname === currentUser?.workspace?.hostname) {
      onClose();
      return;
    }

    try {
      await updateWorkspace({
        hostname: data.hostname,
      });
      setCurrentUser(RESET);
      window.location.href = getHostnameUrl(data.hostname.toLowerCase());
    } catch (err) {
      notifications.show({
        message: err?.response?.data?.message,
        color: "red",
      });
    }
    setIsLoading(false);
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <TextInput
        type="text"
        placeholder="e.g my-team"
        label="Hostname"
        variant="filled"
        rightSection={<Text fw={500}>.{getSubdomainHost()}</Text>}
        rightSectionWidth={150}
        withErrorStyles={false}
        width={200}
        {...form.getInputProps("hostname")}
      />

      <Group justify="flex-end" mt="md">
        <Button type="submit" disabled={isLoading} loading={isLoading}>
          {t("Change hostname")}
        </Button>
      </Group>
    </form>
  );
}
