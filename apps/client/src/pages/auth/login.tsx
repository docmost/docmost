import { LoginForm } from "@/features/auth/components/login-form";
import { Helmet } from "react-helmet-async";
import { getAppName, isForwardAuthEnabled } from "@/lib/config.ts";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";

export default function LoginPage() {
  const { t } = useTranslation();

  useEffect(() => {
    if (!isForwardAuthEnabled()) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect") || "/home";
    const loginParams = new URLSearchParams({ redirect });
    window.location.replace(
      `/api/auth/forward-auth/login?${loginParams.toString()}`,
    );
  }, []);

  if (isForwardAuthEnabled()) {
    return null;
  }

  return (
    <>
      <Helmet>
        <title>
          {t("Login")} - {getAppName()}
        </title>
      </Helmet>
      <LoginForm />
    </>
  );
}
