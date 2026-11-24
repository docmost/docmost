import { ActionIcon, Card, Group, Text } from "@mantine/core";
import { IconEdit } from "@tabler/icons-react";
import type { NodeViewProps } from "@tiptap/react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DiagramType } from "@/features/attachments/types/attachment.types";
import { canEditDiagram } from "./diagram-editable";
import { DiagramNameDialog } from "./diagram-name-dialog";

type Props = Pick<NodeViewProps, "editor" | "node" | "selected"> & {
  type: DiagramType;
  onOpen: (fileName: string) => void;
};

export function DiagramPlaceholder({
  editor,
  node,
  selected,
  type,
  onOpen,
}: Props) {
  const { t } = useTranslation();
  const [naming, setNaming] = useState(false);
  const start = () => {
    if (canEditDiagram(editor)) setNaming(true);
  };
  return (
    <>
      <Card
        radius="md"
        p="xs"
        withBorder
        onClick={(event) => event.detail === 2 && start()}
        className={selected ? "ProseMirror-selectednode" : undefined}
      >
        <Group justify="center" gap={0}>
          <ActionIcon
            variant="transparent"
            color="gray"
            disabled={!editor.isEditable}
            onClick={start}
            aria-label={t("Edit diagram")}
          >
            <IconEdit size={18} />
          </ActionIcon>
          <Text component="span" size="lg" c="dimmed">
            {type === "drawio"
              ? t("Double-click to edit Draw.io diagram")
              : t("Double-click to edit Excalidraw diagram")}
          </Text>
        </Group>
      </Card>
      {naming && (
        <DiagramNameDialog
          editor={editor}
          type={type}
          fileName={node.attrs.title}
          attachmentId={node.attrs.attachmentId}
          creating
          onClose={() => setNaming(false)}
          onAccept={(fileName) => {
            setNaming(false);
            onOpen(fileName);
          }}
        />
      )}
    </>
  );
}
