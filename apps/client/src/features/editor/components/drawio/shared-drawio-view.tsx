import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ActionIcon, Card, Image, Text } from "@mantine/core";
import { getSharedFileUrl } from "@/lib/config.ts";
import clsx from "clsx";
import { IconEdit } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";

export default function SharedDrawioView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, selected } = props;
  const { src, title, width } = node.attrs;

  return (
    <NodeViewWrapper>
      {src ? (
        <div style={{ position: "relative" }}>
          <Image
            radius="md"
            fit="contain"
            w={width}
            src={getSharedFileUrl(src)}
            alt={title}
            className={clsx(
              selected ? "ProseMirror-selectednode" : "",
              "alignCenter",
            )}
          />
        </div>
      ) : (
        <Card
          radius="md"
          p="xs"
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          withBorder
        >
          <div style={{ display: "flex", alignItems: "center" }}>
            <ActionIcon variant="transparent" color="gray">
              <IconEdit size={18} />
            </ActionIcon>

            <Text component="span" size="lg" c="dimmed">
              {t("Not available")}
            </Text>
          </div>
        </Card>
      )}
    </NodeViewWrapper>
  );
}
