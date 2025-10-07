import { Modal, TextInput, Button, Group, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useUpdateApiKeyMutation } from "@/ee/api-key/queries/api-key-query";
import { IApiKey } from "@/ee/api-key";
import { useEffect } from "react";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
});
type FormValues = z.infer<typeof formSchema>;

interface UpdateApiKeyModalProps {
  opened: boolean;
  onClose: () => void;
  apiKey: IApiKey | null;
}

export function UpdateApiKeyModal({
  opened,
  onClose,
  apiKey,
}: UpdateApiKeyModalProps) {
  const { t } = useTranslation();
  const updateApiKeyMutation = useUpdateApiKeyMutation();

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      name: "",
    },
  });

  useEffect(() => {
    if (opened && apiKey) {
      form.setValues({ name: apiKey.name });
    }
  }, [opened, apiKey]);

  const handleSubmit = async (data: { name?: string }) => {
    const apiKeyData = {
      apiKeyId: apiKey.id,
      name: data.name,
    };

    await updateApiKeyMutation.mutateAsync(apiKeyData);
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={t("Update API key")}
      size="md"
    >
      <form onSubmit={form.onSubmit((values) => handleSubmit(values))}>
        <Stack gap="md">
          <TextInput
            label={t("Name")}
            placeholder={t("Enter a descriptive token name")}
            required
            {...form.getInputProps("name")}
          />

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>
              {t("Cancel")}
            </Button>
            <Button type="submit" loading={updateApiKeyMutation.isPending}>
              {t("Update")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
