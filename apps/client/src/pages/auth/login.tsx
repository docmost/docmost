import { LoginForm } from "@/features/auth/components/login-form";
import { Helmet } from "react-helmet-async";

export default function LoginPage() {
  return (
    <>
      <Helmet>
        <title>Login</title>
      </Helmet>
      <LoginForm />
    </>
  );
}
