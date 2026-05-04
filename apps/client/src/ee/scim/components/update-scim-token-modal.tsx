import { Modal, TextInput, Button, Group, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { z } from "zod/v4";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";
import { useUpdateScimTokenMutation } from "@/ee/scim/queries/scim-token-query";
import { IScimToken } from "@/ee/scim/types/scim-token.types";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
});
type FormValues = z.infer<typeof formSchema>;

interface UpdateScimTokenModalProps {
  opened: boolean;
  onClose: () => void;
  scimToken: IScimToken | null;
}

export function UpdateScimTokenModal({
  opened,
  onClose,
  scimToken,
}: UpdateScimTokenModalProps) {
  const { t } = useTranslation();
  const updateMutation = useUpdateScimTokenMutation();

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
    initialValues: { name: "" },
  });

  useEffect(() => {
    if (opened && scimToken) {
      form.setValues({ name: scimToken.name });
    }
  }, [opened, scimToken]);

  const handleSubmit = async (data: FormValues) => {
    if (!scimToken) return;
    await updateMutation.mutateAsync({
      tokenId: scimToken.id,
      name: data.name,
    });
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Update {{credential}}", { credential: t("SCIM token") })}
      size="md"
    >
      <form onSubmit={form.onSubmit((values) => handleSubmit(values))}>
        <Stack gap="md">
          <TextInput
            label={t("Name")}
            placeholder={t("Enter a descriptive name")}
            required
            {...form.getInputProps("name")}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button type="submit" loading={updateMutation.isPending}>
              {t("Update")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
