import { useAtomValue } from "jotai";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { isDisableHtmlBlocks } from "@/lib/config";
import { getHtmlBlockAccess } from "@/ee/html-block/utils/html-block-access";
import { HtmlBlockAccess } from "@/ee/html-block/types/html-block.types";

export function useHtmlBlockAccess(): HtmlBlockAccess {
  const workspace = useAtomValue(workspaceAtom);
  const licensed = useHasFeature(Feature.HTML_BLOCKS);

  return getHtmlBlockAccess({
    settings: workspace?.settings?.htmlBlocks,
    licensed,
    disabledOnServer: isDisableHtmlBlocks(),
  });
}
