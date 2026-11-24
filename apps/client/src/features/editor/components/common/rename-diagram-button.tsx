import { ActionIcon, Tooltip } from "@mantine/core";
import { IconCursorText } from "@tabler/icons-react";
import type { Editor } from "@tiptap/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DiagramType } from "@/features/attachments/types/attachment.types";
import { canEditDiagram } from "./diagram-editable";
import { diagramAttachmentName } from "./diagram-name";
import { DiagramNameDialog } from "./diagram-name-dialog";

export function RenameDiagramButton({
  editor,
  type,
}: {
  editor: Editor;
  type: DiagramType;
}) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<{
    attachmentId: string;
    fileName?: string;
  }>();
  if (!editor.isEditable) return null;
  const open = () => {
    if (!canEditDiagram(editor)) return;
    const attrs = editor.getAttributes(type);
    if (attrs.attachmentId) {
      setTarget({
        attachmentId: attrs.attachmentId,
        fileName: diagramAttachmentName(attrs),
      });
    }
  };
  const close = () => setTarget(undefined);
  return (
    <>
      <Tooltip position="top" label={t("Rename diagram")} withinPortal={false}>
        <ActionIcon
          onClick={open}
          size="lg"
          aria-label={t("Rename diagram")}
          variant="subtle"
        >
          <IconCursorText size={18} />
        </ActionIcon>
      </Tooltip>
      {target && (
        <DiagramNameDialog
          editor={editor}
          type={type}
          {...target}
          onClose={close}
          onAccept={close}
        />
      )}
    </>
  );
}
