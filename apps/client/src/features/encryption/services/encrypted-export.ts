import { generateHTML } from "@tiptap/core";
import { saveAs } from "file-saver";
import { htmlToMarkdown } from "@docmost/editor-ext";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { ExportFormat } from "@/features/page/types/page.types";
import { getEncryptedBlob } from "@/features/encryption/services/encryption-service";
import { decryptBlobToProsemirrorJSON } from "@/features/encryption/services/encrypted-blob";

/**
 * Client-side export for E2E-encrypted pages. The server only holds
 * ciphertext, so the blob is decrypted with the in-memory page DEK and
 * serialized to Markdown/HTML in the browser — mirroring the server's
 * ExportService.exportPage for plaintext pages (title heading prepended,
 * colgroups stripped before markdown conversion).
 */
export async function exportEncryptedPage(opts: {
  pageId: string;
  title: string;
  dek: CryptoKey;
  format: ExportFormat;
}): Promise<void> {
  const { pageId, title, dek, format } = opts;
  const safeTitle = title || "untitled";

  const blob = await getEncryptedBlob(pageId);
  if (!blob.encryptedBlob) {
    throw new Error("Encrypted page has no content");
  }

  const prosemirrorJson = await decryptBlobToProsemirrorJSON(
    dek,
    blob.encryptedBlob,
  );

  const titleNode = {
    type: "heading",
    attrs: { level: 1 },
    content: [{ type: "text", text: safeTitle }],
  };
  prosemirrorJson.content = prosemirrorJson.content ?? [];
  if (title) {
    prosemirrorJson.content.unshift(titleNode);
  }

  const pageHtml = generateHTML(prosemirrorJson, mainExtensions);

  let fileContent: string;
  let extension: string;
  let mimeType: string;

  if (format === ExportFormat.HTML) {
    fileContent = `<!DOCTYPE html>
      <html>
        <head>
         <title>${safeTitle}</title>
        </head>
        <body>${pageHtml}</body>
      </html>`;
    extension = ".html";
    mimeType = "text/html";
  } else if (format === ExportFormat.Markdown) {
    const newPageHtml = pageHtml.replace(
      /<colgroup[^>]*>[\s\S]*?<\/colgroup>/gim,
      "",
    );
    fileContent = htmlToMarkdown(newPageHtml);
    extension = ".md";
    mimeType = "text/markdown";
  } else {
    throw new Error(
      `Export format "${format}" is not supported for encrypted pages`,
    );
  }

  const fileName =
    (safeTitle.replace(/[\\/:*?"<>|]/g, "_").trim() || "untitled") + extension;
  saveAs(new Blob([fileContent], { type: `${mimeType};charset=utf-8` }), fileName);
}
