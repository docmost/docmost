import { Button, Group, Modal, TextInput } from "@mantine/core";
import type { Editor } from "@tiptap/core";
import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { renameDiagramAttachment } from "@/features/attachments/services/attachment-service";
import type {
  DiagramType,
  IAttachment,
} from "@/features/attachments/types/attachment.types";

import {
  diagramName,
  pageDiagramNames,
  suggestDiagramName,
} from "./diagram-name";

function updateDiagramReferences(
  editor: Editor,
  type: DiagramType,
  attachment: IAttachment,
) {
  if (editor.isDestroyed) return;
  const tr = editor.state.tr;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== type || node.attrs.attachmentId !== attachment.id)
      return;
    tr.setNodeAttribute(pos, "title", attachment.fileName);
    if (node.attrs.src) {
      const src = `/api/files/${attachment.id}/${encodeURIComponent(attachment.fileName)}?t=${new Date(attachment.updatedAt).getTime()}`;
      tr.setNodeAttribute(pos, "src", src);
    }
  });
  if (tr.docChanged) editor.view.dispatch(tr);
}

type DiagramNameDialogProps = {
  editor: Editor;
  type: DiagramType;
  fileName?: string;
  attachmentId?: string;
  creating?: boolean;
  onAccept: (fileName: string) => void;
  onClose: () => void;
};

export function DiagramNameDialog({
  editor,
  type,
  fileName,
  attachmentId,
  creating,
  onAccept,
  onClose,
}: DiagramNameDialogProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(() =>
    fileName
      ? diagramName(fileName)
      : suggestDiagramName(
          editor,
          type === "drawio" ? t("Drawio diagram") : t("Excalidraw diagram"),
        ),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const name = diagramName(value.trim());
    const currentName = fileName && diagramName(fileName);
    if (fileName?.toLowerCase().endsWith(".svg") && name === currentName) {
      onAccept(fileName);
      return;
    }
    const nextFileName = `${name}.${type}.svg`;
    if (
      !name ||
      /^\.+$|[\\/:*?"<>|]/.test(name) ||
      new TextEncoder().encode(nextFileName).length > 255
    ) {
      setError(t("Enter a valid file name."));
      return;
    }
    if (
      name !== currentName &&
      pageDiagramNames(editor, attachmentId).has(name.toLowerCase())
    ) {
      setError(t("A diagram on this page already uses this name."));
      return;
    }
    if (!attachmentId) {
      onAccept(nextFileName);
      return;
    }
    setSaving(true);
    try {
      const attachment = await renameDiagramAttachment(attachmentId, name);
      updateDiagramReferences(editor, type, attachment);
      onAccept(attachment.fileName);
    } catch {
      setError(t("Failed to rename diagram"));
      setSaving(false);
    }
  };

  return (
    <Modal
      opened
      onClose={saving ? () => {} : onClose}
      title={creating ? t("Diagram name") : t("Rename diagram")}
      size="sm"
      closeButtonProps={{ "aria-label": t("Close") }}
      centered
    >
      <form onSubmit={submit}>
        <TextInput
          label={t("Name")}
          value={value}
          error={error}
          data-autofocus
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) => {
            setValue(event.currentTarget.value);
            setError("");
          }}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose} disabled={saving}>
            {t("Cancel")}
          </Button>
          <Button type="submit" loading={saving} disabled={!value.trim()}>
            {creating ? t("Continue") : t("Rename")}
          </Button>
        </Group>
      </form>
    </Modal>
  );
}
