import { useState } from "react";
import type { Editor } from "@tiptap/core";
import { ActionIcon, Tooltip } from "@mantine/core";
import { IconHistory } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import type { DiagramType } from "@/features/attachments/types/attachment.types";
import {
  diagramFileUrl,
  type DiagramRevision,
} from "@/features/attachments/services/diagram-service";
import { uploadFile } from "@/features/page/services/page-service";
import { getEditorUploadTarget } from "@/features/editor/utils/upload-target";
import { diagramNodeUpdater, fetchDiagram } from "./use-diagram-editor";
import { diagramSizeAt, diagramZoom, drawingSize } from "./diagram-size";
import { notifyDiagramSaveError } from "./diagram-save-error";
import { DiagramHistoryModal } from "./diagram-history-modal";

export function DiagramHistoryButton({
  editor,
  type,
}: {
  editor: Editor;
  type: DiagramType;
}) {
  const { t } = useTranslation();
  const [target, setTarget] = useState<{
    id: string;
    pos: number;
    src?: string;
    width?: number;
  }>();
  const [restoring, setRestoring] = useState(false);

  function close() {
    setTarget(undefined);
    if (!editor.isDestroyed) {
      editor.commands.focus(undefined, { scrollIntoView: false });
    }
  }

  async function restore(selected: DiagramRevision) {
    const scope = getEditorUploadTarget(editor);
    if (!target || !scope || restoring || selected.id === target.id) return;
    const update = diagramNodeUpdater(
      editor,
      type,
      target.id,
      () => target.pos,
    );
    setRestoring(true);
    try {
      update();
      const [blob, current] = await Promise.all([
        fetchDiagram(diagramFileUrl(selected)),
        target.width && target.src ? fetchDiagram(target.src) : null,
      ]);
      const zoom = current
        ? diagramZoom(target.width, drawingSize(await current.text()))
        : null;
      const file = new File([blob], selected.fileName, {
        type: "image/svg+xml",
      });
      const saved = await uploadFile(file, scope, {
        type,
        previousAttachmentId: target.id,
      });
      update({
        src: diagramFileUrl(saved),
        title: saved.fileName,
        size: saved.fileSize,
        attachmentId: saved.id,
        ...(zoom != null &&
          diagramSizeAt(zoom, drawingSize(await blob.text()))),
      });
      close();
    } catch (error) {
      notifyDiagramSaveError(error);
    } finally {
      setRestoring(false);
    }
  }

  return (
    <>
      <Tooltip label={t("Diagram history")} withinPortal={false}>
        <ActionIcon
          aria-label={t("Diagram history")}
          aria-haspopup="dialog"
          size="lg"
          variant="subtle"
          onClick={() => {
            const pos = editor.state.selection.from;
            const attrs = editor.state.doc.nodeAt(pos)?.attrs;
            const id = attrs?.attachmentId;
            if (!id) return;
            setTarget({ id, pos, width: attrs.width, src: attrs.src });
          }}
        >
          <IconHistory size={18} />
        </ActionIcon>
      </Tooltip>
      {target && (
        <DiagramHistoryModal
          attachmentId={target.id}
          type={type}
          restoring={restoring}
          onRestore={restore}
          onClose={close}
        />
      )}
    </>
  );
}
