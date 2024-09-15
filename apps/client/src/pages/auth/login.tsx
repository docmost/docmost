import { LoginForm } from "@/features/auth/components/login-form";
import useAuth from "@/features/auth/hooks/use-auth";
import { useEffect } from "react";
import { Helmet } from "react-helmet-async";


const ntlmAuth = import.meta.env.VITE_NTLM_AUTH;

export default function LoginPage() {
  
  const { ntlmSignIn } = useAuth();

  useEffect(() => {

    if (ntlmAuth)
      ntlmSignIn();

  }, [])

  return (
    <>
      <Helmet>
        <title>Login</title>
      </Helmet>
      {!ntlmAuth && <LoginForm />}
    </>
  );
}
