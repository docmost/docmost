import React, { useMemo } from "react";
import { Paper, Text, Group, Stack, Loader, Box } from "@mantine/core";
import { IconSparkles, IconFileText } from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { IAiSearchResponse } from "../services/ai-search-service";
import { buildPageUrl } from "@/features/page/page.utils";

interface AiSearchResultProps {
  result: IAiSearchResponse;
  isLoading?: boolean;
}

export function AiSearchResult({ result, isLoading }: AiSearchResultProps) {
  // Deduplicate sources by pageId, keeping the one with highest similarity
  const deduplicatedSources = useMemo(() => {
    if (!result?.sources) return [];
    
    const pageMap = new Map();
    result.sources.forEach((source) => {
      const existing = pageMap.get(source.pageId);
      if (!existing || source.similarity > existing.similarity) {
        pageMap.set(source.pageId, source);
      }
    });
    
    return Array.from(pageMap.values());
  }, [result?.sources]);

  if (isLoading) {
    return (
      <Paper p="md" radius="md" withBorder>
        <Group>
          <Loader size="sm" />
          <Text size="sm">AI is thinking...</Text>
        </Group>
      </Paper>
    );
  }

  if (!result) {
    return null;
  }

  return (
    <Stack gap="md" p="md">
      <Paper p="md" radius="md" withBorder>
        <Group gap="xs" mb="sm">
          <IconSparkles size={20} color="var(--mantine-color-blue-6)" />
          <Text fw={600} size="sm">AI Answer</Text>
        </Group>
        <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
          {result.answer}
        </Text>
      </Paper>

      {deduplicatedSources.length > 0 && (
        <Stack gap="xs">
          <Text size="xs" fw={600} c="dimmed">
            Sources
          </Text>
          {deduplicatedSources.map((source) => (
            <Box
              key={source.pageId}
              component={Link}
              to={buildPageUrl(source.spaceSlug, source.slugId, source.title)}
              style={{ 
                textDecoration: "none",
                color: "inherit",
                display: "block"
              }}
            >
              <Paper
                p="xs"
                radius="sm"
                withBorder
                style={{ cursor: "pointer" }}
              >
                <Group gap="xs">
                  <IconFileText size={16} />
                  <Text size="sm" truncate>
                    {source.title}
                  </Text>
                </Group>
              </Paper>
            </Box>
          ))}
        </Stack>
      )}
    </Stack>
  );
}