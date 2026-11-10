import type { Editor, JSONContent } from "@tiptap/core";
import { notifications } from "@mantine/notifications";
import i18n from "@/i18n.ts";
import { getMicrosoftLibraryRoot, resolveMicrosoftUrl } from "../services/microsoft-service";
import { m365ErrorCode } from "../hooks/use-m365-request";
import type { M365Resolved } from "../types/microsoft.types";

export function isEmbeddableMicrosoftKind(
  metadata: { kind?: string; isLibrary?: boolean } | null | undefined,
): boolean {
  return (
    metadata?.kind === "file" ||
    metadata?.kind === "folder" ||
    (metadata?.kind === "list" && metadata.isLibrary === true)
  );
}

async function toEmbedContent(resolved: M365Resolved): Promise<JSONContent | null> {
  if (resolved.kind === "file") {
    const { driveId, itemId, webUrl, name } = resolved;
    return { type: "microsoftFile", attrs: { items: [{ driveId, itemId, webUrl, name }] } };
  }
  if (resolved.kind === "folder") {
    const { driveId, itemId, webUrl, name } = resolved;
    return { type: "microsoftFolder", attrs: { driveId, itemId, webUrl, name } };
  }
  if (resolved.kind === "list" && resolved.isLibrary) {
    const root = await getMicrosoftLibraryRoot({
      siteId: resolved.siteId,
      listId: resolved.listId,
    });
    return {
      type: "microsoftFolder",
      attrs: {
        driveId: root.driveId,
        itemId: root.itemId,
        webUrl: root.webUrl || resolved.webUrl,
        name: resolved.name,
      },
    };
  }
  return null;
}

export async function convertCardToMicrosoftEmbed(editor: Editor, pos: number): Promise<boolean> {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "integrationCard" || typeof node.attrs.url !== "string") {
    return false;
  }
  const url = node.attrs.url as string;
  try {
    const resolved = await resolveMicrosoftUrl({ url });
    const embed = await toEmbedContent(resolved);
    if (!embed) {
      notifications.show({
        message: i18n.t("Only files, folders and document libraries can be embedded"),
        color: "red",
      });
      return false;
    }
    const current = editor.state.doc.nodeAt(pos);
    if (!current || current.type.name !== "integrationCard" || current.attrs.url !== url) {
      return false;
    }
    return editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .insertContentAt({ from: pos, to: pos + current.nodeSize }, embed)
      .run();
  } catch (error) {
    notifications.show({
      message:
        m365ErrorCode(error) === "needs_connection"
          ? i18n.t("Connect to Microsoft 365 to embed this link")
          : i18n.t("Could not embed this link"),
      color: "red",
    });
    return false;
  }
}
