import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Card, Text } from "@mantine/core";
import { useTranslation } from "react-i18next";
import clsx from "clsx";
import IconDrawio from "@/components/icons/icon-drawio";
import IconExcalidraw from "@/components/icons/icon-excalidraw";
import { TemplateSkeletonKind } from "./template-skeleton-extension";

const kindConfig: Record<
  TemplateSkeletonKind,
  { icon: typeof IconDrawio; label: string }
> = {
  drawio: {
    icon: IconDrawio,
    label: "Draw.io diagram — added when this template is used",
  },
  excalidraw: {
    icon: IconExcalidraw,
    label: "Excalidraw diagram — added when this template is used",
  },
};

export default function TemplateSkeletonView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, selected } = props;
  const kind: TemplateSkeletonKind = node.attrs.kind || "drawio";
  const config = kindConfig[kind] ?? kindConfig.drawio;
  const Icon = config.icon;

  return (
    <NodeViewWrapper data-drag-handle>
      <Card
        radius="md"
        p="md"
        withBorder
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          borderStyle: "dashed",
        }}
        className={clsx(selected ? "ProseMirror-selectednode" : "")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon size={20} />
          <Text component="span" size="sm" c="dimmed">
            {t(config.label)}
          </Text>
        </div>
      </Card>
    </NodeViewWrapper>
  );
}
