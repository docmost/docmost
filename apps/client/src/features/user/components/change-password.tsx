import { Button, Group, Text, Modal, PasswordInput } from "@mantine/core";
import * as z from "zod";
import { useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import * as React from "react";
import { useForm, zodResolver } from "@mantine/form";
import { changePassword } from "@/features/auth/services/auth-service.ts";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

export default function ChangePassword() {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div style={{ minWidth: 0, flex: 1 }}>
        <Text size="md">{t("Password")}</Text>
        <Text size="sm" c="dimmed">
          {t("You can change your password here.")}
        </Text>
      </div>

      <Button onClick={open} variant="default" style={{ whiteSpace: "nowrap" }}>
        {t("Change password")}
      </Button>

      <Modal
        opened={opened}
        onClose={close}
        title={t("Change password")}
        centered
      >
        <Text mb="md">
          {t("Your password must be a minimum of 8 characters.")}
        </Text>
        <ChangePasswordForm onClose={close} />
      </Modal>
    </Group>
  );
}

const formSchema = z.object({
  oldPassword: z
    .string({ required_error: "your current password is required" })
    .min(8),
  newPassword: z.string({ required_error: "New password is required" }).min(8),
});

type FormValues = z.infer<typeof formSchema>;

interface ChangePasswordFormProps {
  onClose?: () => void;
}
function ChangePasswordForm({ onClose }: ChangePasswordFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      oldPassword: "",
      newPassword: "",
    },
  });

  async function handleSubmit(data: FormValues) {
    setIsLoading(true);
    try {
      await changePassword({
        oldPassword: data.oldPassword,
        newPassword: data.newPassword,
      });
      notifications.show({
        message: t("Password changed successfully"),
      });

      onClose();
    } catch (err) {
      notifications.show({
        message: `Error: ${err.response.data.message}`,
        color: "red",
      });
    }
    setIsLoading(false);
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <PasswordInput
        label={t("Current password")}
        name="oldPassword"
        placeholder={t("Enter your current password")}
        variant="filled"
        mb="md"
        data-autofocus
        {...form.getInputProps("oldPassword")}
      />

      <PasswordInput
        label={t("New password")}
        placeholder={t("Enter your new password")}
        variant="filled"
        mb="md"
        {...form.getInputProps("newPassword")}
      />

      <Group justify="flex-end" mt="md">
        <Button type="submit" disabled={isLoading} loading={isLoading}>
          {t("Change password")}
        </Button>
      </Group>
    </form>
  );
}
