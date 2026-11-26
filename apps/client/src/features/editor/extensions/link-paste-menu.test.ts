import { Editor } from "@tiptap/core";
import TiptapLink from "@tiptap/extension-link";
import { TextSelection, type Transaction } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import { afterEach, describe, expect, it } from "vitest";
import { LinkPasteMenuExtension, linkPasteMenuKey } from "./link-paste-menu";

const url = "https://example.com/a";
const otherUrl = "https://example.com/b";
// "Read " fills positions 1 to 6, so the link starts at 6.
const from = 6;
const to = from + url.length;

let editor: Editor;

afterEach(() => editor?.destroy());

// Like the paste: the link with the cursor after it, and the menu's range in the same transaction.
function pasteLink() {
  editor = new Editor({
    extensions: [
      StarterKit.configure({ link: false }),
      TiptapLink,
      LinkPasteMenuExtension,
    ],
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Read " },
            {
              type: "text",
              text: url,
              marks: [{ type: "link", attrs: { href: url } }],
            },
            { type: "text", text: " today" },
          ],
        },
      ],
    },
  });
  const { tr } = editor.state;
  editor.view.dispatch(
    tr
      .setSelection(TextSelection.create(tr.doc, to))
      .setMeta(linkPasteMenuKey, { from, to, url }),
  );
  expect(menuState()).toEqual({ from, to, url });
}

const menuState = () => linkPasteMenuKey.getState(editor.state);

const asFollowUp = (tr: Transaction) =>
  tr.setMeta("appendedTransaction", editor.state.tr);

// Like y-sync, which restores the local selection on every remote change.
const asRemote = (tr: Transaction) =>
  tr
    .setSelection(tr.selection)
    .setMeta(ySyncPluginKey, { isChangeOrigin: true });

describe("LinkPasteMenuExtension", () => {
  it("keeps the range through appended transactions", () => {
    pasteLink();

    editor.view.dispatch(asFollowUp(editor.state.tr.insertText("Hi ", 1)));

    expect(menuState()).toEqual({ from: from + 3, to: to + 3, url });
  });

  it("keeps the range through a collaborator's edit elsewhere", () => {
    pasteLink();
    const remote = asRemote(editor.state.tr.insertText("Hi ", 1));
    expect(remote.selectionSet).toBe(true);

    editor.view.dispatch(remote);

    expect(menuState()).toEqual({ from: from + 3, to: to + 3, url });
  });

  it("clears when a collaborator changes the link itself", () => {
    pasteLink();

    editor.view.dispatch(
      asRemote(
        editor.state.tr.removeMark(to - 4, to, editor.schema.marks.link),
      ),
    );

    expect(menuState()).toBeNull();
  });

  it("keeps the range through a transaction that changes nothing", () => {
    pasteLink();

    editor.view.dispatch(editor.state.tr.setMeta("unrelated", true));

    expect(menuState()).toEqual({ from, to, url });
  });

  it("clears on a selection change", () => {
    pasteLink();

    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(editor.state.doc, 2),
      ),
    );

    expect(menuState()).toBeNull();
  });

  it("clears when the user types next to the link", () => {
    pasteLink();
    const typing = editor.state.tr.insertText("x", to);
    expect(typing.selectionSet).toBe(false);

    editor.view.dispatch(typing);

    expect(menuState()).toBeNull();
  });

  it.each([
    [
      "loses the mark on part of its range",
      (tr: Transaction) =>
        tr.removeMark(to - 4, to, editor.schema.marks.link),
    ],
    [
      "points somewhere else",
      (tr: Transaction) =>
        tr.addMark(
          from,
          to,
          editor.schema.marks.link.create({ href: otherUrl }),
        ),
    ],
  ])("clears when the link itself changes: it %s", (_, change) => {
    pasteLink();

    editor.view.dispatch(asFollowUp(change(editor.state.tr)));

    expect(menuState()).toBeNull();
  });
});
