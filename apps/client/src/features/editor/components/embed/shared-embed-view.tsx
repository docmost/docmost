import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { useMemo } from "react";
import { ActionIcon, AspectRatio, Card, Text } from "@mantine/core";
import { IconEdit } from "@tabler/icons-react";
import { getEmbedUrlAndProvider } from "@/features/editor/components/embed/providers.ts";
import { useTranslation } from "react-i18next";

export default function SharedEmbedView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node } = props;
  const { src } = node.attrs;

  const embedUrl = useMemo(() => {
    if (src) {
      return getEmbedUrlAndProvider(src).embedUrl;
    }
    return null;
  }, [src]);

  return (
    <NodeViewWrapper>
      {embedUrl ? (
        <>
          <AspectRatio ratio={16 / 9}>
            <iframe
              src={embedUrl}
              allow="encrypted-media"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              allowFullScreen
              frameBorder="0"
            ></iframe>
          </AspectRatio>
        </>
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
