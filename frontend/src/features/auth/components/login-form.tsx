'use client';

import * as React from 'react';
import * as z from 'zod';

import { useForm, zodResolver } from '@mantine/form';
import useAuth from '@/features/auth/hooks/use-auth';
import { ILogin } from '@/features/auth/types/auth.types';
import {
  Container,
  Title,
  Anchor,
  Paper,
  TextInput,
  Button,
  Text,
  PasswordInput,
} from '@mantine/core';
import Link from 'next/link';

const formSchema = z.object({
  email: z
    .string({ required_error: 'email is required' })
    .email({ message: 'Invalid email address' }),
  password: z.string({ required_error: 'password is required' }),
});

export function LoginForm() {
  const { signIn, isLoading } = useAuth();

  const form = useForm<ILogin>({
    validate: zodResolver(formSchema),
    initialValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: ILogin) {
    await signIn(data);
  }

  return (
    <Container size={420} my={40}>
      <Title ta="center" fw={800}>
        Login
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Do not have an account yet?{' '}
        <Anchor size="sm" component={Link} href="/signup">
          Create account
        </Anchor>
      </Text>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={form.onSubmit(onSubmit)}>
          <TextInput
            id="email"
            type="email"
            label="Email"
            placeholder="email@example.com"
            required
            {...form.getInputProps('email')}
          />

          <PasswordInput
            label="Password"
            placeholder="Your password"
            required
            mt="md"
            {...form.getInputProps('password')}
          />
          <Button type="submit" fullWidth mt="xl" loading={isLoading}>
            Sign In
          </Button>
        </form>
      </Paper>
    </Container>
  );
}
