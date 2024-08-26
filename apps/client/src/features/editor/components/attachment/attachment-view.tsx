import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Text, Paper, ActionIcon } from "@mantine/core";
import { getFileUrl } from "@/lib/config.ts";
import { IconDownload, IconPaperclip } from "@tabler/icons-react";
import { useHover } from "@mantine/hooks";
import { formatBytes } from "@/lib";

export default function AttachmentView(props: NodeViewProps) {
  const { node, selected } = props;
  const { url, name, size } = node.attrs;
  const { hovered, ref } = useHover();

  return (
    <NodeViewWrapper>
      <Paper withBorder p="4px" ref={ref} data-drag-handle>
        <Group
          justify="space-between"
          gap="xl"
          style={{ cursor: "pointer" }}
          wrap="nowrap"
          h={25}
        >
          <Group justify="space-between" wrap="nowrap">
            <IconPaperclip size={20} />

            <Text component="span" size="md" truncate="end">
              {name}
            </Text>

            <Text component="span" size="sm" c="dimmed" inline>
              {formatBytes(size)}
            </Text>
          </Group>

          {selected || hovered ? (
            <a href={getFileUrl(url)} target="_blank">
              <ActionIcon variant="default" aria-label="download file">
                <IconDownload size={18} />
              </ActionIcon>
            </a>
          ) : (
            ""
          )}
        </Group>
      </Paper>
    </NodeViewWrapper>
  );
}
