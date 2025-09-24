import { WorkspaceInviteForm } from "@/features/workspace/components/members/components/workspace-invite-form.tsx";
import { Button, Divider, Modal, ScrollArea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { useTranslation } from "react-i18next";

export default function WorkspaceInviteModal() {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Button onClick={open}>{t("Invite members")}</Button>

      <Modal
        size="550"
        opened={opened}
        onClose={close}
        title={t("Invite new members")}
        centered
      >
        <Divider size="xs" mb="xs" />

        <ScrollArea h="80%">
          <WorkspaceInviteForm onClose={close} />
        </ScrollArea>
      </Modal>
    </>
  );
}
