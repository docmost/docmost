import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { useState } from "react";
import { notifications } from "@mantine/notifications";
import { v7 as uuid7 } from "uuid";
import { getFileUrl } from "@/lib/config";
import { getEditorUploadTarget } from "@/features/editor/utils/upload-target";
import type { DiagramType } from "@/features/attachments/types/attachment.types";
import {
  readDiagramDraft,
  type DiagramDraft,
} from "@/features/attachments/services/diagram-service";
import { diagramAttachmentName } from "./diagram-name";
import { diagramZoom, drawingSize } from "./diagram-size";
import { notifyDiagramSaveError } from "./diagram-save-error";
import i18n from "@/i18n";

export interface DiagramSession {
  draft: DiagramDraft;
  fileName: string;
  previousAttachmentId?: string;
  initial: Blob | null;
  recovered: boolean;
  zoom: number | null;
  update: (attrs?: Record<string, unknown>) => void;
}

export async function fetchDiagram(src: string) {
  const response = await fetch(getFileUrl(src), {
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not load diagram");
  return response.blob();
}

export function diagramNodeUpdater(
  editor: Editor,
  type: DiagramType,
  draftId: string,
  getPos: () => number | undefined,
) {
  return (attrs?: Record<string, unknown>) => {
    if (editor.isDestroyed || !editor.isEditable)
      throw new Error(
        i18n.t(
          "This diagram changed while you were editing. Reopen it to continue.",
        ),
      );
    const matches = (n?: PMNode | null) =>
      n?.type.name === type &&
      (n.attrs.attachmentId || n.attrs.draftId) === draftId;
    let pos = getPos();
    if (
      pos == null ||
      pos > editor.state.doc.content.size ||
      !matches(editor.state.doc.nodeAt(pos))
    ) {
      const positions: number[] = [];
      editor.state.doc.descendants((n, at) => {
        if (matches(n)) positions.push(at);
      });
      pos = positions.length === 1 ? positions[0] : undefined;
    }
    if (pos == null) {
      throw new Error(
        i18n.t(
          "This diagram changed while you were editing. Reopen it to continue.",
        ),
      );
    }
    if (attrs) {
      const tr = editor.state.tr;
      for (const [key, value] of Object.entries(attrs))
        tr.setNodeAttribute(pos, key, value);
      editor.view.dispatch(tr);
    }
  };
}

export function useDiagramEditor(editor: Editor, type: DiagramType) {
  const [session, setSession] = useState<DiagramSession | null>(null);
  const [loading, setLoading] = useState(false);
  const close = () => setSession(null);

  async function open(
    node: PMNode,
    getPos: () => number | undefined,
    name?: string,
  ) {
    const target = getEditorUploadTarget(editor);
    if (!target || !editor.isEditable) return;
    setLoading(true);
    try {
      const previousAttachmentId = node.attrs.attachmentId || undefined;
      const savedDraftId = node.attrs.draftId || previousAttachmentId;
      const draftId = savedDraftId || uuid7();
      const draft = { ...target, type, draftId };
      const fileName =
        name || diagramAttachmentName(node.attrs) || `diagram.${type}.svg`;
      const position = getPos();
      if (!savedDraftId || (name && name !== node.attrs.title)) {
        if (position == null) return;
        const tr = editor.state.tr.setNodeAttribute(
          position,
          "draftId",
          draftId,
        );
        if (name) tr.setNodeAttribute(position, "title", name);
        editor.view.dispatch(tr);
      }

      const update = diagramNodeUpdater(
        editor,
        type,
        previousAttachmentId || draftId,
        getPos,
      );
      const [published, recovered] = await Promise.all([
        node.attrs.src ? fetchDiagram(node.attrs.src) : null,
        savedDraftId ? readDiagramDraft(draft) : null,
      ]);
      if (recovered)
        notifications.show({
          message: i18n.t("Your unpublished diagram draft was recovered."),
        });
      setSession({
        draft,
        fileName,
        previousAttachmentId,
        update,
        recovered: !!recovered,
        initial: recovered || published,
        zoom:
          published && node.attrs.width
            ? diagramZoom(node.attrs.width, drawingSize(await published.text()))
            : null,
      });
    } catch (err) {
      notifyDiagramSaveError(err);
    } finally {
      setLoading(false);
    }
  }

  function openSelected() {
    const pos = editor.state.selection.from;
    const node = editor.state.doc.nodeAt(pos);
    if (node?.type.name === type) void open(node, () => pos);
  }

  return { open, openSelected, loading, session, close };
}
