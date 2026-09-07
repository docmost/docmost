import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Skeleton, Stack, Text } from "@mantine/core";
import React from "react";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor.tsx";
import { extractPageSlugId } from "@/lib";
import { Error404 } from "@/components/ui/error-404.tsx";
import { usePublicSpacePageQuery } from "@/features/public-space/queries/public-space-query.ts";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import DocsBreadcrumbs from "@/features/public-space/components/docs/docs-breadcrumbs.tsx";
import DocsPageNav from "@/features/public-space/components/docs/docs-page-nav.tsx";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { timeAgo } from "@/lib/time.ts";
import styles from "@/features/public-space/components/docs/docs.module.css";

export default function PublicSpacePage() {
  const { t } = useTranslation();
  const { spaceSlug, pageSlug } = useParams();

  const { data, isLoading, isError, error } = usePublicSpacePageQuery({
    spaceSlug,
    pageSlugId: pageSlug ? extractPageSlugId(pageSlug) : undefined,
  });

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

  if (data.page === null) {
    return (
      <div className={styles.emptyState}>
        <Text c="dimmed">{t("This space has no public pages yet.")}</Text>
      </div>
    );
  }

  const showAuthor =
    data.byline?.author === true && Boolean(data.page.creator?.name);
  const showUpdatedAt =
    data.byline?.updatedAt === true && Boolean(data.page.updatedAt);

  return (
    <div>
      <DocumentTitle
        title={data.page.title || data.space.name || t("untitled")}
        withAppName={false}
      >
        {!data.searchIndexing && <meta name="robots" content="noindex" />}
      </DocumentTitle>

      <DocsBreadcrumbs />

      <ReadonlyPageEditor
        key={data.page.id}
        title={data.page.title}
        content={data.page.content}
        pageId={data.page.id}
        spaceSlug={spaceSlug}
        byline={
          <DocsByline
            creator={showAuthor ? data.page.creator : undefined}
            updatedAt={showUpdatedAt ? data.page.updatedAt : undefined}
          />
        }
        trailingSpace={false}
      />

      <DocsPageNav />
    </div>
  );
}

type DocsBylineProps = {
  creator?: { name: string; avatarUrl: string };
  updatedAt?: Date | string;
};

function DocsByline({ creator, updatedAt }: DocsBylineProps) {
  const { t } = useTranslation();

  if (!creator && !updatedAt) return null;

  return (
    <div className={styles.byline}>
      {creator && (
        <span className={styles.bylineAuthor}>
          <CustomAvatar
            avatarUrl={creator.avatarUrl}
            name={creator.name}
            size={20}
          />
          {t("By {{name}}", { name: creator.name })}
        </span>
      )}

      {creator && updatedAt && (
        <span className={styles.bylineDot} aria-hidden>
          •
        </span>
      )}

      {updatedAt && (
        <span>
          {t("Updated {{date}}", { date: timeAgo(new Date(updatedAt)) })}
        </span>
      )}
    </div>
  );
}
