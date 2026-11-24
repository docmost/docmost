import api from "@/lib/api-client";
import type { UploadTarget } from "@docmost/editor-ext";
import type { DiagramType, IPageAttachment } from "../types/attachment.types";

export type DiagramDraft = UploadTarget & {
  type: DiagramType;
  draftId: string;
};

export async function readDiagramDraft(
  draft: DiagramDraft,
): Promise<Blob | null> {
  const blob = await api.post<Blob, Blob>("/attachments/diagram-draft", draft, {
    responseType: "blob",
  });
  return blob?.size ? blob.slice(0, blob.size, "image/svg+xml") : null;
}

export async function writeDiagramDraft(draft: DiagramDraft, file: File) {
  const data = new FormData();
  for (const [key, value] of Object.entries(draft)) data.append(key, value);
  data.append("file", file);
  await api.post("/files/upload", data);
}

export async function discardDiagramDraft(draft: DiagramDraft) {
  await api.post("/attachments/discard-diagram-draft", draft);
}

export type DiagramRevision = Pick<
  IPageAttachment,
  "id" | "fileName" | "createdAt" | "creator"
> & { version: number };

export function diagramFileUrl({
  id,
  fileName,
}: Pick<DiagramRevision, "id" | "fileName">) {
  return `/api/files/${id}/${encodeURIComponent(fileName)}`;
}

export async function getDiagramHistory(attachmentId: string, before?: string) {
  const response = await api.post<DiagramRevision[]>(
    "/attachments/diagram-history",
    { attachmentId, before },
  );
  return response.data;
}
