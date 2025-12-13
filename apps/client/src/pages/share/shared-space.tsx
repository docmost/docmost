import { useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useTranslation } from "react-i18next";
import {
  useGetSharedPageTreeQuery,
  useSharePageQuery,
} from "@/features/share/queries/share-query.ts";
import { Container } from "@mantine/core";
import React, { useEffect } from "react";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor.tsx";
import { extractPageSlugId } from "@/lib";
import { buildPageSlug } from "@/features/page/page.utils";
import { Error404 } from "@/components/ui/error-404.tsx";
import ShareBranding from "@/features/share/components/share-branding.tsx";

export default function SharedSpace() {
  const { t } = useTranslation();
  const { shareId, spaceSlug, pageSlug } = useParams();
  const navigate = useNavigate();

  // Get the page tree to find pages
  const {
    data: treeData,
    isLoading: treeLoading,
    isError: treeError,
  } = useGetSharedPageTreeQuery(shareId || "");

  // If pageSlug is provided, load that specific page
  const pageId = pageSlug ? extractPageSlugId(pageSlug) : null;

  // Find first root page if no pageSlug is provided
  const firstPage = treeData?.pageTree?.find(
    (p: any) => p && !p.parentPageId
  );

  // Determine which page to load
  const targetPageId = pageId || firstPage?.id;

  const { data, isLoading, isError, error } = useSharePageQuery({
    pageId: targetPageId,
  });

  // Redirect to the page URL once we have it
  useEffect(() => {
    if (!pageSlug && firstPage && shareId && spaceSlug) {
      const slug = buildPageSlug(firstPage.slugId, firstPage.title);
      navigate(`/share/${shareId}/s/${spaceSlug}/p/${slug}`, { replace: true });
    }
  }, [pageSlug, firstPage, shareId, spaceSlug, navigate]);

  if (treeLoading || isLoading) {
    return <></>;
  }

  if (treeError || !treeData?.share) {
    return <Error404 />;
  }

  // If no pages in space
  if (!targetPageId || !firstPage) {
    return (
      <Container size={900} p="xl">
        <div>{t("No pages in this space")}</div>
      </Container>
    );
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
        {!data?.share?.searchIndexing && (
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

      {data && !data.hasLicenseKey && <ShareBranding />}
    </div>
  );
}
