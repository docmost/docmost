"use client";

import { Separator } from "@/components/ui/separator";
import WorkspaceInviteSection from "@/features/workspace/components/workspace-invite-section";
import React from "react";
import WorkspaceInviteDialog from "@/features/workspace/components/workspace-invite-dialog";

const WorkspaceMembersTable = React.lazy(() => import('@/features/workspace/components/workspace-members-table'));

export default function WorkspaceMembers() {
  return (
    <>
      <WorkspaceInviteSection />

      <Separator className="my-8" />

      <div className="space-y-4">
        <h4 className="font-semibold">Members</h4>

        <WorkspaceInviteDialog />

        <WorkspaceMembersTable />

      </div>
    </>
  );
}
