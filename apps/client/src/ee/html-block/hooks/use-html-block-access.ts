import { useAtomValue } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom";
import useUserRole from "@/hooks/use-user-role";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { getHtmlBlockAccess } from "@/ee/html-block/utils/html-block-access";
import { HtmlBlockAccess } from "@/ee/html-block/types/html-block.types";

export function useHtmlBlockAccess(): HtmlBlockAccess {
  const workspace = useAtomValue(workspaceAtom);
  const { isAdmin } = useUserRole();
  const licensed = useHasFeature(Feature.HTML_BLOCKS);

  return getHtmlBlockAccess({
    settings: workspace?.settings?.htmlBlocks,
    isAdmin,
    licensed,
  });
}
