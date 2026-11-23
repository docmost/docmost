import { getDefaultStore } from "jotai";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import { entitlementAtom } from "@/ee/entitlement/entitlement-atom";
import { Feature } from "@/ee/features";
import { isDisableHtmlBlocks } from "@/lib/config";
import { IWorkspaceHtmlBlockSettings } from "@/features/workspace/types/workspace.types";
import { HtmlBlockAccess } from "@/ee/html-block/types/html-block.types";

export function getHtmlBlockAccess(input: {
  settings?: IWorkspaceHtmlBlockSettings;
  licensed: boolean;
  disabledOnServer: boolean;
}): HtmlBlockAccess {
  const enabled = !input.disabledOnServer && input.settings?.enabled === true;

  return {
    enabled,
    licensed: input.licensed,
    canEdit: input.licensed && enabled,
  };
}

export function canEditHtmlBlocksNow(): boolean {
  const store = getDefaultStore();
  const currentUser = store.get(currentUserAtom);

  return getHtmlBlockAccess({
    settings: currentUser?.workspace?.settings?.htmlBlocks,
    licensed:
      store.get(entitlementAtom)?.features?.includes(Feature.HTML_BLOCKS) ??
      false,
    disabledOnServer: isDisableHtmlBlocks(),
  }).canEdit;
}
