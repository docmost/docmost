import api from "@/lib/api-client";
import type { UploadTarget } from "@docmost/editor-ext";
import {
  IHtmlBlock,
  IHtmlBlockSaved,
} from "@/ee/html-block/types/html-block.types";

export async function createHtmlBlock(input: {
  target: UploadTarget;
  previousId?: string | null;
  html: string;
}): Promise<IHtmlBlockSaved> {
  const formData = new FormData();
  if ("pageId" in input.target) {
    formData.append("pageId", input.target.pageId);
  } else {
    formData.append("templateId", input.target.templateId);
  }
  if (input.previousId) {
    formData.append("previousId", input.previousId);
  }
  // fields must come before the file or the server ignores them
  formData.append(
    "file",
    new File([input.html], "block.html", { type: "text/html" }),
  );

  const req = await api.post<IHtmlBlockSaved>("/html-blocks/create", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return req.data;
}

export async function getHtmlBlock(htmlBlockId: string): Promise<IHtmlBlock> {
  const req = await api.post<IHtmlBlock>("/html-blocks/info", { htmlBlockId });
  return req.data;
}

export async function getSharedHtmlBlock(input: {
  shareId: string;
  htmlBlockId: string;
}): Promise<IHtmlBlock> {
  const req = await api.post<IHtmlBlock>("/shares/html-block/info", input);
  return req.data;
}

export async function getPublicSpaceHtmlBlock(input: {
  spaceSlug: string;
  htmlBlockId: string;
}): Promise<IHtmlBlock> {
  const req = await api.post<IHtmlBlock>(
    "/public-spaces/html-block/info",
    input,
  );
  return req.data;
}

export async function copyHtmlBlock(input: {
  htmlBlockId: string;
  target: UploadTarget;
}): Promise<{ id: string }> {
  const req = await api.post<{ id: string }>("/html-blocks/copy", {
    htmlBlockId: input.htmlBlockId,
    ...input.target,
  });
  return req.data;
}
