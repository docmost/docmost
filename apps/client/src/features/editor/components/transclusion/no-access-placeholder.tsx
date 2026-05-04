import { IconEyeOff } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "./transclusion.module.css";

export default function NoAccessPlaceholder() {
  const { t } = useTranslation();
  return (
    <div className={classes.placeholder}>
      <IconEyeOff size={20} stroke={1.5} className={classes.placeholderIcon} />
      <div className={classes.placeholderTitle}>{t("No access")}</div>
      <div className={classes.placeholderSubtext}>
        {t("You don't have access to this content")}
      </div>
    </div>
  );
}
