import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import { useSharePageQuery } from "@/features/share/queries/share-query.ts";
import { Container } from "@mantine/core";
import React, { useEffect } from "react";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor.tsx";
import { extractPageSlugId } from "@/lib";
import { Error404 } from "@/components/ui/error-404.tsx";
import ShareBranding from "@/features/share/components/share-branding.tsx";
import { useAtomValue } from "jotai";
import { sharedTreeDataAtom } from "@/features/share/atoms/shared-page-atom.ts";
import { isPageInTree } from "@/features/share/utils.ts";

export default function SharedPage() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const { shareId } = useParams();
  const navigate = useNavigate();

  const { data, isLoading, isError, error } = useSharePageQuery({
    pageId: extractPageSlugId(pageSlug),
  });

  const sharedTreeData = useAtomValue(sharedTreeDataAtom);

  useEffect(() => {
    if (shareId && data) {
      if (data.share.key !== shareId) {
        // Verifica se a página atual faz parte da árvore de compartilhamento ativa (sidebar) - Se fizer parte, não redirecionamos, mantendo a sidebar visível
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
      <Helmet>
        <title>{`${data?.page?.title || t("untitled")}`}</title>
        {!data?.share.searchIndexing && (
          <meta name="robots" content="noindex" />
        )}
      </Helmet>

      <Container size={900} p={0}>
        <ReadonlyPageEditor
          key={data.page.id}
          title={data.page.title}
          content={data.page.content}
          pageId={data.page.id}
        />
      </Container>

      {data && !shareId && !data.hasLicenseKey && <ShareBranding />}
    </div>
  );
}
