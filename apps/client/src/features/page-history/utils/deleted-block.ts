import { DOMSerializer, Node } from "@tiptap/pm/model";

// A deleted block drawn in its own shape, so a list item stays a list item, with its text struck through.
export function deletedBlockDOM(
  node: Node,
  specialNodeTypes: ReadonlySet<string>,
): HTMLElement {
  const schema = node.type.schema;
  const base = DOMSerializer.fromSchema(schema);

  // a special node inside the block looks like any other deleted special node
  const nodes = { ...base.nodes };
  for (const name of specialNodeTypes) {
    const toDOM = base.nodes[name];
    if (toDOM && schema.nodes[name].isBlock) {
      nodes[name] = (special) => [
        "div",
        { class: "history-diff-node-deleted" },
        toDOM(special),
      ];
    }
  }

  const dom = new DOMSerializer(nodes, base.marks).serializeNode(
    node,
  ) as HTMLElement;
  dom.classList.add("history-diff-block-deleted");

  const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT);
  const texts: globalThis.Node[] = [];
  while (walker.nextNode()) {
    const text = walker.currentNode;
    if (!text.parentElement.closest(".history-diff-node-deleted")) {
      texts.push(text);
    }
  }

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
