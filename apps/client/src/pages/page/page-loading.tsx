import { Button, Container, Skeleton } from "@mantine/core";
import { IconFileOff } from "@tabler/icons-react";
import { useAtomValue } from "jotai";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useParams } from "react-router-dom";
import { EmptyState } from "@/components/ui/empty-state";
import { usePageEditMode } from "@/ee/page-verification/hooks/use-page-edit-mode";
import classes from "@/features/editor/styles/editor.module.css";
import coverClasses from "@/features/page-cover/components/page-cover.module.css";
import { resolveCover } from "@/features/page-cover/page-cover.utils";
import { getPageTitle } from "@/features/page/page.utils";
import { usePageQuery } from "@/features/page/queries/page-query";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom";
import { findPageInTree } from "@/features/page/tree/utils";
import type { IPage } from "@/features/page/types/page.types";
import { userAtom } from "@/features/user/atoms/current-user-atom";
import { PageEditMode } from "@/features/user/types/user.types";
import { extractPageSlugId } from "@/lib";

// Fetch the page alongside the first download of the editor chunk.
export function PageRouteFallback() {
  const { pageSlug } = useParams();
  const {
    data: page,
    error,
    refetch,
  } = usePageQuery({ pageId: extractPageSlugId(pageSlug) });
  if (error) return <PageLoadError error={error} onRetry={refetch} />;
  return <PageLoading page={page} />;
}

export function PageLoadError({
  error,
  onRetry,
}: {
  error?: Error & { status?: number };
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  if ([401, 403, 404].includes(error?.status)) {
    return (
      <EmptyState
        icon={IconFileOff}
        title={t("Page not found")}
        description={t(
          "This page may have been deleted, moved, or you may not have access.",
        )}
        action={
          <Button
            component={Link}
            to="/home"
            variant="default"
            size="sm"
            mt="xs"
          >
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
      action={
        <Button variant="default" size="sm" mt="xs" onClick={() => onRetry()}>
          {t("Try again")}
        </Button>
      }
    />
  );
}

export function usePageLayout(page?: IPage) {
  const { pageSlug } = useParams();
  const tree = useAtomValue(treeDataAtom);
  const user = useAtomValue(userAtom);
  const pageId = extractPageSlugId(pageSlug);
  const preview = useMemo(() => {
    if (page) {
      return {
        id: page.id,
        title: page.title,
        isBase: page.isBase,
        editable: !!page.permissions?.canEdit && !page.deletedAt,
        coverPhoto: page.coverPhoto,
      };
    }
    const node = findPageInTree(tree, pageId);
    return (
      node && {
        id: node.id,
        title: node.name,
        isBase: node.isBase,
        editable: node.canEdit,
        coverPhoto: node.coverPhoto,
      }
    );
  }, [page, tree, pageId]);
  const fullWidth = user?.settings?.preferences?.fullPageWidth;
  const toolbarEnabled = user?.settings?.preferences?.editorToolbar;
  // Same key as the page's entry check, so loading asks once.
  const { editMode } = usePageEditMode(toolbarEnabled ? (page?.id ?? pageId) : undefined);
  // An unknown destination can retain the previous toolbar's space and controls
  // while its metadata loads. Only the live editor can enable those controls.
  const previousToolbar = useRef(false);
  const showToolbar = Boolean(
    toolbarEnabled &&
    editMode === PageEditMode.Edit &&
    !preview?.isBase &&
    (preview?.editable ?? previousToolbar.current),
  );
  useLayoutEffect(() => {
    previousToolbar.current = showToolbar;
  }, [showToolbar]);
  const hasCover = !preview?.isBase && Boolean(resolveCover(preview?.coverPhoto));
  return { preview, fullWidth, showToolbar, hasCover };
}

export function PageLoading({ page }: { page?: IPage }) {
  const layout = usePageLayout(page);
  return <PageLoadingContent {...layout} />;
}

export function PageLoadingContent({
  preview,
  fullWidth,
  showToolbar,
  hasCover,
}: ReturnType<typeof usePageLayout>) {
  const { t } = useTranslation();

  return (
    <div>
      {hasCover && (
        <div className={coverClasses.cover} data-below-toolbar={showToolbar || undefined} aria-hidden />
      )}
      <Container
        fluid={fullWidth}
        size={900}
        className={classes.editor}
        aria-busy="true"
      >
        {showToolbar && !hasCover && (
          <div className={classes.toolbarSpacer} aria-hidden />
        )}
        {preview?.editable && !preview.isBase && !hasCover && (
          <div className={classes.coverRow} aria-hidden />
        )}
        <div className={classes.loadingContent}>
          {preview ? (
            <h1 className={classes.loadingTitle} dir="auto">
              {getPageTitle(preview.title, preview.isBase, t)}
            </h1>
          ) : (
            <div className={classes.loadingTitlePlaceholder}>
              <Skeleton width="45%" height="2.5rem" animate={false} />
            </div>
          )}
        </div>
        {!preview?.isBase && <div className={classes.byline} aria-hidden />}
        <div
          role="status"
          aria-label={t("Loading…")}
          className={`${classes.loadingContent} ${classes.loadingLines}`}
        >
          <Skeleton height={12} width="88%" animate={false} />
          <Skeleton height={12} width="72%" animate={false} />
          <Skeleton height={12} width="80%" animate={false} />
        </div>
      </Container>
    </div>
  );
}
