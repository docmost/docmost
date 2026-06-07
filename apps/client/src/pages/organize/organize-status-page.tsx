import { Center, Container, Loader, Text, Title } from "@mantine/core";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config";
import { getOrganizeTaskByToken } from "@/features/organize/services/organize-service";
import { OrganizePanel } from "@/features/organize/components/organize-panel";

export default function OrganizeStatusPage() {
  const { shareToken } = useParams<{ shareToken: string }>();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["organize-task-by-token", shareToken],
    queryFn: () => getOrganizeTaskByToken(shareToken as string),
    enabled: !!shareToken,
  });

  return (
    <>
      <Helmet>
        <title>Organizing - {getAppName()}</title>
      </Helmet>
      <Container size="sm" py="xl">
        <Title order={3} mb="md">
          Organizing
        </Title>

        {isLoading && (
          <Center py="xl">
            <Loader />
          </Center>
        )}

        {isError && (
          <Text c="red">This organize task could not be found.</Text>
        )}

        {data && <OrganizePanel organizeTaskId={data.id} />}
      </Container>
    </>
  );
}
