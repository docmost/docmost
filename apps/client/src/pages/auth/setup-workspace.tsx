import { useWorkspacePublicDataQuery } from "@/features/workspace/queries/workspace-query.ts";
import { SetupWorkspaceForm } from "@/features/auth/components/setup-workspace-form.tsx";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";
import { useTranslation } from "react-i18next";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import { useAuthModeQuery } from "@/features/auth/queries/auth-query.tsx";
import { Alert, Button, Container } from "@mantine/core";
import { AuthLayout } from "@/features/auth/components/auth-layout.tsx";

export default function SetupWorkspace() {
  const { t } = useTranslation();
  const {
    data: workspace,
    isLoading,
    isError,
    error,
  } = useWorkspacePublicDataQuery();
  const authModeQuery = useAuthModeQuery();

  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && workspace) {
      navigate(APP_ROUTE.AUTH.LOGIN);
    }
  }, [isLoading, workspace]);

  if (isLoading || authModeQuery.isLoading) {
    return <div></div>;
  }

  if (authModeQuery.isError || !authModeQuery.data) {
    return (
      <AuthLayout>
        <Container size={420}>
          <Alert title={t("Unable to load sign-in settings")} color="red">
            <Button
              variant="subtle"
              onClick={() => void authModeQuery.refetch()}
              mt="sm"
            >
              {t("Retry")}
            </Button>
          </Alert>
        </Container>
      </AuthLayout>
    );
  }

  if (
    isError &&
    error?.["response"]?.status === 404 &&
    error?.["response"]?.data.message.includes("Workspace not found")
  ) {
    return (
      <>
        <DocumentTitle title={t("Setup Workspace")} />
        <SetupWorkspaceForm ldapOnly={authModeQuery.data.ldapOnly} />
      </>
    );
  }

  return null;
}
