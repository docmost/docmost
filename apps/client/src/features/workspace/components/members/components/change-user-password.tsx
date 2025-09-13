import { Button, Group, Text, Modal, PasswordInput } from "@mantine/core";
import * as z from "zod";
import { useState } from "react";
import { useDisclosure } from "@mantine/hooks";
import * as React from "react";
import { useForm, zodResolver } from "@mantine/form";
import { changeWorkspaceMemberPassword } from "@/features/workspace/services/workspace-service.ts";
import { notifications } from "@mantine/notifications";
import { useTranslation } from "react-i18next";

const formSchema = z.object({
  actorPassword: z
    .string({ required_error: "Your password is required" })
    .min(8),
  newPassword: z.string({ required_error: "New password is required" }).min(8),
});

type FormValues = z.infer<typeof formSchema>;

interface ChangeUserPasswordFormProps {
  userId: string;
  userName: string;
  onClose?: () => void;
}
export default function ChangeUserPasswordForm({ userId, userName, onClose }: ChangeUserPasswordFormProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      actorPassword: "",
      newPassword: "",
    },
  });

  async function handleSubmit(data: FormValues) {
    setIsLoading(true);
    try {
      await changeWorkspaceMemberPassword({
        userId: userId,
        actorPassword: data.actorPassword,
        newPassword: data.newPassword,
      });
      notifications.show({
        message: t("Password changed successfully for {{userName}}", { userName }),
      });

      onClose?.();
    } catch (err) {
      notifications.show({
        message: `Error: ${err.response.data.message}`,
        color: "red",
      });
    }
    setIsLoading(false);
  }
  return (
    <>
      <Text size="sm" mb="md">
        {t("You are changing the password for {{userName}}. Enter your current password to confirm this action.", { userName })}
      </Text>
      
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <PasswordInput
          label={t("Your current password")}
          name="actorPassword"
          placeholder={t("Enter your current password")}
          variant="filled"
          mb="md"
          data-autofocus
          {...form.getInputProps("actorPassword")}
        />

        <PasswordInput
          label={t("New password for {{userName}}", { userName })}
          placeholder={t("Enter the new password")}
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
    </>
  );
}
