import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { Box, Text } from '@mantine/core';
import { BaseTable } from '@/features/base/components/base-table';
import { useBaseQuery } from '@/features/base/queries/base-query';

export function BaseEmbedView({ node }: NodeViewProps) {
  const pageId = node.attrs.pageId as string | null;

  if (!pageId) {
    return (
      <NodeViewWrapper>
        <Box p="md">
          <Text c="red">Invalid base embed (missing page id)</Text>
        </Box>
      </NodeViewWrapper>
    );
  }

  const { isLoading, isError } = useBaseQuery(pageId);

  if (isLoading) {
    return (
      <NodeViewWrapper>
        <Box p="md">
          <Text c="dimmed">Loading...</Text>
        </Box>
      </NodeViewWrapper>
    );
  }

  if (isError) {
    return (
      <NodeViewWrapper>
        <Box p="md" bg="gray.0" style={{ borderRadius: 8 }}>
          <Text c="dimmed">You don't have access to this database.</Text>
        </Box>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper>
      <Box style={{ minHeight: 200 }}>
        <BaseTable pageId={pageId} />
      </Box>
    </NodeViewWrapper>
  );
}
