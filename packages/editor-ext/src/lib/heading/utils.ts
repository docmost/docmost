import { Node as ProseMirrorNode } from "prosemirror-model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import slugify from "@sindresorhus/slugify";

const textToSlug = (text: string): string => {
  return slugify(text?.substring(0, 20));
};

function buildAnchorId(node: ProseMirrorNode): string {
  const text = node.textContent;
  const nodeId = node.attrs.nodeId;

  if (!text) return "";

  if (nodeId) {
    const slug = textToSlug(text);
    return slug ? `${slug}-${nodeId}` : nodeId;
  }

  return textToSlug(text);
}

function createAnchorLink(id: string): HTMLElement {
  const wrapper = document.createElement("span");
  wrapper.className = "heading-anchor-wrapper";

  const button = document.createElement("button");
  button.className = "heading-anchor-button";
  button.setAttribute("aria-label", "Copy link to this section");
  button.setAttribute("contenteditable", "false");
  button.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <path d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z"/>
    </svg>
  `;

  button.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();

    const url = new URL(window.location.href);
    url.hash = id;

    navigator.clipboard.writeText(url.toString()).then(() => {
      const originalHTML = button.innerHTML;
      button.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
        </svg>
      `;
      button.classList.add("copied");

      setTimeout(() => {
        button.innerHTML = originalHTML;
        button.classList.remove("copied");
      }, 2000);
    });
  });

  wrapper.appendChild(button);
  return wrapper;
}

export function buildAnchorDecorations(doc: ProseMirrorNode): DecorationSet {
  const decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (node.type.name !== "heading" || !node.textContent) {
      return;
    }

    const anchorId = buildAnchorId(node);
    if (!anchorId) return;

    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        id: anchorId,
        class: "has-anchor",
        "data-anchor-id": anchorId,
      }),
    );

    if (node.content.size > 0) {
      const lastChildEnd = pos + 1 + node.content.size;
      decorations.push(
        Decoration.widget(lastChildEnd, createAnchorLink(anchorId), {
          side: 0,
          key: `anchor-${anchorId}`,
        }),
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}
