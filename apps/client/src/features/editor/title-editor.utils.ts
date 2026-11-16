import { Editor } from "@tiptap/core";

export function splitTitleIntoPage(
  titleEditor: Editor,
  pageEditor: Editor,
): boolean {
  const { $from } = titleEditor.state.selection;
  const titleText = titleEditor.getText();

  // Get the text offset within the heading node (not document position)
  const textOffset = $from.parentOffset;

  const textAfterCursor = titleText.slice(textOffset);

  // Don't add to history so undo in page editor won't remove this split
  const inserted = pageEditor
    .chain()
    .command(({ tr }) => {
      tr.setMeta("addToHistory", false);
      return true;
    })
    .insertContentAt(0, {
      type: "paragraph",
      content: textAfterCursor
        ? [{ type: "text", text: textAfterCursor }]
        : undefined,
    })
    .focus("start")
    .run();

  // Delete text after cursor from title (this will be in undo history)
  if (inserted && textAfterCursor) {
    const endPos = titleEditor.state.doc.content.size;
    titleEditor.commands.deleteRange({ from: $from.pos, to: endPos });
  }

  return inserted;
}
