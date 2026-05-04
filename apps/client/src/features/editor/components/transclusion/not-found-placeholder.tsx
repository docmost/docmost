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
        {t("Synced block unavailable")}
      </div>
      <div className={classes.placeholderSubtext}>
        {t(
          "The source may have been removed, or embedding it here would create a loop.",
        )}
      </div>
    </div>
  );
}
