import { IconAlertTriangle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "./transclusion.module.css";

export default function ErrorPlaceholder() {
  const { t } = useTranslation();
  return (
    <div className={classes.placeholder}>
      <IconAlertTriangle
        size={18}
        stroke={1.6}
        className={classes.placeholderIcon}
      />
      <span>{t("Failed to load this synced block")}</span>
    </div>
  );
}
