import { Button, Group } from "@mantine/core";
import { useTranslation } from "react-i18next";

type CommentActionsProps = {
  onSave: () => void;
  isLoading?: boolean;
};

function CommentActions({ onSave, isLoading }: CommentActionsProps) {
  const { t } = useTranslation();

  return (
    <Group justify="flex-end" pt={2} wrap="nowrap">
      <Button size="compact-sm" loading={isLoading} onClick={onSave}>
        {t("Save")}
      </Button>
    </Group>
  );
}

export default CommentActions;
