import type { Editor } from "@tiptap/core";
import { DOMSerializer, type Node as PMNode } from "@tiptap/pm/model";

export function copyNodeToClipboard(
  editor: Editor,
  node: PMNode,
): Promise<void> {
  const serializer = DOMSerializer.fromSchema(editor.state.schema);
  const wrapper = document.createElement("div");
  wrapper.appendChild(serializer.serializeNode(node));

  const copyWithExecCommand = () => {
    wrapper.style.position = "fixed";
    wrapper.style.left = "-9999px";
    document.body.appendChild(wrapper);
    const range = document.createRange();
    range.selectNodeContents(wrapper);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    document.execCommand("copy");
    selection?.removeAllRanges();
    document.body.removeChild(wrapper);
    editor.view.focus();
  };

  if (!navigator.clipboard?.write) {
    copyWithExecCommand();
    return Promise.resolve();
  }

  return navigator.clipboard
    .write([
      new ClipboardItem({
        "text/html": new Blob([wrapper.innerHTML], { type: "text/html" }),
        "text/plain": new Blob(
          [node.textBetween(0, node.content.size, "\n\n")],
          { type: "text/plain" },
        ),
      }),
    ])
    .catch(copyWithExecCommand);
}
