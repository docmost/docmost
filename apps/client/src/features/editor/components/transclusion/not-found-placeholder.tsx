import { IconInfoCircle } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import classes from "./transclusion.module.css";

export default function NotFoundPlaceholder() {
  const { t } = useTranslation();
  return (
    <div className={classes.placeholder}>
      <IconInfoCircle
        size={18}
        stroke={1.6}
        className={classes.placeholderIcon}
      />
      <span>{t("The original synced block no longer exists")}</span>
    </div>
  );
}
