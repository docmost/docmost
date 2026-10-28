import type { Editor } from "@tiptap/core";
import { notifications } from "@mantine/notifications";
import i18n from "@/i18n.ts";
import { resolveMicrosoftUrl } from "../services/microsoft-service";
import { m365ErrorCode } from "../hooks/use-m365-request";

export async function convertCardToMicrosoftFile(editor: Editor, pos: number): Promise<boolean> {
  const node = editor.state.doc.nodeAt(pos);
  if (!node || node.type.name !== "integrationCard" || typeof node.attrs.url !== "string") {
    return false;
  }
  const url = node.attrs.url as string;
  try {
    const resolved = await resolveMicrosoftUrl({ url });
    if (resolved.kind !== "file") {
      notifications.show({ message: i18n.t("Only files can be embedded"), color: "red" });
      return false;
    }
    const current = editor.state.doc.nodeAt(pos);
    if (!current || current.type.name !== "integrationCard" || current.attrs.url !== url) {
      return false;
    }
    return editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .insertContentAt(
        { from: pos, to: pos + current.nodeSize },
        {
          type: "microsoftFile",
          attrs: {
            items: [
              {
                driveId: resolved.driveId,
                itemId: resolved.itemId,
                webUrl: resolved.webUrl,
                name: resolved.name,
              },
            ],
            display: "embed",
          },
        },
      )
      .run();
  } catch (error) {
    notifications.show({
      message:
        m365ErrorCode(error) === "needs_connection"
          ? i18n.t("Connect to Microsoft 365 to embed this file")
          : i18n.t("Could not embed this file"),
      color: "red",
    });
    return false;
  }
}
