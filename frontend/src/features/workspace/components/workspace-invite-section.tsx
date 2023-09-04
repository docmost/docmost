"use client";

import { useAtom } from "jotai/index";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";


export default function WorkspaceInviteSection() {
  const [currentUser] = useAtom(currentUserAtom);
  const [inviteLink, setInviteLink] = useState<string>("");

  useEffect(() => {
    setInviteLink(`${window.location.origin}/invite/${currentUser.workspace.inviteCode}`);
  }, [currentUser.workspace.inviteCode]);

  function handleCopy(): void {
    try {
      navigator.clipboard?.writeText(inviteLink);
      toast.success("Link copied successfully");
    } catch (err) {
      toast.error("Failed to copy to clipboard");
    }
  }

  return (
    <>
      <div>
        <h2 className="font-semibold py-5">Invite members</h2>
        <p className="text-muted-foreground">
          Anyone with the link can join this workspace.
        </p>
      </div>

      <div className="flex space-x-2">
        <Input value={inviteLink} readOnly />
        <Button variant="secondary" className="shrink-0" onClick={handleCopy}>
          Copy link
        </Button>
      </div>
    </>
  );
}
