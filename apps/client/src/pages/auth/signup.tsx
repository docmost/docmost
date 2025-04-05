import { useWorkspacePublicDataQuery } from "@/features/workspace/queries/workspace-query.ts";
import { SignupForm } from "@/features/auth/components/sign-up-form.tsx";
import { Helmet } from "react-helmet-async";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import APP_ROUTE from "@/lib/app-route.ts";
import { getAppName } from "@/lib/config.ts";
import { useTranslation } from "react-i18next";

export default function SignupPage() {
  const { t } = useTranslation();
  const {
    data: workspace,
    isLoading,
    isError,
    error,
  } = useWorkspacePublicDataQuery();

  const navigate = useNavigate();

  useEffect(() => {
    //if (!isLoading && workspace) {
      //navigate(APP_ROUTE.AUTH.LOGIN);
    //}
  }, [isLoading, workspace]);

  //if (isLoading) {
    //return <div></div>;
  //}

    return (
      <>
        <Helmet>
          <title>
            {t("Signup User")} - {getAppName()}
          </title>
        </Helmet>
        <SignupForm />
      </>
    );
}
