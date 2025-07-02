import { Editor, findParentNode } from "@tiptap/core";
import { Node as PMNode } from "prosemirror-model";

export const newColumnContent = {
  type: "column",
  content: [
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "New Column",
        },
      ],
    },
  ],
};

export function newColumnLayoutContent(...texts: string[]) {
  return {
    type: "columnContainer",
    content: texts.map((text) => ({
      type: "column",
      content: [
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text,
            },
          ],
        },
      ],
    })),
  };
}

export function findParentNodeByType(editor: Editor, type: string) {
  const { selection } = editor.state;
  const predicate = (node: PMNode) => node.type.name === type;
  const parent = findParentNode(predicate)(selection);

  return parent;
}
