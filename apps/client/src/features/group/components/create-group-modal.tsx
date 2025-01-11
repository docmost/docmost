import { Button, Divider, Modal } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { CreateGroupForm } from "@/features/group/components/create-group-form.tsx";
import { useTranslation } from "react-i18next";

export default function CreateGroupModal() {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <>
      <Button onClick={open}>{t("Create group")}</Button>

      <Modal opened={opened} onClose={close} title={t("Create group")}>
        <Divider size="xs" mb="xs" />
        <CreateGroupForm />
      </Modal>
    </>
  );
}
