import { Container, Title, Text, Group, Box } from "@mantine/core";
import { useTranslation } from "react-i18next";
import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config";
import { useGetSpacesQuery } from "@/features/space/queries/space-query";
import CreateSpaceModal from "@/features/space/components/create-space-modal";
import { AllSpacesList } from "@/features/space/components/spaces-page";
import { usePaginateAndSearch } from "@/hooks/use-paginate-and-search";
import useUserRole from "@/hooks/use-user-role";

export default function Spaces() {
  const { t } = useTranslation();
  const { isAdmin } = useUserRole();
  const { search, cursor, goNext, goPrev, handleSearch } = usePaginateAndSearch();

  const { data, isLoading } = useGetSpacesQuery({
    cursor,
    limit: 30,
    query: search,
  });

  return (
    <>
      <Helmet>
        <title>
          {t("Spaces")} - {getAppName()}
        </title>
      </Helmet>

      <Container size={"800"} pt="xl">
        <Group justify="space-between" mb="xl">
          <Title order={3}>{t("Spaces")}</Title>
          {isAdmin && <CreateSpaceModal />}
        </Group>

        <Box>
          <Text size="sm" c="dimmed" mb="md">
            {t("Spaces you belong to")}
          </Text>

          <AllSpacesList
            spaces={data?.items || []}
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
