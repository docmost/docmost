import { useTranslation } from "react-i18next";
import { IconPlus } from "@tabler/icons-react";
import classes from "@/ee/base/styles/kanban.module.css";

type KanbanAddCardButtonProps = {
  onAddCard: () => void;
};

export function KanbanAddCardButton({ onAddCard }: KanbanAddCardButtonProps) {
  const { t } = useTranslation();
  return (
    <div
      className={classes.addCard}
      role="button"
      tabIndex={0}
      onClick={onAddCard}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAddCard();
        }
      }}
    >
      <IconPlus size={16} />
      {t("New row")}
    </div>
  );
}
