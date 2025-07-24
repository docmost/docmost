import {
  Modal,
  TextInput,
  Button,
  Text,
  Group,
  PasswordInput,
} from "@mantine/core";
import * as z from "zod";
import { useState } from "react";
import { useAtom } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { useDisclosure } from "@mantine/hooks";
import * as React from "react";
import { useForm, zodResolver } from "@mantine/form";
import { useTranslation } from "react-i18next";
import { updateUser } from "../services/user-service";
import { notifications } from "@mantine/notifications";

export default function ChangeEmail() {
  const { t } = useTranslation();
  const [currentUser] = useAtom(currentUserAtom);
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div style={{ minWidth: 0, flex: 1 }}>
        <Text size="md">{t("Email")}</Text>
        <Text size="sm" c="dimmed">
          {currentUser?.user.email}
        </Text>
      </div>

      <Button onClick={open} variant="default">
        {t("Change email")}
      </Button>

      <Modal
        opened={opened}
        onClose={close}
        title={t("Change email")}
        centered
      >
        <Text mb="md">
          {t(
            "To change your email, you have to enter your password and new email.",
          )}
        </Text>
        <ChangeEmailForm onClose={close} />
      </Modal>
    </Group>
  );
}

const formSchema = z.object({
  email: z
    .string({ required_error: "New email is required" })
    .email({ message: "Please enter a valid email address" }),
  password: z
    .string({ required_error: "Your current password is required" })
    .min(8, { message: "Password must be at least 8 characters long" }),
});

type FormValues = z.infer<typeof formSchema>;

function ChangeEmailForm({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [, setCurrentUser] = useAtom(currentUserAtom);

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      password: "",
      email: "",
    },
  });

  async function handleSubmit(data: FormValues) {
    setIsLoading(true);
    try {
      const updatedUser = await updateUser({
        email: data.email,
        confirmPassword: data.password,
      });

      setCurrentUser((prev) => (prev ? { ...prev, user: updatedUser } : prev));

      notifications.show({
        message: t("Email updated successfully"),
      });

      onClose();
    } catch (err: any) {
      let errorMessage = t("Failed to update email");

      if (err?.response) {
        if (err.response.status === 401) {
          errorMessage = t("Incorrect password. Please try again.");
        } else if (err.response.data?.message) {
          errorMessage = err.response.data.message;
        }
      }

      notifications.show({
        message: errorMessage,
        color: "red",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <PasswordInput
        label={t("Password")}
        placeholder={t("Enter your password")}
        variant="filled"
        mb="md"
        {...form.getInputProps("password")}
      />

      <TextInput
        id="email"
        label={t("Email")}
        description={t("Enter your new preferred email")}
        placeholder={t("New email")}
        variant="filled"
        mb="md"
        {...form.getInputProps("email")}
      />

      <Group justify="flex-end" mt="md">
        <Button type="submit" disabled={isLoading} loading={isLoading}>
          {t("Change email")}
        </Button>
      </Group>
    </form>
  );
}