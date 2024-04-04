import * as React from 'react';
import * as z from 'zod';

import { useForm, zodResolver } from '@mantine/form';
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
import { Link } from 'react-router-dom';
import { IRegister } from '@/features/auth/types/auth.types';
import useAuth from '@/features/auth/hooks/use-auth';

const formSchema = z.object({
  email: z
    .string({ required_error: 'email is required' })
    .email({ message: 'Invalid email address' }),
  password: z.string({ required_error: 'password is required' }),
});

export function SignUpForm() {
  const { signUp, isLoading } = useAuth();

  const form = useForm<IRegister>({
    validate: zodResolver(formSchema),
    initialValues: {
      email: '',
      password: '',
    },
  });

  async function onSubmit(data: IRegister) {
    await signUp(data);
  }

  return (
    <Container size={420} my={40}>
      <Title ta="center" fw={800}>
        Create an account
      </Title>
      <Text c="dimmed" size="sm" ta="center" mt={5}>
        Already have an account?{' '}
        <Anchor size="sm" component={Link} to="/login">
          Login
        </Anchor>
      </Text>

      <Paper shadow="md" p={30} mt={30} radius="md">
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
            Sign Up
          </Button>
        </form>
      </Paper>
    </Container>
  );
}
