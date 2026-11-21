import { getDefaultStore } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import { Feature } from "@/ee/features";
import { UserRole } from "@/lib/types";
import { IWorkspaceHtmlBlockSettings } from "@/features/workspace/types/workspace.types";
import { HtmlBlockAccess } from "@/ee/html-block/types/html-block.types";

export function getHtmlBlockAccess(input: {
  settings?: IWorkspaceHtmlBlockSettings;
  isAdmin: boolean;
  licensed: boolean;
}): HtmlBlockAccess {
  const enabled = input.settings?.enabled === true;
  const allowMembers = input.settings?.allowMembers === true;

  return {
    enabled,
    licensed: input.licensed,
    canEdit: input.licensed && enabled && (input.isAdmin || allowMembers),
  };
}

export function canEditHtmlBlocksNow(): boolean {
  const store = getDefaultStore();
  const currentUser = store.get(currentUserAtom);
  const role = currentUser?.user?.role;

  return getHtmlBlockAccess({
    settings: currentUser?.workspace?.settings?.htmlBlocks,
    isAdmin: role === UserRole.ADMIN || role === UserRole.OWNER,
    licensed:
      store.get(entitlementAtom)?.features?.includes(Feature.HTML_BLOCKS) ??
      false,
  }).canEdit;
}
