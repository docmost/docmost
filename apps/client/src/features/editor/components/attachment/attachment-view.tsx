import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Text, Paper, ActionIcon, Loader } from "@mantine/core";
import { getFileUrl } from "@/lib/config.ts";
import { IconDownload, IconPaperclip } from "@tabler/icons-react";
import { useHover } from "@mantine/hooks";
import { formatBytes } from "@/lib";
import { useTranslation } from "react-i18next";

export default function AttachmentView(props: NodeViewProps) {
  const { t } = useTranslation();
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
          <Group wrap="nowrap" gap="sm" style={{ minWidth: 0, flex: 1 }}>
            {url ? (
              <IconPaperclip size={20} style={{ flexShrink: 0 }} />
            ) : (
              <Loader size={20} style={{ flexShrink: 0 }} />
            )}

            <Text component="span" size="md" truncate="end" style={{ minWidth: 0 }}>
              {url ? name : t("Uploading {{name}}", { name })}
            </Text>

            <Text component="span" size="sm" c="dimmed" style={{ flexShrink: 0 }}>
              {formatBytes(size)}
            </Text>
          </Group>

          {url && (selected || hovered) && (
            <a href={getFileUrl(url)} target="_blank">
              <ActionIcon variant="default" aria-label="download file">
                <IconDownload size={18} />
              </ActionIcon>
            </a>
          )}
        </Group>
      </Paper>
    </NodeViewWrapper>
  );
}
