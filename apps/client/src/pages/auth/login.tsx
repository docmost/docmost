import { LoginForm } from "@/features/auth/components/login-form";
import { Helmet } from "react-helmet-async";
import {getAppName} from "@/lib/config.ts";

export default function LoginPage() {
  return (
    <>
      <Helmet>
        <title>Login - {getAppName()}</title>
      </Helmet>
      <LoginForm />
    </>
  );
}
