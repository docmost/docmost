import { useState } from "react";
import { Container, Title, Text, Group, Box } from "@mantine/core";
import { useTranslation } from "react-i18next";
import {
  useGetSpacesQuery,
  useHasArchivedSpaces,
} from "@/features/space/queries/space-query";
import CreateSpaceModal from "@/features/space/components/create-space-modal";
import { AllSpacesList } from "@/features/space/components/spaces-page";
import FavoriteSpacesGrid from "@/features/space/components/spaces-page/favorite-spaces-grid";
import { usePaginateAndSearch } from "@/hooks/use-paginate-and-search";
import useUserRole from "@/hooks/use-user-role";
import { DocumentTitle } from "@/components/ui/document-title.tsx";

export default function Spaces() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const { search, cursor, goNext, goPrev, handleSearch, resetPagination } =
    usePaginateAndSearch();
  const [archived, setArchived] = useState(false);

  const { data, isPlaceholderData } = useGetSpacesQuery({
    cursor,
    limit: 30,
    query: search,
    archived: archived || undefined,
  });

  const handleArchivedChange = (value: boolean) => {
    setArchived(value);
    resetPagination();
  };

  const activeListEmpty =
    !archived && !search && !isPlaceholderData && data?.items.length === 0;
  const hasArchivedSpaces = useHasArchivedSpaces(activeListEmpty);
  const noActiveSpaces = activeListEmpty && hasArchivedSpaces;

  return (
    <>
      <DocumentTitle title={t("Spaces")} />

      <Container size={"800"} pt="xl">
        <Group justify="space-between" mb="xl">
          <Title order={1} size="h3">{t("Spaces")}</Title>
          {isAdmin && <CreateSpaceModal />}
        </Group>

        <FavoriteSpacesGrid />

        <Box>
          <Text size="sm" c="dimmed" mb="md">
            {t("All spaces")}
          </Text>

          <AllSpacesList
            spaces={data?.items || []}
            archived={archived}
            onArchivedChange={handleArchivedChange}
            emptyText={
              noActiveSpaces
                ? t("No active spaces. Archived spaces are under Archived.")
                : undefined
            }
            onSearch={handleSearch}
            hasPrevPage={data?.meta?.hasPrevPage}
            hasNextPage={data?.meta?.hasNextPage}
            onNext={() => goNext(data?.meta?.nextCursor)}
            onPrev={goPrev}
          />
        </Box>
      </Container>
    </>
  );
}
