import { DOMSerializer, Node } from "@tiptap/pm/model";

// A deleted block drawn in its own shape, so a list item stays a list item, with its text struck through.
export function deletedBlockDOM(node: Node): HTMLElement {
  const dom = DOMSerializer.fromSchema(node.type.schema).serializeNode(
    node,
  ) as HTMLElement;
  dom.classList.add("history-diff-block-deleted");

  const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT);
  const texts: globalThis.Node[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode);

  for (const text of texts) {
    const span = document.createElement("span");
    span.className = "history-diff-deleted";
    text.parentNode.replaceChild(span, text);
    span.appendChild(text);
  }

  // the checkbox of a removed task is not there to be ticked
  dom.querySelectorAll("input").forEach((input) => {
    input.disabled = true;
  });

  return dom;
}
