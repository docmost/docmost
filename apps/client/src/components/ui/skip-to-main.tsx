import { useTranslation } from "react-i18next";
import classes from "./skip-to-main.module.css";

export const MAIN_CONTENT_ID = "main-content";

export function SkipToMain() {
  const { t } = useTranslation();
  return (
    <a href={`#${MAIN_CONTENT_ID}`} className={classes.skipLink}>
      {t("Skip to main content")}
    </a>
  );
}
