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

export default function ChangeEmail() {
  const [currentUser] = useAtom(currentUserAtom);
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">Email</Text>
        <Text size="sm" c="dimmed">
          {currentUser?.user.email}
        </Text>
      </div>

      <Button onClick={open} variant="default">
        Change email
      </Button>

      <Modal opened={opened} onClose={close} title="Change email" centered>
        <Text mb="md">
          To change your email, you have to enter your password and new email.
        </Text>
        <ChangePasswordForm />
      </Modal>
    </Group>
  );
}

const formSchema = z.object({
  email: z.string({ required_error: "New email is required" }).email(),
  password: z
    .string({ required_error: "your current password is required" })
    .min(8),
});

type FormValues = z.infer<typeof formSchema>;

function ChangePasswordForm() {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      password: "",
      email: "",
    },
  });

  function handleSubmit(data: FormValues) {
    setIsLoading(true);
    console.log(data);
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <PasswordInput
        label="Password"
        placeholder="Enter your password"
        variant="filled"
        mb="md"
        {...form.getInputProps("password")}
      />

      <TextInput
        id="email"
        label="Email"
        description="Enter your new preferred email"
        placeholder="New email"
        variant="filled"
        mb="md"
        {...form.getInputProps("email")}
      />

      <Button type="submit" disabled={isLoading} loading={isLoading}>
        Change email
      </Button>
    </form>
  );
}
