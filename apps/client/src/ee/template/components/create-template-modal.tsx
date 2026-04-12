import { useState } from "react";
import {
  Modal,
  TextInput,
  Select,
  Button,
  Stack,
  Group,
} from "@mantine/core";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useCreateTemplateMutation } from "../queries/template-query";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import useUserRole from "@/hooks/use-user-role";

type CreateTemplateModalProps = {
  opened: boolean;
  onClose: () => void;
};

export default function CreateTemplateModal({
  opened,
  onClose,
}: CreateTemplateModalProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin: isWorkspaceAdmin } = useUserRole();
  const createMutation = useCreateTemplateMutation();
  const { data: spaces } = useGetSpacesQuery({ limit: 100 });

  const [title, setTitle] = useState("");
  const [spaceId, setSpaceId] = useState<string | null>(null);

  const scopeOptions = [
    ...(isWorkspaceAdmin
      ? [
          { group: t("Workspace"), items: [{ value: "", label: t("Global") }] },
        ]
      : []),
    ...(spaces?.items?.length
      ? [
          {
            group: t("Spaces"),
            items: spaces.items.map((s) => ({ value: s.id, label: s.name })),
          },
        ]
      : []),
  ];

  const handleCreate = async () => {
    if (!title.trim()) return;

    try {
      const result = await createMutation.mutateAsync({
        title: title.trim(),
        spaceId: spaceId || undefined,
      });

      handleClose();
      navigate(`/templates/${result.id}`);
    } catch {
      // error notification handled by mutation's onError
    }
  };

  const handleClose = () => {
    setTitle("");
    setSpaceId(null);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("New template")}
      centered
    >
      <Stack gap="md">
        <TextInput
          label={t("Title")}
          placeholder={t("Untitled")}
          value={title}
          onChange={(e) => setTitle(e.currentTarget.value)}
          data-autofocus
          onKeyDown={(e) => {
            if (e.key === "Enter" && title.trim() && !createMutation.isPending) {
              handleCreate();
            }
          }}
        />

        <Select
          label={t("Scope")}
          description={t("Choose which space this template belongs to")}
          data={scopeOptions}
          value={spaceId || ""}
          onChange={(val) => setSpaceId(val || null)}
          searchable
          placeholder={t("Select scope")}
        />

        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={handleClose}>
            {t("Cancel")}
          </Button>
          <Button
            onClick={handleCreate}
            loading={createMutation.isPending}
            disabled={!title.trim()}
          >
            {t("Create")}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
