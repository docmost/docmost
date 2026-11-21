import type { UploadTarget } from "@docmost/editor-ext";
import { HtmlBlockOwner } from "@/ee/html-block/types/html-block.types";

export function isOwnedByTarget(
  owner: HtmlBlockOwner | null | undefined,
  target: UploadTarget,
): boolean {
  if (!owner) return false;
  return "pageId" in target
    ? owner.pageId === target.pageId
    : owner.templateId === target.templateId;
}
