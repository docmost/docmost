import { IconQuestionMark } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "./transclusion.module.css";

export default function NotFoundPlaceholder() {
  const { t } = useTranslation();
  return (
    <div className={classes.placeholder}>
      <IconQuestionMark
        size={20}
        stroke={1.5}
        className={classes.placeholderIcon}
      />
      <div className={classes.placeholderTitle}>
        {t("Synced block not found")}
      </div>
      <div className={classes.placeholderSubtext}>
        {t("The source page or synced block no longer exists")}
      </div>
    </div>
  );
}
