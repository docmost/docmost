import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSharePageQuery } from "@/features/share/queries/share-query.ts";
import { Skeleton, Stack } from "@mantine/core";
import React, { useEffect } from "react";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor.tsx";
import { extractPageSlugId } from "@/lib";
import { Error404 } from "@/components/ui/error-404.tsx";
import { useAtomValue } from "jotai";
import { sharedTreeDataAtom } from "@/features/share/atoms/shared-page-atom.ts";
import { isPageInTree } from "@/features/share/utils.ts";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import DocsBreadcrumbs from "@/features/public-space/components/docs/docs-breadcrumbs.tsx";
import DocsPageNav from "@/features/public-space/components/docs/docs-page-nav.tsx";
import DocsFooterBranding from "@/features/public-space/components/docs/docs-footer-branding.tsx";

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
    return (
      <Stack gap="md" pt={4} aria-hidden>
        <Skeleton height={13} width={180} radius="sm" />
        <Skeleton height={34} width="55%" radius="sm" mt={10} />
        <Skeleton height={12} width="90%" radius="sm" mt={18} />
        <Skeleton height={12} width="97%" radius="sm" />
        <Skeleton height={12} width="85%" radius="sm" />
        <Skeleton height={12} width="60%" radius="sm" />
      </Stack>
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
      <DocumentTitle
        title={data?.page?.title || t("untitled")}
        withAppName={false}
      >
        {!data?.share.searchIndexing && (
          <meta name="robots" content="noindex" />
        )}
      </DocumentTitle>

      <DocsBreadcrumbs />

      <ReadonlyPageEditor
        key={data.page.id}
        title={data.page.title}
        content={data.page.content}
        pageId={data.page.id}
        shareId={data.share.id}
        trailingSpace={false}
      />

      <DocsPageNav />

      {/* No tree query without a shareId, so the shell can't own branding here. */}
      {!shareId && <DocsFooterBranding refSource="public-share" />}
    </div>
  );
}
