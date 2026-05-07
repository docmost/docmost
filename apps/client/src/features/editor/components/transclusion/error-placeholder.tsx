import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "./transclusion.module.css";

export default function ErrorPlaceholder() {
  const { t } = useTranslation();
  return (
    <div className={classes.placeholder}>
      <IconAlertTriangle
        size={20}
        stroke={1.5}
        className={classes.placeholderIcon}
      />
      <div className={classes.placeholderTitle}>
        {t("Failed to load transclusion")}
      </div>
      <div className={classes.placeholderSubtext}>
        {t("An error occurred while rendering this reference")}
      </div>
    </div>
  );
}
