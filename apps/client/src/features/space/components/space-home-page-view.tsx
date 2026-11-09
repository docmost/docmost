import React from "react";
import { Button, Container, Group } from "@mantine/core";
import { IconPencil } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import ReadonlyPageEditor from "@/features/editor/readonly-page-editor.tsx";
import { BaseView } from "@/ee/base/components/base-view";
import { usePageQuery } from "@/features/page/queries/page-query.ts";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { userAtom } from "@/features/user/atoms/current-user-atom.ts";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import SpacePublicNotice from "@/features/public-space/components/space-public-notice.tsx";
import SpaceHomePageSkeleton from "@/features/space/components/space-home-page-skeleton.tsx";
import { PublicPageCover } from "@/features/page-cover/components/public-page-cover.tsx";
import {
  ISpace,
  ISpaceHomePage,
} from "@/features/space/types/space.types.ts";

type SpaceHomePageViewProps = {
  space: ISpace;
  homePage: ISpaceHomePage;
  fallback: React.ReactNode;
};

export default function SpaceHomePageView({
  space,
  homePage,
  fallback,
}: SpaceHomePageViewProps) {
  const { t } = useTranslation();
  const [user] = useAtom(userAtom);
  const {
    data: page,
    isLoading,
    isError,
  } = usePageQuery(
    { pageId: homePage.id },
    { staleTime: 0, refetchOnMount: true },
  );

  const fullPageWidth = user?.settings?.preferences?.fullPageWidth;

  if (isLoading) {
    return <SpaceHomePageSkeleton />;
  }

  if (isError || !page || page.deletedAt) {
    return <>{fallback}</>;
  }

  const canEdit = page.permissions?.canEdit ?? false;
  const fluid = fullPageWidth || page.isBase;

  return (
    <>
      <DocumentTitle title={space.name} />

      {/* Same height and offset as the page header, so a cover lines up with the page's. */}
      <Group
        justify="flex-end"
        px="md"
        h={45}
        mt="calc(var(--app-shell-padding, 0px) * -1)"
        className="print-hide"
      >
        {canEdit && (
          <Button
            component={Link}
            to={buildPageUrl(space.slug, page.slugId, page.title)}
            variant="default"
            size="xs"
            leftSection={<IconPencil size={14} />}
          >
            {t("Edit")}
          </Button>
        )}
      </Group>

      {!page.isBase && (
        <PublicPageCover
          variant="band"
          coverPhoto={page.coverPhoto}
          coverPosition={page.coverPosition}
          coverAttribution={page.coverAttribution}
        />
      )}

      <Container fluid={fluid} size={!fluid && 900} pb="xl">
        <SpacePublicNotice space={space} />
        {page.isBase ? (
          <BaseView pageId={page.id} embedded editable={false} />
        ) : (
          <ReadonlyPageEditor
            key={`${page.id}:${page.updatedAt}`}
            title={page.title}
            content={page.content}
            pageId={page.id}
            withLightbox
          />
        )}
      </Container>
    </>
  );
}
