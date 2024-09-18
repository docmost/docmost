import { Helmet } from "react-helmet-async";
import { PasswordResetForm } from "@/features/auth/components/password-reset-form";
import { useSearchParams } from "react-router-dom";
import useAuth from "@/features/auth/hooks/use-auth";
import { useVerifyUserTokenQuery } from "@/features/auth/queries/auth-query";
import { Container, Text } from "@mantine/core";

export default function PasswordReset() {
  const [searchParams] = useSearchParams();
  const {
    data: workspace,
    isLoading,
    isError,
    error,
  } = useVerifyUserTokenQuery({
    token: searchParams.get("token"),
    type: "forgot-password",
  });
  const token = searchParams.get("token");

  if (isLoading) {
    return <div></div>;
  }

  if (isError || !token) {
    return (
      <>
        <Helmet>
          <title>Password Reset</title>
        </Helmet>
        <Container size={500} my={40}>
          <Text size="md">Invalid or expired token</Text>
        </Container>
      </>
    );
  }

  return (
    <>
      <Helmet>
        <title>Password Reset</title>
      </Helmet>
      <PasswordResetForm resetToken={token} />
    </>
  );
}

// get token params
// validate that it is valid from the server response.
// if not valid, output error
// if valid render form
