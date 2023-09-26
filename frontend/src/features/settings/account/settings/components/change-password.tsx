'use client';

import { Button, Group, Text, Modal, PasswordInput } from '@mantine/core';
import * as z from 'zod';
import { useState } from 'react';
import { useDisclosure } from '@mantine/hooks';
import * as React from 'react';
import { useForm, zodResolver } from '@mantine/form';


export default function ChangePassword() {
  const [opened, { open, close }] = useDisclosure(false);

  return (
    <Group justify="space-between" wrap="nowrap" gap="xl">
      <div>
        <Text size="md">Password</Text>
        <Text size="sm" c="dimmed">
          You can change your password here.
        </Text>
      </div>

      <Button onClick={open} variant="default">Change password</Button>

      <Modal opened={opened} onClose={close} title="Change password" centered>
        <Text mb="md">Your password must be a minimum of 8 characters.</Text>
        <ChangePasswordForm />

      </Modal>
    </Group>
  );
}

const formSchema = z.object({
  current: z.string({ required_error: 'your current password is required' }).min(1),
  password: z.string({ required_error: 'New password is required' }).min(8),
  confirm_password: z.string({ required_error: 'Password confirmation is required' }).min(8),
}).refine(data => data.password === data.confirm_password, {
  message: 'Your new password and confirmation does not match.',
  path: ['confirm_password'],
});

type FormValues = z.infer<typeof formSchema>

function ChangePasswordForm() {
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      current: '',
      password: '',
      confirm_password: '',
    },
  });

  function handleSubmit(data: FormValues) {
    setIsLoading(true);
    console.log(data);
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>

      <PasswordInput
        label="Current password"
        name="current"
        placeholder="Enter your password"
        variant="filled"
        mb="md"
        {...form.getInputProps('password')}
      />

      <PasswordInput
        label="New password"
        placeholder="Enter your password"
        variant="filled"
        mb="md"
        {...form.getInputProps('password')}
      />

      <Button type="submit" disabled={isLoading} loading={isLoading}>
        Change password
      </Button>
    </form>
  );
}
