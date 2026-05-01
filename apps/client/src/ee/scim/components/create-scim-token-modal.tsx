import { Modal, TextInput, Button, Group, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import { z } from "zod/v4";
import { useTranslation } from "react-i18next";
import { useCreateScimTokenMutation } from "@/ee/scim/queries/scim-token-query";
import { IScimToken } from "@/ee/scim/types/scim-token.types";

interface CreateScimTokenModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: (response: IScimToken) => void;
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
});
type FormValues = z.infer<typeof formSchema>;

export function CreateScimTokenModal({
  opened,
  onClose,
  onSuccess,
}: CreateScimTokenModalProps) {
  const { t } = useTranslation();
  const createMutation = useCreateScimTokenMutation();

  const form = useForm<FormValues>({
    validate: zod4Resolver(formSchema),
    initialValues: { name: "" },
  });

  const handleSubmit = async (data: FormValues) => {
    try {
      const created = await createMutation.mutateAsync({ name: data.name });
      onSuccess(created);
      form.reset();
      onClose();
    } catch (err) {
      //
    }
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Create SCIM token")}
      size="md"
    >
      <form onSubmit={form.onSubmit((values) => handleSubmit(values))}>
        <Stack gap="md">
          <TextInput
            label={t("Name")}
            placeholder={t("Enter a descriptive name")}
            data-autofocus
            required
            {...form.getInputProps("name")}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={handleClose}>
              {t("Cancel")}
            </Button>
            <Button type="submit" loading={createMutation.isPending}>
              {t("Create")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
