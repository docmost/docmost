import { useRef } from "react";
import { Text } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useTranslation } from "react-i18next";
import { uploadFile } from "@/features/page/services/page-service";
import {
  discardDiagramDraft,
  writeDiagramDraft,
} from "@/features/attachments/services/diagram-service";
import { svgStringToFile } from "@/lib/utils";
import { useDiagramSave } from "./use-diagram-save";
import type { DiagramSession } from "./use-diagram-editor";
import { diagramSizeAt, drawingSize } from "./diagram-size";
import { notifyDiagramSaveError } from "./diagram-save-error";

export type DiagramEditorProps = {
  session: DiagramSession;
  onClose: () => void;
};
type ExportSvg = () => Promise<string> | string;

export function useDiagramDraft({ session, onClose }: DiagramEditorProps) {
  const { t } = useTranslation();
  const queue = useDiagramSave();
  const generation = useRef(session.recovered ? 1 : 0);
  const checkpoint = useRef(generation.current);
  const closed = useRef(false);
  const hasDraft = useRef(session.recovered);
  const { type, draftId, ...target } = session.draft;

  const markChanged = () => {
    generation.current++;
  };
  const pending = () =>
    !closed.current &&
    generation.current > checkpoint.current &&
    !queue.isSavingRef.current;

  const autosave = (exportSvg: ExportSvg) => {
    if (!pending()) return;
    const version = generation.current;
    void queue
      .autosave(async () => {
        await writeDiagramDraft(
          session.draft,
          await svgStringToFile(await exportSvg(), session.fileName),
        );
        hasDraft.current = true;
        checkpoint.current = version;
      })
      .catch(notifyDiagramSaveError);
  };

  const publish = (exportSvg: ExportSvg) => {
    if (closed.current) return;
    closed.current = true;
    void queue
      .save(async () => {
        if (generation.current || !session.previousAttachmentId) {
          const version = generation.current;
          const svg = await exportSvg();
          const file = await svgStringToFile(svg, session.fileName);
          try {
            session.update();
            const attachment = await uploadFile(file, target, {
              type,
              previousAttachmentId: session.previousAttachmentId,
            });
            session.update({
              src: `/api/files/${attachment.id}/${encodeURIComponent(attachment.fileName)}`,
              title: attachment.fileName,
              size: attachment.fileSize,
              attachmentId: attachment.id,
              draftId,
              ...diagramSizeAt(session.zoom, drawingSize(svg)),
            });
          } catch (error) {
            if (!hasDraft.current || version !== checkpoint.current) {
              await writeDiagramDraft(session.draft, file)
                .then(() => {
                  hasDraft.current = true;
                  checkpoint.current = version;
                })
                .catch(() => undefined);
            }
            throw error;
          }
        }
        if (hasDraft.current)
          void discardDiagramDraft(session.draft).catch(notifyDiagramSaveError);
        onClose();
      })
      .catch((error) => {
        closed.current = false;
        notifyDiagramSaveError(error);
      });
  };

  const requestClose = () => {
    if (closed.current) return;
    if (!generation.current) {
      closed.current = true;
      onClose();
      return;
    }
    modals.openConfirmModal({
      title: t("Unsaved changes"),
      children: (
        <Text size="sm">
          {t("You have unsaved changes that will be lost.")}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Discard"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => {
        closed.current = true;
        void queue
          .save(async () => {
            if (hasDraft.current) await discardDiagramDraft(session.draft);
            onClose();
          })
          .catch((error) => {
            closed.current = false;
            notifyDiagramSaveError(error);
          });
      },
    });
  };

  return {
    isSaving: queue.isSaving,
    markChanged,
    pending,
    autosave,
    publish,
    requestClose,
  };
}
