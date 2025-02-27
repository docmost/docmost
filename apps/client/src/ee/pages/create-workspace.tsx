import { SetupWorkspaceForm } from "@/features/auth/components/setup-workspace-form.tsx";
import { Helmet } from "react-helmet-async";
import React from "react";
import { getAppName } from "@/lib/config.ts";

export default function CreateWorkspace() {
  return (
    <>
      <Helmet>
        <title>Create Workspace - {getAppName()}</title>
      </Helmet>
      <SetupWorkspaceForm />
    </>
  );
}
