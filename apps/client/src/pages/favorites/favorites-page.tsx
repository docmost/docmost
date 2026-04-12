import {
  Text,
  Group,
  UnstyledButton,
  Badge,
  Table,
  Container,
  Title,
  ActionIcon,
  Button,
} from "@mantine/core";
import { Link } from "react-router-dom";
import { buildPageUrl } from "@/features/page/page.utils";
import { formattedDate } from "@/lib/time";
import { useFavoritesQuery } from "@/features/favorite/queries/favorite-query";
import { IconFileDescription, IconStar } from "@tabler/icons-react";
import { EmptyState } from "@/components/ui/empty-state";
import { getSpaceUrl } from "@/lib/config";
import { useTranslation } from "react-i18next";
import { getInitialsColor } from "@/lib/get-initials-color";
import PageListSkeleton from "@/components/ui/page-list-skeleton";

export default function FavoritesPage() {
  const { t } = useTranslation();
  const { data, isLoading, isError, hasNextPage, fetchNextPage, isFetchingNextPage } = useFavoritesQuery("page");
  const favorites = data?.pages.flatMap((p) => p.items) ?? [];

  if (isLoading) {
    return (
      <Container size={800} py="xl">
        <Title order={3} mb="lg">
          {t("Favorites")}
        </Title>
        <PageListSkeleton />
      </Container>
    );
  }

  if (isError) {
    return (
      <Container size={800} py="xl">
        <Title order={3} mb="lg">
          {t("Favorites")}
        </Title>
        <Text>{t("Failed to fetch favorite pages")}</Text>
      </Container>
    );
  }

  return (
    <Container size={800} py="xl">
      <Title order={3} mb="lg">
        {t("Favorites")}
      </Title>
      {favorites.length > 0 ? (
        <>
          <Table.ScrollContainer minWidth={500}>
            <Table highlightOnHover verticalSpacing="sm">
              <Table.Tbody>
                {favorites.map((fav) =>
                  fav.page ? (
                    <Table.Tr key={fav.id}>
                      <Table.Td>
                        <UnstyledButton
                          component={Link}
                          to={buildPageUrl(
                            fav.space?.slug,
                            fav.page.slugId,
                            fav.page.title,
                          )}
                        >
                          <Group wrap="nowrap">
                            {fav.page.icon || (
                              <ActionIcon
                                variant="transparent"
                                color="gray"
                                size={18}
                              >
                                <IconFileDescription size={18} />
                              </ActionIcon>
                            )}
                            <Text fw={500} size="md" lineClamp={1}>
                              {fav.page.title || t("Untitled")}
                            </Text>
                          </Group>
                        </UnstyledButton>
                      </Table.Td>
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
          title={t("No favorite pages")}
          description={t("Pages you favorite will show up here.")}
        />
      )}
    </Container>
  );
}
