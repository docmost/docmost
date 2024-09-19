import { useWorkspacePublicDataQuery } from "@/features/workspace/queries/workspace-query.ts";
import { SetupWorkspaceForm } from "@/features/auth/components/setup-workspace-form.tsx";
import { Helmet } from "react-helmet-async";
import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function SetupWorkspace() {
  const {
    data: workspace,
    isLoading,
    isError,
    error,
  } = useWorkspacePublicDataQuery();

  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isError && workspace) {
      navigate("/");
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
          <title>Setup workspace - Docmost</title>
        </Helmet>
        <SetupWorkspaceForm />
      </>
    );
  }

  return null;
}
