import { useWorkspacePublicDataQuery } from "@/features/workspace/queries/workspace-query.ts";
import { SetupWorkspaceForm } from "@/features/auth/components/setup-workspace-form.tsx";
import { Helmet } from "react-helmet-async";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";
import { getAppName } from "@/lib/config.ts";
import { useTranslation } from "react-i18next";

export default function SetupWorkspace() {
  const { t } = useTranslation();
  const {
    data: workspace,
    isLoading,
    isError,
    error,
  } = useWorkspacePublicDataQuery();

  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && workspace) {
      navigate(APP_ROUTE.AUTH.LOGIN);
    }
  }, [isLoading, workspace]);

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
          <title>
            {t("Setup Workspace")} - {getAppName()}
          </title>
        </Helmet>
        <SetupWorkspaceForm />
      </>
    );
  }

  return null;
}
