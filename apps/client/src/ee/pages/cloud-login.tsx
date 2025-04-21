import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config.ts";
import { CloudLoginForm } from "@/ee/components/cloud-login-form.tsx";
import { useTranslation } from "react-i18next";

export default function CloudLogin() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>
          {t("Login")} - {getAppName()}
        </title>
      </Helmet>

      <CloudLoginForm />
    </>
  );
}
