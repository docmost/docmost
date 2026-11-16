import { Editor } from "@tiptap/core";

export type HeadingLink = {
  label: string;
  level: number;
  element: HTMLElement;
  position: number;
};

export const recalculateLinks = (editor: Editor) => {
  const nodes: HTMLElement[] = [];
  const links: HeadingLink[] = [];

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== "heading") return;

    const label = node.textContent;
    const level = Number(node.attrs.level);
    const element = editor.view.nodeDOM(pos) as HTMLElement | null;
    if (label.length && level <= 6 && element) {
      links.push({ label, level, element, position: pos + 1 });
      nodes.push(element);
    }
    return false;
  });

  return { links, nodes };
};
