import { Container, Text, Box } from "@mantine/core";
import { Helmet } from "react-helmet-async";
import { getAppName } from "@/lib/config.ts";

export default function MyPagesHome() {
  return (
    <>
      <Helmet>
        <title>Home - {getAppName()}</title>
      </Helmet>
      <Container size="800" pt="xl">
        <Box>
          <Text size="xl" color="dimmed">
            Select a page from the sidebar to get started
          </Text>
        </Box>
      </Container>
    </>
  );
}
