import { useShareForPageQuery } from "@/features/share/queries/share-query";
import { getAppUrl } from "@/lib/config";
import { extractPageSlugId } from "@/lib/utils";
import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";

export const usePublicLink = () => {
  const { pageSlug } = useParams();
  const pageId = extractPageSlugId(pageSlug);
  const { data: share } = useShareForPageQuery(pageId);

  const publicLink = useMemo(() => {
    return `${getAppUrl()}/share/${share?.key}/p/${pageSlug}`;
  }, [share, pageSlug]);

  return publicLink;
};