"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ButtonWithIcon from "@/components/ui/button-with-icon";
import { IconUserPlus } from "@tabler/icons-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WorkspaceInviteForm } from "@/features/workspace/components/workspace-invite-form";

export default function WorkspaceInviteDialog() {

  return (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <ButtonWithIcon
            icon={<IconUserPlus size="20" />}
            className="font-medium">
            Invite Members
          </ButtonWithIcon>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Invite new members
            </DialogTitle>
            <DialogDescription>
              Here you can invite new members.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className=" max-h-[60vh]">
            <WorkspaceInviteForm />
          </ScrollArea>

        </DialogContent>
      </Dialog>
    </>
  );
}
