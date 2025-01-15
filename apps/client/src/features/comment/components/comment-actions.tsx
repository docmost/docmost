import { Button, Group } from "@mantine/core";

type CommentActionsProps = {
  onSave: () => void;
  isLoading?: boolean;
  onCancel?: () => void;
  isCommentEditor?: boolean;
};

function CommentActions({
  onSave,
  isLoading,
  onCancel,
  isCommentEditor,
}: CommentActionsProps) {
  return (
    <Group justify="flex-end" pt="sm" wrap="nowrap">
      {isCommentEditor && (
        <Button size="compact-sm" variant="default" onClick={onCancel}>
          Cancel
        </Button>
      )}

      <Button size="compact-sm" loading={isLoading} onClick={onSave}>
        Save
      </Button>
    </Group>
  );
}

export default CommentActions;
