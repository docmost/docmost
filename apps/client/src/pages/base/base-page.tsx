import { useParams } from "react-router-dom";
import { Container, Title, Text, Stack } from "@mantine/core";
import { BaseView } from "@/features/base/components/base-view";
import { useBaseQuery } from "@/features/base/queries/base-query";

export default function BasePage() {
  const { pageId } = useParams<{ pageId: string }>();
  const { data: base } = useBaseQuery(pageId);

  if (!pageId) {
    return (
      <Stack align="center" p="xl">
        <Text c="dimmed">No base ID provided</Text>
      </Stack>
    );
  }

  return (
    <Container
      fluid
      p="md"
      style={{ height: "calc(100vh - 60px)", display: "flex", flexDirection: "column" }}
    >
      {base && (
        <Title order={3} mb="xs">
          {base.icon ? `${base.icon} ` : ""}{base.name}
        </Title>
      )}
      <BaseView pageId={pageId} />
    </Container>
  );
}
