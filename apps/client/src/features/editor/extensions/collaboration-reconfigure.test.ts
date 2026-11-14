import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Collaboration } from "@tiptap/extension-collaboration";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import * as Y from "yjs";
import { afterEach, describe, expect, it } from "vitest";

let editor: Editor | null = null;

afterEach(() => {
  editor?.destroy();
  editor = null;
  document.body.innerHTML = "";
});

function createCollabEditor() {
  const source = new Editor({
    extensions: [StarterKit],
    content: "<h2>Title</h2><p>First paragraph</p><p>Second paragraph</p>",
  });
  const json = source.getJSON();
  source.destroy();

  const ydoc = new Y.Doc();
  const element = document.createElement("div");
  document.body.appendChild(element);
  editor = new Editor({
    element,
    extensions: [
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: ydoc }),
    ],
  });
  editor.commands.setContent(json);
  return { editor, ydoc };
}

describe("collaboration editor reconfigure", () => {
  it("does not rebuild the document when a plugin is registered or unregistered", () => {
    const { editor } = createCollabEditor();
    const key = new PluginKey("testMenu");
    let rerenders = 0;
    editor.on("transaction", ({ transaction }) => {
      if (transaction.getMeta(ySyncPluginKey)?.binding) rerenders += 1;
    });

    editor.registerPlugin(new Plugin({ key }));
    editor.unregisterPlugin(key);

    expect(rerenders).toBe(0);
  });

  it("still applies remote updates after a reconfigure", () => {
    const { editor, ydoc } = createCollabEditor();
    editor.registerPlugin(new Plugin({ key: new PluginKey("testMenu") }));

    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(ydoc));
    const fragment = remote.getXmlFragment("default");
    const paragraph = new Y.XmlElement("paragraph");
    paragraph.insert(0, [new Y.XmlText("Remote paragraph")]);
    fragment.insert(fragment.length, [paragraph]);
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(remote));

    expect(editor.getText()).toContain("Remote paragraph");
  });
});
