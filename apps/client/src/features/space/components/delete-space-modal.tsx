import { Button, Divider, Group, Modal, Text, TextInput } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { useDeleteSpaceMutation } from '../queries/space-query';
import { useField } from '@mantine/form';
import { ISpace } from '../types/space.types';
import { useNavigate } from 'react-router-dom';
import APP_ROUTE from '@/lib/app-route';

interface DeleteSpaceModalProps {
  space: ISpace;
}

export default function DeleteSpaceModal({ space }: DeleteSpaceModalProps) {
  const [opened, { open, close }] = useDisclosure(false);
  const deleteSpaceMutation = useDeleteSpaceMutation();
  const navigate = useNavigate();

  const confirmNameField = useField({
    initialValue: '',
    validateOnChange: true,
    validate: (value) =>
      value.trim().toLowerCase() === space.name.trim().toLocaleLowerCase()
        ? null
        : 'Names do not match',
  });

  const handleDelete = async () => {
    if (
      confirmNameField.getValue().trim().toLowerCase() !==
      space.name.trim().toLowerCase()
    ) {
      confirmNameField.validate();
      return;
    }

    try {
      // pass slug too so we can clear the local cache
      await deleteSpaceMutation.mutateAsync({ id: space.id, slug: space.slug });
      navigate(APP_ROUTE.HOME);
    } catch (error) {
      console.error('Failed to delete space', error);
    }
  };

  return (
    <>
      <Button onClick={open} variant="light" color="red">
        Delete
      </Button>

      <Modal
        opened={opened}
        onClose={close}
        title="Are you sure you want to delete this space?"
      >
        <Divider size="xs" mb="xs" />
        <Text>
          All pages, comments, attachments and permissions in this space will be
          deleted irreversibly.
        </Text>
        <Text mt="sm">
          Type the space name{' '}
          <Text span fw={500}>
            '{space.name}'
          </Text>{' '}
          to confirm your action.
        </Text>
        <TextInput
          {...confirmNameField.getInputProps()}
          variant="filled"
          placeholder="Confirm space name"
          py="sm"
          data-autofocus
        />
        <Group justify="flex-end" mt="md">
          <Button onClick={close} variant="default">
            Cancel
          </Button>
          <Button onClick={handleDelete} color="red">
            Confirm
          </Button>
        </Group>
      </Modal>
    </>
  );
}
