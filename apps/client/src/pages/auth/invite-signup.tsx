import { Helmet } from "react-helmet-async";
import { InviteSignUpForm } from "@/features/auth/components/invite-sign-up-form.tsx";
import {getAppName} from "@/lib/config.ts";

export default function InviteSignup() {
  return (
    <>
        <Helmet>
            <title>Invitation Signuo - {getAppName()}</title>
        </Helmet>
      <InviteSignUpForm />
    </>
  );
}
