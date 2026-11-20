import { useParams } from "react-router-dom";
import { Container, Title, Text, Stack } from "@mantine/core";
import { IconTable } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { BasePageView } from "@/ee/base/components/base-view";
import { BaseTableSkeleton } from "@/ee/base/components/base-table-skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { usePageQuery } from "@/features/page/queries/page-query";
import { getPageTitle } from "@/features/page/page.utils";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";

export default function BasePage() {
  const { pageId } = useParams<{ pageId: string }>();
  const { t } = useTranslation();
  const hasBases = useHasFeature(Feature.BASES);
  const { data: page, isLoading, isError } = usePageQuery({ pageId });

  if (!pageId) {
    return (
      <Stack align="center" p="xl">
        <Text c="dimmed">No base ID provided</Text>
      </Stack>
    );
  }

  if (isLoading) return <BaseTableSkeleton />;
  if (isError || !page?.isBase) {
    return <EmptyState icon={IconTable} title={t("Failed to load base")} />;
  }

  return (
    <Container
      fluid
      p="md"
      style={{
        height: "calc(100vh - 60px - var(--announcement-banners-height, 0px))",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <BasePageView
        page={page}
        editable={hasBases && (page.permissions?.canEdit ?? false)}
        titleSlot={
          <Title order={3} mb="xs">
            {page.icon ? `${page.icon} ` : ""}{getPageTitle(page.title, true, t)}
          </Title>
        }
      />
    </Container>
  );
}
