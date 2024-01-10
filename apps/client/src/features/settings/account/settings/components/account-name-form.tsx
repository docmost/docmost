import { useAtom } from 'jotai';
import { focusAtom } from 'jotai-optics';
import * as z from 'zod';
import { useForm, zodResolver } from '@mantine/form';
import { currentUserAtom } from '@/features/user/atoms/current-user-atom';
import { updateUser } from '@/features/user/services/user-service';
import { IUser } from '@/features/user/types/user.types';
import { useState } from 'react';
import { TextInput, Button } from '@mantine/core';
import { notifications } from '@mantine/notifications';

const formSchema = z.object({
  name: z.string().min(2).max(40).nonempty('Your name cannot be blank'),
});

type FormValues = z.infer<typeof formSchema>;

const userAtom = focusAtom(currentUserAtom, (optic) => optic.prop('user'));

export default function AccountNameForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser] = useAtom(currentUserAtom);
  const [, setUser] = useAtom(userAtom);

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      name: currentUser?.user?.name,
    },
  });

  async function handleSubmit(data: Partial<IUser>) {
    setIsLoading(true);

    try {
      const updatedUser = await updateUser(data);
      setUser(updatedUser);
      notifications.show({
        message: 'Updated successfully',
      });
    } catch (err) {
      console.log(err);
      notifications.show({
        message: 'Failed to update data',
        color: 'red',
      });
    }

    setIsLoading(false);
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <TextInput
        id="name"
        label="Name"
        placeholder="Your name"
        variant="filled"
        {...form.getInputProps('name')}
        rightSection={
          <Button type="submit" disabled={isLoading} loading={isLoading}>
            Save
          </Button>
        }
      />
    </form>
  );
}

