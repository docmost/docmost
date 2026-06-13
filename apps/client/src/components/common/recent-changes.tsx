import {
  Text,
  Group,
  UnstyledButton,
  Badge,
  Table,
  Button,
} from "@mantine/core";
import { Link } from "react-router-dom";
import PageListSkeleton from "@/components/ui/page-list-skeleton.tsx";
import { buildPageUrl, getPageTitle } from "@/features/page/page.utils.ts";
import { formattedDate } from "@/lib/time.ts";
import { useRecentChangesQuery } from "@/features/page/queries/page-query.ts";
import { PageListIcon } from "@/components/common/page-list-icon";
import { IconFiles } from "@tabler/icons-react";
import { EmptyState } from "@/components/ui/empty-state.tsx";
import { getSpaceUrl } from "@/lib/config.ts";
import { useTranslation } from "react-i18next";
import { getInitialsColor } from "@/lib/get-initials-color.ts";
import rowClasses from "@/components/ui/clickable-table-row.module.css";

interface Props {
  spaceId?: string;
}

export default function RecentChanges({ spaceId }: Props) {
  const { t } = useTranslation();
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useRecentChangesQuery(spaceId);
  const pages = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading) {
    return <PageListSkeleton />;
  }

  if (isError) {
    return <Text>{t("Failed to fetch recent pages")}</Text>;
  }

  return pages.length > 0 ? (
    <>
      <Table.ScrollContainer minWidth={500}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Tbody>
            {pages.map((page) => (
              <Table.Tr key={page.id} className={rowClasses.row}>
                <Table.Td>
                  <UnstyledButton
                    className={rowClasses.link}
                    component={Link}
                    to={buildPageUrl(page?.space.slug, page.slugId, page.title)}
                  >
                    <Group wrap="nowrap">
                      <PageListIcon icon={page.icon} isBase={page.isBase} />

                      <Text fw={500} size="md" lineClamp={1}>
                        {getPageTitle(page.title, page.isBase, t)}
                      </Text>
                    </Group>
                  </UnstyledButton>
                </Table.Td>
                {!spaceId && (
                  <Table.Td>
                    <Badge
                      color={getInitialsColor(page?.space.name)}
                      variant="light"
                      component={Link}
                      to={getSpaceUrl(page?.space.slug)}
                      style={{ cursor: "pointer" }}
                    >
                      {page?.space.name}
                    </Badge>
                  </Table.Td>
                )}
                <Table.Td>
                  <Text
                    c="dimmed"
                    style={{ whiteSpace: "nowrap" }}
                    size="xs"
                    fw={500}
                  >
                    {formattedDate(page.updatedAt)}
                  </Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {hasNextPage && (
        <Button
          variant="subtle"
          fullWidth
          mt="sm"
          mb="xl"
          onClick={() => fetchNextPage()}
          loading={isFetchingNextPage}
        >
          {t("Load more")}
        </Button>
      )}
    </>
  ) : (
    <EmptyState
      icon={IconFiles}
      title={t("No pages yet")}
      description={t("Pages you create will show up here.")}
    />
  );
}
