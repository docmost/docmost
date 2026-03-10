import { Helmet } from "react-helmet-async";
import { RegisterForm } from "@/features/auth/components/register-form.tsx";
import { getAppName } from "@/lib/config.ts";
import { useTranslation } from "react-i18next";

export default function RegisterPage() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>
          {t("Create account")} - {getAppName()}
        </title>
      </Helmet>
      <RegisterForm />
    </>
  );
}
