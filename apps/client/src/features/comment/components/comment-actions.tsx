import { Button, Group } from '@mantine/core';

type CommentActionsProps = {
  onSave: () => void;
  isLoading?: boolean;
};

function CommentActions({ onSave, isLoading }: CommentActionsProps) {
  return (
    <Group justify="flex-end" pt={2} wrap="nowrap">
      <Button size="compact-sm" loading={isLoading} onClick={onSave}>Save</Button>
    </Group>
  );
}

export default CommentActions;
