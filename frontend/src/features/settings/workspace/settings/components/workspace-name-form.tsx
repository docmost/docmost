'use client';

import { currentUserAtom } from '@/features/user/atoms/current-user-atom';
import { useAtom } from 'jotai';
import * as z from 'zod';
import toast from 'react-hot-toast';
import { useState } from 'react';
import { focusAtom } from 'jotai-optics';
import { updateWorkspace } from '@/features/workspace/services/workspace-service';
import { IWorkspace } from '@/features/workspace/types/workspace.types';
import { TextInput, Button } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';

const formSchema = z.object({
  name: z.string().nonempty('Workspace name cannot be blank'),
});

type FormValues = z.infer<typeof formSchema>;

const workspaceAtom = focusAtom(currentUserAtom, (optic) => optic.prop('workspace'));

export default function WorkspaceNameForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser] = useAtom(currentUserAtom);
  const [, setWorkspace] = useAtom(workspaceAtom);

  const form = useForm<FormValues>({
    validate: zodResolver(formSchema),
    initialValues: {
      name: currentUser?.workspace?.name,
    },
  });

  async function handleSubmit(data: Partial<IWorkspace>) {
    setIsLoading(true);

    try {
      const updatedWorkspace = await updateWorkspace(data);
      setWorkspace(updatedWorkspace);
      toast.success('Updated successfully');
    } catch (err) {
      console.log(err);
      toast.error('Failed to update data.');
    }

    setIsLoading(false);

  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <TextInput
        id="name"
        label="Name"
        placeholder="e.g ACME"
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
