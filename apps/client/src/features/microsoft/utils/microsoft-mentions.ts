import type { MicrosoftFileItem } from "@docmost/editor-ext";
import type { Editor, JSONContent } from "@tiptap/core";

export function microsoftFileMentions(
  items: MicrosoftFileItem[],
): JSONContent[] {
  return items.flatMap((item) => [
    {
      type: "integrationMention",
      attrs: { url: item.webUrl, provider: "microsoft_365" },
    },
    { type: "text", text: " " },
  ]);
}

export function replaceMicrosoftFileWithMentions(
  editor: Editor,
  pos: number,
  items: MicrosoftFileItem[],
): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (node?.type.name !== "microsoftFile" || items.length === 0) return false;

  return editor
    .chain()
    .insertContentAt(
      { from: pos, to: pos + node.nodeSize },
      { type: "paragraph", content: microsoftFileMentions(items) },
    )
    .run();
}
