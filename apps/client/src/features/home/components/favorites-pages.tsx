import {
  Text,
  Group,
  UnstyledButton,
  Badge,
  Table,
  Button,
} from "@mantine/core";
import { Link } from "react-router-dom";
import PageListSkeleton from "@/components/ui/page-list-skeleton";
import { buildPageUrl, getPageTitle } from "@/features/page/page.utils";
import { formattedDate } from "@/lib/time";
import { useFavoritesQuery } from "@/features/favorite/queries/favorite-query";
import { PageListIcon } from "@/components/common/page-list-icon";
import { IconStar } from "@tabler/icons-react";
import { EmptyState } from "@/components/ui/empty-state";
import { getSpaceUrl } from "@/lib/config";
import { useTranslation } from "react-i18next";
import { getInitialsColor } from "@/lib/get-initials-color";
import rowClasses from "@/components/ui/clickable-table-row.module.css";

interface Props {
  spaceId?: string;
}

export default function FavoritesPages({ spaceId }: Props) {
  const { t } = useTranslation();
  const {
    data,
    isLoading,
    isError,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useFavoritesQuery("page", spaceId);

  const favorites = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading) {
    return <PageListSkeleton />;
  }

  if (isError) {
    return <Text>{t("Failed to fetch starred pages")}</Text>;
  }

  return favorites.length > 0 ? (
    <>
      <Table.ScrollContainer minWidth={500}>
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Tbody>
            {favorites.map((fav) =>
              fav.page ? (
                <Table.Tr key={fav.id} className={rowClasses.row}>
                  <Table.Td>
                    <UnstyledButton
                      className={rowClasses.link}
                      component={Link}
                      to={buildPageUrl(
                        fav.space?.slug,
                        fav.page.slugId,
                        fav.page.title,
                      )}
                    >
                      <Group wrap="nowrap">
                        <PageListIcon
                          icon={fav.page.icon}
                          isBase={fav.page.isBase}
                        />
                        <Text fw={500} size="md" lineClamp={1}>
                          {getPageTitle(fav.page.title, fav.page.isBase, t)}
                        </Text>
                      </Group>
                    </UnstyledButton>
                  </Table.Td>
                  {!spaceId && (
                    <Table.Td>
                      {fav.space && (
                        <Badge
                          color={getInitialsColor(fav.space.name)}
                          variant="light"
                          component={Link}
                          to={getSpaceUrl(fav.space.slug)}
                          style={{ cursor: "pointer" }}
                        >
                          {fav.space.name}
                        </Badge>
                      )}
                    </Table.Td>
                  )}
                  <Table.Td>
                    <Text
                      c="dimmed"
                      style={{ whiteSpace: "nowrap" }}
                      size="xs"
                      fw={500}
                    >
                      {formattedDate(new Date(fav.createdAt))}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ) : null,
            )}
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
      icon={IconStar}
      title={t("No favorites yet")}
      description={t("Pages you star will show up here.")}
    />
  );
}
