import type { MicrosoftFileItem } from "@docmost/editor-ext";
import type { Editor, JSONContent } from "@tiptap/core";

function mentionParagraph(item: MicrosoftFileItem): JSONContent {
  return {
    type: "paragraph",
    content: [
      {
        type: "integrationMention",
        attrs: { url: item.webUrl, provider: "microsoft_365" },
      },
      { type: "text", text: " " },
    ],
  };
}

export function replaceMicrosoftFileWithMentions(
  editor: Editor,
  pos: number,
  items: MicrosoftFileItem[],
): boolean {
  const node = editor.state.doc.nodeAt(pos);
  if (node?.type.name !== "microsoftFile" || items.length === 0) return false;

  const paragraphs = items.map(mentionParagraph);
  const content: JSONContent =
    paragraphs.length === 1
      ? paragraphs[0]
      : {
          type: "bulletList",
          content: paragraphs.map((paragraph) => ({
            type: "listItem",
            content: [paragraph],
          })),
        };

  return editor
    .chain()
    .insertContentAt({ from: pos, to: pos + node.nodeSize }, content)
    .run();
}
