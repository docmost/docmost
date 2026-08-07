import { useParams } from "react-router-dom";
import { usePageQuery } from "@/features/page/queries/page-query";
import { FullEditor } from "@/features/editor/full-editor";
import { TitleEditor } from "@/features/editor/title-editor";
import HistoryModal from "@/features/page-history/components/history-modal";
import { Helmet } from "react-helmet-async";
import PageHeader from "@/features/page/components/header/page-header.tsx";
import { extractPageSlugId } from "@/lib";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { useTranslation } from "react-i18next";
import React from "react";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import { IconAlertTriangle, IconFileOff } from "@tabler/icons-react";
import { Button } from "@mantine/core";
import { Link } from "react-router-dom";
import { ErrorBoundary } from "react-error-boundary";
import { BaseView } from "@/ee/base/components/base-view";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import { getPageTitle } from "@/features/page/page.utils";
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

  const {
    data: page,
    isLoading,
    isError,
    error,
  } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  const { data: space } = useGetSpaceBySlugQuery(page?.space?.slug);

  const hasBases = useHasFeature(Feature.BASES);
  const canEdit = !page?.deletedAt && (page?.permissions?.canEdit ?? false);
  const canComment =
    canEdit ||
    (space?.settings?.comments?.allowViewerComments === true);

  if (isLoading) {
    return <></>;
  }

  if (isError || !page) {
    if ([401, 403, 404].includes(error?.["status"])) {
      return (
        <EmptyState
          icon={IconFileOff}
          title={t("Page not found")}
          description={t(
            "This page may have been deleted, moved, or you may not have access.",
          )}
          action={
            <Button component={Link} to="/home" variant="default" size="sm" mt="xs">
              {t("Go to homepage")}
            </Button>
          }
        />
      );
    }
    return (
      <EmptyState
        icon={IconFileOff}
        title={t("Error fetching page data.")}
      />
    );
  }

  if (!space) {
    return <></>;
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
        <Helmet>
          <title>{`${page?.icon || ""}  ${getPageTitle(page?.title, page?.isBase, t)}`}</title>
        </Helmet>
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
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <BaseView
              pageId={page.id}
              editable={hasBases && canEdit}
              titleSlot={
                <div
                  className="base-page-title"
                  style={{ paddingTop: 2, paddingBottom: 6 }}
                >
                  <MemoizedTitleEditor
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
      <div>
        <Helmet>
          <title>{`${page?.icon || ""}  ${getPageTitle(page?.title, page?.isBase, t)}`}</title>
        </Helmet>

        <MemoizedPageHeader readOnly={!canEdit} />

        <MemoizedFullEditor
          key={page.id}
          pageId={page.id}
          title={page.title}
          content={page.content}
          slugId={page.slugId}
          spaceSlug={page?.space?.slug}
          editable={canEdit}
          creator={page.creator}
          contributors={page.contributors}
          canComment={canComment}
        />
        <MemoizedHistoryModal pageId={page.id} />
      </div>
    )
  );
}
