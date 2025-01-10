import { useWorkspacePublicDataQuery } from "@/features/workspace/queries/workspace-query.ts";
import { SetupWorkspaceForm } from "@/features/auth/components/setup-workspace-form.tsx";
import { Helmet } from "react-helmet-async";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getAppName } from "@/lib/config.ts";
import useAuth from "@/features/auth/hooks/use-auth.ts";
import APP_ROUTE from "@/lib/app-route.ts";

export default function SetupWorkspace() {
  const {
    data: workspace,
    isLoading,
    isError,
    error,
  } = useWorkspacePublicDataQuery();
  const { isAuthenticated } = useAuth();

  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isError && workspace) {
      if (isAuthenticated) {
        navigate(APP_ROUTE.HOME);
      } else {
        navigate(APP_ROUTE.AUTH.LOGIN);
      }
    }
  }, [isLoading, isError, workspace]);

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
          <title>Setup Workspace - {getAppName()}</title>
        </Helmet>
        <SetupWorkspaceForm />
      </>
    );
  }

  return null;
}
