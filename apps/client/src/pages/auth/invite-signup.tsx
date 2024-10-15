import { Helmet } from "react-helmet-async";
import { InviteSignUpForm } from "@/features/auth/components/invite-sign-up-form.tsx";
import {getAppName} from "@/lib/config.ts";
import { useTranslation } from "react-i18next";

export default function InviteSignup() {
  const { t } = useTranslation();

  return (
    <>
      <Helmet>
        <title>{t("Invitation Signup")} - {getAppName()}</title>
      </Helmet>
      <InviteSignUpForm />
    </>
  );
}
