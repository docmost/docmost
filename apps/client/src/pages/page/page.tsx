import { useParams } from "react-router-dom";
import { usePageQuery } from "@/features/page/queries/page-query";
import { FullEditor } from "@/features/editor/full-editor";
import { PagesByLabelContext } from "@/features/editor/components/pages-by-label/pages-by-label-context";
import { TitleEditor } from "@/features/editor/title-editor";
import HistoryModal from "@/features/page-history/components/history-modal";
import PageHeader from "@/features/page/components/header/page-header.tsx";
import { extractPageSlugId } from "@/lib";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import SpaceArchivedNotice from "@/features/space/components/space-archived-notice.tsx";
import { useCommentDeepLink } from "@/features/comment/hooks/use-comment-deep-link";
import { useTranslation } from "react-i18next";
import React, { useEffect } from "react";
import { useSetAtom } from "jotai";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import { IconAlertTriangle } from "@tabler/icons-react";
import { Button } from "@mantine/core";
import { ErrorBoundary } from "react-error-boundary";
import { BasePageView } from "@/ee/base/components/base-view";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { getPageTitle } from "@/features/page/page.utils";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import { useExportDisabled } from "@/ee/security/hooks/use-export-disabled.ts";
import { useDisablePrint } from "@/ee/security/hooks/use-disable-print.ts";
import { PageCover } from "@/features/page-cover/components/page-cover.tsx";
import { PageFormattingToolbar } from "@/features/editor/components/fixed-toolbar/fixed-toolbar";
import { usePageEditLockCheck } from "@/ee/page-verification/hooks/use-page-edit-mode";
import { PageLoadingContent, PageLoadError, usePageLayout } from "./page-loading";
const MemoizedFullEditor = React.memo(FullEditor);
const MemoizedTitleEditor = React.memo(TitleEditor);
const MemoizedPageHeader = React.memo(PageHeader);
const MemoizedHistoryModal = React.memo(HistoryModal);

export default function Page() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();

  return (
    <ErrorBoundary
      resetKeys={[pageSlug]}
      fallbackRender={({ resetErrorBoundary }) => (
        <EmptyState
          icon={IconAlertTriangle}
          title={t("Failed to load page. An error occurred.")}
          action={
            <Button variant="default" size="sm" mt="xs" onClick={resetErrorBoundary}>
              {t("Try again")}
            </Button>
          }
        />
      )}
    >
      <PageContent pageSlug={pageSlug} />
    </ErrorBoundary>
  );
}

function PageContent({ pageSlug }: { pageSlug: string | undefined }) {
  const { t } = useTranslation();
  const { spaceSlug } = useParams();
  const pageId = extractPageSlugId(pageSlug);
  const {
    data: page,
    isPending,
    error: pageError,
    refetch: refetchPage,
  } = usePageQuery({ pageId });
  usePageEditLockCheck(page?.id ?? pageId);
  const spaceQuery = useGetSpaceBySlugQuery(page?.space?.slug ?? spaceSlug);
  const { data: space } = spaceQuery;
  const { exportDisabledLabel } = useExportDisabled(page?.space?.slug);
  useDisablePrint(exportDisabledLabel);
  const setAsideState = useSetAtom(asideStateAtom);

  // Keep above useCommentDeepLink so a deep link can reopen the aside.
  useEffect(() => {
    setAsideState({ tab: "", isAsideOpen: false });
  }, [page?.id, setAsideState]);

  useCommentDeepLink(page?.id);

  const hasBases = useHasFeature(Feature.BASES);
  const canEdit = !page?.deletedAt && (page?.permissions?.canEdit ?? false);
  const canComment =
    canEdit ||
    (space?.settings?.comments?.allowViewerComments === true);

  const layout = usePageLayout(page);
  const loading =
    (isPending && !!pageId) ||
    (!!page && !pageError && !space && spaceQuery.isPending);
  const toolbar = layout.showToolbar && (
    <PageFormattingToolbar pageId={loading ? undefined : page?.id} />
  );

  if (loading) {
    return (
      <div>
        {toolbar}
        <PageLoadingContent {...layout} />
      </div>
    );
  }

  if (pageError || !page || !space) {
    return (
      <PageLoadError
        error={pageError ?? spaceQuery.error}
        onRetry={pageError || !page ? refetchPage : spaceQuery.refetch}
      />
    );
  }

  if (page?.isBase) {
    return (
      <div
        className="base-page-root"
        style={{
          display: "flex",
          flexDirection: "column",
          // Height: see `.base-page-root` in core.css.
          // Clear the fixed PageHeader (breadcrumb) plus a little extra so the
          // pinned column-header row isn't tucked half under it.
          paddingTop: "calc(var(--page-header-height) + 6px)",
        }}
      >
        <DocumentTitle
          title={`${page?.icon || ""}  ${getPageTitle(page?.title, page?.isBase, t)}`}
          withAppName={false}
        />
        <MemoizedPageHeader readOnly={!canEdit} />
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            paddingInline: 24,
          }}
        >
          <div style={{ flexShrink: 0 }}>
            <SpaceArchivedNotice space={space} />
          </div>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <BasePageView
              page={page}
              editable={hasBases && canEdit}
              titleSlot={
                <div
                  className="base-page-title"
                  style={{ paddingTop: 2, paddingBottom: 6 }}
                >
                  <MemoizedTitleEditor
                    key={page.id}
                    pageId={page.id}
                    slugId={page.slugId}
                    title={page.title}
                    spaceSlug={page.space?.slug ?? ""}
                    editable={hasBases && canEdit}
                    isBase
                  />
                </div>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    page && (
      <PagesByLabelContext.Provider value={{ pageId: page.id, spaceId: page.spaceId }}>
        <div>
          {toolbar}
          <DocumentTitle
            title={`${page?.icon || ""}  ${getPageTitle(page?.title, page?.isBase, t)}`}
            withAppName={false}
          />

          <MemoizedPageHeader readOnly={!canEdit} />

          <PageCover
            key={`cover-${page.id}`}
            page={page}
            editable={canEdit}
            belowToolbar={layout.showToolbar}
          />

          <MemoizedFullEditor
            key={page.id}
            pageId={page.id}
            title={page.title}
            content={page.content}
            slugId={page.slugId}
            spaceId={page.spaceId}
            spaceSlug={page?.space?.slug}
            editable={canEdit}
            creator={page.creator}
            contributors={page.contributors}
            canComment={canComment}
            hasCover={layout.hasCover}
            showToolbar={layout.showToolbar}
          />
          <MemoizedHistoryModal pageId={page.id} />
        </div>
      </PagesByLabelContext.Provider>
    )
  );
}
