import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config.ts";
import { CloudLoginForm } from "@/ee/components/cloud-login-form.tsx";

export default function CloudLogin() {
  return (
    <>
      <Helmet>
        <title>Login - {getAppName()}</title>
      </Helmet>

      <CloudLoginForm />
    </>
  );
}
