import { InviteSignUpForm } from "@/features/auth/components/invite-sign-up-form.tsx";
import { useTranslation } from "react-i18next";
import { DocumentTitle } from "@/components/ui/document-title.tsx";

export default function InviteSignup() {
  const { t } = useTranslation();

  return (
    <>
      <DocumentTitle title={t("Invitation Signup")} />
      <InviteSignUpForm />
    </>
  );
}
