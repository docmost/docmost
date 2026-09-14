import { Document } from "@tiptap/extension-document";

// With `block+ footnotes?`, ProseMirror's defaultType after the first block is
// `footnotes` (not a textblock), so GapCursor.valid() rejects every top-level gap.
export const TiptapDocument = Document.extend({
  content: "block+ footnotes?",
  allowGapCursor: true,
});
