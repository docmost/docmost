import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSharePageQuery } from "@/features/share/queries/share-query.ts";
import { Container } from "@mantine/core";
import React, { useEffect } from "react";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor.tsx";
import { extractPageSlugId } from "@/lib";
import { Error404 } from "@/components/ui/error-404.tsx";
import ShareBranding from "@/features/share/components/share-branding.tsx";
import { useAtomValue } from "jotai";
import {
  sharedPageFullWidthAtom,
  sharedTreeDataAtom,
} from "@/features/share/atoms/shared-page-atom.ts";
import { isPageInTree } from "@/features/share/utils.ts";
import { DocumentTitle } from "@/components/ui/document-title.tsx";

export default function SharedPage() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { shareId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useSharePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });

  const sharedTreeData = useAtomValue(sharedTreeDataAtom);
  const fullWidth = useAtomValue(sharedPageFullWidthAtom);

  useEffect(() => {
    if (shareId && data) {
      if (data.share.key !== shareId) {

        // Check if the current page is part of the active sharing tree (sidebar) - If we are part of it, we will not redirect, keeping the sidebar visible.
        const isPartOfTree =
          sharedTreeData && isPageInTree(sharedTreeData, data.page.slugId);

        if (!isPartOfTree) {
          navigate(`/share/${data.share.key}/p/${pageSlug}`, { replace: true });
        }
      }
    }
  }, [shareId, data, sharedTreeData]);

  if (isLoading) {
    return <></>;
  }

  if (isError || !data) {
    if ([401, 403, 404].includes(error?.["status"])) {
      return <Error404 />;
    }
    return <div>{t("Error fetching page data.")}</div>;
  }

  return (
    <div>
      <DocumentTitle
        title={data?.page?.title || t("untitled")}
        withAppName={false}
      >
        {!data?.share.searchIndexing && (
          <meta name="robots" content="noindex" />
        )}
      </DocumentTitle>

      <Container fluid={fullWidth} size={fullWidth ? undefined : 900} p={0}>
        <ReadonlyPageEditor
          key={data.page.id}
          title={data.page.title}
          content={data.page.content}
          pageId={data.page.id}
          shareId={data.share.id}
        />
      </Container>

      {data && !shareId && !(data.features?.length > 0) && <ShareBranding />}
    </div>
  );
}
