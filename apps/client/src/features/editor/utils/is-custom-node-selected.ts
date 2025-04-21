import { Editor } from "@tiptap/react";
import TiptapLink from "@tiptap/extension-link";
import { CodeBlock } from "@tiptap/extension-code-block";

export const isCustomNodeSelected = (editor: Editor, node: HTMLElement) => {
  const customNodes = [CodeBlock.name, TiptapLink.name];

  return customNodes.some((type) => editor.isActive(type));
};

export default isCustomNodeSelected;
