import { useParams } from "react-router-dom";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { extractPageSlugId } from "@/lib";

export function useCanViewComments(): boolean {
  const { pageSlug } = useParams();
  const { data: page } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  const { data: space } = useGetSpaceBySlugQuery(page?.space?.slug);

  const canEdit = !page?.deletedAt && (page?.permissions?.canEdit ?? false);
  return (
    canEdit || space?.settings?.comments?.hideCommentsFromViewers !== true
  );
}
