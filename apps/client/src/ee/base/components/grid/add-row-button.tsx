import { memo } from "react";
import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "@/ee/base/styles/grid.module.css";

type AddRowButtonProps = {
  onClick?: () => void;
};

export const AddRowButton = memo(function AddRowButton({
  onClick,
}: AddRowButtonProps) {
  const { t } = useTranslation();

  return (
    <div
      className={classes.addRowButton}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <IconPlus size={14} />
      <span>{t("New row")}</span>
    </div>
  );
});
