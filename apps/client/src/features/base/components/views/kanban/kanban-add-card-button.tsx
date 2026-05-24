import { Button } from "@mantine/core";
import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "@/features/base/styles/kanban.module.css";

type KanbanAddCardButtonProps = {
  onClick: () => void;
  disabled?: boolean;
};

export function KanbanAddCardButton({
  onClick,
  disabled,
}: KanbanAddCardButtonProps) {
  const { t } = useTranslation();
  return (
    <Button
      variant="subtle"
      color="gray"
      size="xs"
      className={classes.addCardButton}
      leftSection={<IconPlus size={14} />}
      onClick={onClick}
      disabled={disabled}
    >
      {t("New")}
    </Button>
  );
}
