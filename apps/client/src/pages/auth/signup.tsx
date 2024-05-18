import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { useWorkspacePublicDataQuery } from "@/features/workspace/queries/workspace-query.ts";
import { SetupWorkspaceForm } from "@/features/auth/components/setup-workspace-form.tsx";
import { Helmet } from "react-helmet-async";
import React from "react";

export default function SignUpPage() {
  const {
    data: workspace,
    isLoading,
    isError,
    error,
  } = useWorkspacePublicDataQuery();

  if (isLoading) {
    return <div></div>;
  }

  if (
    isError &&
    error?.["response"]?.status === 404 &&
    error?.["response"]?.data.message.includes("Workspace not found")
  ) {
    return (
      <>
        <Helmet>
          <title>Setup workspace</title>
        </Helmet>
        <SetupWorkspaceForm />
      </>
    );
  }

  return workspace ? (
    <>
      <Helmet>
        <title>Signup</title>
      </Helmet>
      <SignUpForm />
    </>
  ) : null;
}
