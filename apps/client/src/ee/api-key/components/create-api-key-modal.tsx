import { lazy, Suspense, useState } from "react";
import { Modal, TextInput, Button, Group, Stack, Select } from "@mantine/core";
import { useForm } from "@mantine/form";
import { zodResolver } from "mantine-form-zod-resolver";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useCreateApiKeyMutation } from "@/ee/api-key/queries/api-key-query";
import { IconCalendar } from "@tabler/icons-react";
import { IApiKey } from "@/ee/api-key";

const DateInput = lazy(() =>
  import("@mantine/dates").then((module) => ({
    default: module.DateInput,
  })),
);

interface CreateApiKeyModalProps {
  opened: boolean;
  onClose: () => void;
  onSuccess: (response: IApiKey) => void;
}

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  expiresAt: z.string().optional(),
});
type FormValues = z.infer<typeof formSchema>;

export function CreateApiKeyModal({
  opened,
  onClose,
  onSuccess,
}: CreateApiKeyModalProps) {
  const { t } = useTranslation();
  const [expirationOption, setExpirationOption] = useState<string>("30");
  const createApiKeyMutation = useCreateApiKeyMutation();

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      name: "",
      expiresAt: "",
    },
  });

  const getExpirationDate = (): string | undefined => {
    if (expirationOption === "never") {
      return undefined;
    }
    if (expirationOption === "custom") {
      return form.values.expiresAt;
    }
    const days = parseInt(expirationOption);
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString();
  };

  const getExpirationLabel = (days: number) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const formatted = date.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });
    return `${days} days (${formatted})`;
  };

  const expirationOptions = [
    { value: "30", label: getExpirationLabel(30) },
    { value: "60", label: getExpirationLabel(60) },
    { value: "90", label: getExpirationLabel(90) },
    { value: "365", label: getExpirationLabel(365) },
    { value: "custom", label: t("Custom") },
    { value: "never", label: t("No expiration") },
  ];

  const handleSubmit = async (data: {
    name?: string;
    expiresAt?: string | Date;
  }) => {
    const groupData = {
      name: data.name,
      expiresAt: getExpirationDate(),
    };

    try {
      const createdKey = await createApiKeyMutation.mutateAsync(groupData);
      onSuccess(createdKey);
      form.reset();
      onClose();
    } catch (err) {
      //
    }
  };

  const handleClose = () => {
    form.reset();
    setExpirationOption("30");
    onClose();
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={t("Create API Key")}
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

          <Select
            label={t("Expiration")}
            data={expirationOptions}
            value={expirationOption}
            onChange={(value) => setExpirationOption(value || "30")}
            leftSection={<IconCalendar size={16} />}
            allowDeselect={false}
          />

          {expirationOption === "custom" && (
            <Suspense fallback={null}>
              <DateInput
                label={t("Custom expiration date")}
                placeholder={t("Select expiration date")}
                minDate={new Date()}
                {...form.getInputProps("expiresAt")}
              />
            </Suspense>
          )}

          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={handleClose}>
              {t("Cancel")}
            </Button>
            <Button type="submit" loading={createApiKeyMutation.isPending}>
              {t("Create")}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
