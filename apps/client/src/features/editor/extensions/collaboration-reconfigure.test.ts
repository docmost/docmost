import { Editor } from "@tiptap/core";
import { StarterKit } from "@tiptap/starter-kit";
import { Collaboration } from "@tiptap/extension-collaboration";
import { EditorState, Plugin, PluginKey } from "@tiptap/pm/state";
import { ySyncPluginKey, yUndoPluginKey } from "@tiptap/y-tiptap";
import * as Y from "yjs";
import { afterEach, describe, expect, it } from "vitest";

let editor: Editor | null = null;
const ydocs: Y.Doc[] = [];

afterEach(() => {
  editor?.destroy();
  editor = null;
  ydocs.splice(0).forEach((doc) => doc.destroy());
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
  ydocs.push(ydoc);
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
    ydocs.push(remote);
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(ydoc));
    const fragment = remote.getXmlFragment("default");
    const paragraph = new Y.XmlElement("paragraph");
    paragraph.insert(0, [new Y.XmlText("Remote paragraph")]);
    fragment.insert(fragment.length, [paragraph]);
    Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(remote));

    expect(editor.getText()).toContain("Remote paragraph");
  });

  it.each(["reconfigured", "saved"] as const)(
    "preserves missed remote edits when restoring %s editor state",
    (stateSource) => {
      const { editor, ydoc } = createCollabEditor();
      const savedState = editor.state;
      const plugins = savedState.plugins;
      const syncPlugin = ySyncPluginKey.get(editor.state);
      const undoPlugin = yUndoPluginKey.get(editor.state);
      editor.view.updateState(
        editor.state.reconfigure({
          plugins: plugins.filter(
            (plugin) => plugin !== syncPlugin && plugin !== undoPlugin,
          ),
        }),
      );

      const remote = new Y.Doc();
      ydocs.push(remote);
      Y.applyUpdate(remote, Y.encodeStateAsUpdate(ydoc));
      const fragment = remote.getXmlFragment("default");
      const paragraph = new Y.XmlElement("paragraph");
      paragraph.insert(0, [new Y.XmlText("Remote paragraph")]);
      fragment.insert(fragment.length, [paragraph]);
      Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(remote));

      editor.view.updateState(
        stateSource === "saved"
          ? savedState
          : editor.state.reconfigure({ plugins }),
      );
      expect(editor.getText()).toContain("Remote paragraph");

      editor.commands.insertContentAt(1, "Local ");
      Y.applyUpdate(remote, Y.encodeStateAsUpdate(ydoc));

      expect(fragment.toString()).toContain("Remote paragraph");
      expect(fragment.toString()).toContain("Local Title");
    },
  );

  it("restores shared content when editor state is recreated on the same view", () => {
    const { editor, ydoc } = createCollabEditor();
    editor.view.updateState(
      EditorState.create({
        schema: editor.schema,
        plugins: editor.state.plugins,
      }),
    );

    expect(editor.getText()).toBe(
      "Title\n\nFirst paragraph\n\nSecond paragraph",
    );

    editor.commands.insertContentAt(1, "Local ");
    const fragment = ydoc.getXmlFragment("default");
    expect(fragment.length).toBe(3);
    expect(fragment.toString()).toContain("Local Title");
    expect(fragment.toString()).toContain("Second paragraph");
  });
});
