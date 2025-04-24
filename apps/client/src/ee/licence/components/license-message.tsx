import { useTranslation } from "react-i18next";

export default function LicenseMessage() {
  const { t } = useTranslation();
  return <>{t("To unlock enterprise features, please contact sales@docmost.com to purchase a license.")}</>;
}
