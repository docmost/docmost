import { SetupWorkspaceForm } from "@/features/auth/components/setup-workspace-form.tsx";
import React from "react";
import { DocumentTitle } from "@/components/ui/document-title.tsx";

export default function CreateWorkspace() {
  return (
    <>
      <DocumentTitle title="Create Workspace" />
      <SetupWorkspaceForm />
    </>
  );
}
