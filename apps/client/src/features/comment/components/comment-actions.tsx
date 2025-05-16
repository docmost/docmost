import { Button, Group, Tooltip } from "@mantine/core";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

  return (
    <Group justify="flex-end" pt="sm" wrap="nowrap">
      {isCommentEditor && (
        <Button size="compact-sm" variant="default" onClick={onCancel}>
          {t("Cancel")}
        </Button>
      )}

      <Button size="compact-sm" loading={isLoading} onClick={onSave}>
        {t("Save")}
      </Button>
    </Group>
  );
}

export default CommentActions;
