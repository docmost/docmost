import {
  CustomTable,
  getPageHTML,
  htmlToMarkdown,
  Tab,
  TabLabel,
  TabPanel,
  Tabs,
} from "@docmost/editor-ext";
import { Editor, type Extensions, type JSONContent } from "@tiptap/core";
import { TableKit } from "@tiptap/extension-table";
import { NodeSelection } from "@tiptap/pm/state";
import { StarterKit } from "@tiptap/starter-kit";
import { Collaboration } from "@tiptap/extension-collaboration";
import { yUndoPluginKey } from "@tiptap/y-tiptap";
import * as Y from "yjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  applyTemplateToPage,
  withoutUploadPlaceholders,
} from "@/ee/template/template.utils";
import type { ITemplate } from "@/ee/template/types/template.types";
import { TemplatePlaceholder } from "./template-placeholder";
import { MarkdownClipboard } from "./markdown-clipboard";

const hint = { type: "templatePlaceholder", attrs: { hint: "Enter a name" } };
const text = (value: string) => ({ type: "text", text: value });
const paragraph = (...content: JSONContent[]) => ({
  type: "paragraph",
  content,
});
const editors: Editor[] = [];

function createEditor(
  content: JSONContent[],
  onEdit?: () => void,
  extensions: Extensions = [],
) {
  const editor = new Editor({
    extensions: [
      StarterKit,
      TemplatePlaceholder.configure({ onEdit }),
      ...extensions,
    ],
    content: { type: "doc", content },
  });
  editors.push(editor);
  return editor;
}

function clickHint(editor: Editor, pos: number) {
  const { view } = editor;
  return view.someProp("handleClickOn", (handle) =>
    handle(
      view,
      pos,
      view.state.doc.nodeAt(pos),
      pos,
      new MouseEvent("mouseup"),
      true,
    ),
  );
}

afterEach(() => editors.splice(0).forEach((editor) => editor.destroy()));

describe("template placeholder", () => {
  it("survives saving and applying a template without becoming text or clipboard HTML", () => {
    const author = createEditor([paragraph(text("Owner: "), hint)], vi.fn());
    const page = createEditor([paragraph()]);
    const title = createEditor([paragraph()]);
    const template = {
      title: "Handoff",
      content: withoutUploadPlaceholders(author.getJSON()),
    } as ITemplate;

    expect(applyTemplateToPage(page, title, template)).toBe(true);
    expect(page.getJSON()).toEqual(author.getJSON());
    expect(
      page.view.dom
        .querySelector(".template-placeholder")
        ?.getAttribute("aria-label"),
    ).toBe(hint.attrs.hint);
    expect(page.getText()).toBe("Owner: ");
    page.commands.selectAll();
    const copied = page.view.serializeForClipboard(
      page.state.selection.content(),
    );
    expect(copied.text).toBe("Owner: ");
    expect(copied.dom.innerHTML).not.toContain(hint.attrs.hint);
    expect(page.getHTML()).not.toContain(hint.attrs.hint);
  });

  it("replaces only the selected inline hint, keeping its formatting and neighboring content", () => {
    const editor = createEditor([
      paragraph(
        text("By "),
        { ...hint, marks: [{ type: "bold" }] },
        text(" in "),
        hint,
      ),
    ]);
    const original = editor.getJSON();
    editor.commands.setTextSelection({ from: 4, to: 5 });
    editor.view.dispatch(editor.state.tr.insertText("Sam"));
    expect(editor.getJSON().content[0].content).toEqual([
      text("By "),
      { ...text("Sam"), marks: [{ type: "bold" }] },
      text(" in "),
      hint,
    ]);
    editor.commands.undo();
    expect(editor.getJSON()).toEqual(original);
  });

  it("round-trips inline and standalone instructions when cut and pasted between templates", () => {
    const source = createEditor(
      [
        paragraph(text("Owner: "), { ...hint, marks: [{ type: "bold" }] }),
        paragraph({ ...hint, attrs: { hint: 'Include <details> & "dates"' } }),
      ],
      vi.fn(),
      [MarkdownClipboard],
    );
    const original = source.getJSON();
    source.commands.selectAll();
    const { dom, text: plain } = source.view.serializeForClipboard(
      source.state.selection.content(),
    );
    source.commands.deleteSelection();
    expect(source.getText()).toBe("");
    expect(plain.trimEnd()).toBe("Owner:");
    const author = createEditor([paragraph()], vi.fn(), [MarkdownClipboard]);
    author.view.pasteHTML(dom.innerHTML, new Event("paste") as ClipboardEvent);
    expect(author.getJSON()).toEqual(original);
    const page = createEditor([paragraph()], undefined, [MarkdownClipboard]);
    page.view.pasteHTML(dom.innerHTML, new Event("paste") as ClipboardEvent);
    expect(page.getText().trimEnd()).toBe("Owner:");
    expect(JSON.stringify(page.getJSON())).not.toContain("templatePlaceholder");
  });

  it("omits an instruction's hyperlink from page copy and Markdown while keeping real links", () => {
    const instructionUrl = "https://example.com/instructions";
    const realUrl = "https://example.com/handbook";
    const link = (href: string) => [{ type: "link", attrs: { href } }];
    const editor = createEditor([
      paragraph(
        text("Owner: "),
        { ...hint, marks: link(instructionUrl) },
        text(" "),
        { ...text("Handbook"), marks: link(realUrl) },
      ),
    ]);
    editor.commands.selectAll();
    const { dom } = editor.view.serializeForClipboard(
      editor.state.selection.content(),
    );
    for (const html of [dom.innerHTML, getPageHTML(editor)]) {
      expect(html).not.toContain(instructionUrl);
      expect(html).not.toContain(hint.attrs.hint);
      expect(htmlToMarkdown(html)).toContain(`[Handbook](${realUrl})`);
    }
    clickHint(editor, 8);
    editor.view.dispatch(editor.state.tr.insertText("Sam"));
    expect(htmlToMarkdown(getPageHTML(editor))).toContain(
      `[Sam](${instructionUrl})`,
    );
  });

  it.each([
    ["ArrowRight", 39, 4, 5],
    ["ArrowLeft", 37, 5, 4],
  ] as const)(
    "moves the caret across an inline hint with %s and fills it on typing",
    (key, keyCode, start, end) => {
      const bold = [{ type: "bold" }];
      const content = [
        paragraph(text("By "), { ...hint, marks: bold }, text(" today")),
      ];
      const editor = createEditor(content);
      // jsdom has no layout for ProseMirror to infer the direction of the line.
      vi.spyOn(editor.view, "coordsAtPos").mockImplementation((pos) => ({
        left: pos * 8,
        right: pos * 8,
        top: 0,
        bottom: 16,
      }));
      editor.commands.setTextSelection(start);
      editor.view.dom.dispatchEvent(
        new KeyboardEvent("keydown", {
          key,
          keyCode,
          bubbles: true,
          cancelable: true,
        }),
      );
      expect(editor.state.selection.toJSON()).toEqual({
        type: "text",
        anchor: end,
        head: end,
      });
      editor.view.dispatch(editor.state.tr.insertText("Sam"));
      expect(editor.getJSON().content).toEqual([
        paragraph(text("By "), { ...text("Sam"), marks: bold }, text(" today")),
      ]);
      editor.commands.undo();
      expect(editor.getJSON().content).toEqual(content);
    },
  );

  it("keeps a caret when navigating into a prompt-only cell and selects ordinary cell text", () => {
    const cells = [
      text("Owner"),
      { ...hint, marks: [{ type: "bold" }] },
      text("Room"),
    ];
    const editor = createEditor(
      [
        {
          type: "table",
          content: [
            {
              type: "tableRow",
              content: cells.map((node) => ({
                type: "tableCell",
                content: [paragraph(node)],
              })),
            },
          ],
        },
      ],
      undefined,
      [
        CustomTable.configure({ resizable: false }),
        TableKit.configure({ table: false }),
      ],
    );
    editor.commands.setTextSelection(4);
    editor.commands.goToNextCell();
    const atHint = editor.state.selection;
    expect(atHint.empty).toBe(true);
    expect(atHint.$from.nodeAfter?.type.name).toBe("templatePlaceholder");
    editor.commands.goToNextCell();
    const room = editor.state.selection;
    expect(editor.state.doc.textBetween(room.from, room.to)).toBe("Room");
    editor.commands.goToPreviousCell();
    expect(editor.state.selection.eq(atHint)).toBe(true);
    editor.view.dispatch(editor.state.tr.insertText("Sam"));
    expect(
      editor.state.doc.firstChild.firstChild.child(1).firstChild.toJSON(),
    ).toEqual(paragraph({ ...text("Sam"), marks: [{ type: "bold" }] }));
  });

  it("places the caret before a clicked inline hint and fills it with its original marks", () => {
    const editor = createEditor([
      paragraph(
        text("By "),
        { ...hint, marks: [{ type: "bold" }] },
        text(" or "),
        hint,
      ),
    ]);
    const original = editor.getJSON();
    expect(clickHint(editor, 4)).toBe(true);
    expect(editor.state.selection.toJSON()).toEqual({
      type: "text",
      anchor: 4,
      head: 4,
    });
    editor.view.dispatch(editor.state.tr.insertText("Sam"));
    expect(editor.getJSON().content[0].content).toEqual([
      text("By "),
      { ...text("Sam"), marks: [{ type: "bold" }] },
      text(" or "),
      hint,
    ]);
    editor.commands.undo();
    expect(editor.getJSON()).toEqual(original);
  });

  it.each(["forward", "backward"])(
    "fills only the first prompt when tabbing %s into a multi-line cell",
    (direction) => {
      const bold = [{ type: "bold" }];
      const second = { ...hint, attrs: { hint: "Second answer" } };
      const label = direction === "backward" ? [text("Owner: ")] : [];
      const paragraphs = [
        paragraph(),
        paragraph(...label, { ...hint, marks: bold }),
        paragraph(second),
      ];
      const editor = createEditor(
        [
          {
            type: "table",
            content: [
              {
                type: "tableRow",
                content: [
                  [paragraph(text("Left"))],
                  paragraphs,
                  [paragraph(text("Right"))],
                ].map((content) => ({ type: "tableCell", content })),
              },
            ],
          },
        ],
        undefined,
        [
          CustomTable.configure({ resizable: false }),
          TableKit.configure({ table: false }),
        ],
      );
      const cells = editor.state.doc.firstChild.firstChild;
      const lastCellPos = 4 + cells.child(0).nodeSize + cells.child(1).nodeSize;
      editor.commands.setTextSelection(
        direction === "forward" ? 4 : lastCellPos,
      );
      const key = new KeyboardEvent("keydown", {
        key: "Tab",
        keyCode: 9,
        shiftKey: direction === "backward",
        bubbles: true,
        cancelable: true,
      });
      editor.view.dom.dispatchEvent(key);
      expect(editor.state.selection.empty).toBe(true);
      expect(editor.state.selection.$from.nodeAfter?.attrs.hint).toBe(
        hint.attrs.hint,
      );
      editor.view.dispatch(editor.state.tr.insertText("Sam"));
      expect(
        editor.state.doc.firstChild.firstChild.child(1).toJSON().content,
      ).toEqual([
        { type: "paragraph" },
        paragraph(...label, { ...text("Sam"), marks: bold }),
        paragraph(second),
      ]);
    },
  );

  it.each([8, 9])(
    "fills a soft-broken line from caret position %i after vertical navigation",
    (pos) => {
      const br = { type: "hardBreak" };
      const bold = [{ type: "bold" }];
      const content = [
        paragraph(
          text("Header"),
          br,
          { ...hint, marks: bold },
          br,
          text("Footer"),
        ),
      ];
      const editor = createEditor(content);
      editor.commands.setTextSelection(pos);
      editor.view.dispatch(editor.state.tr.insertText("Sam"));
      expect(editor.getJSON().content).toEqual([
        paragraph(
          text("Header"),
          br,
          { ...text("Sam"), marks: bold },
          br,
          text("Footer"),
        ),
      ]);
      editor.commands.undo();
      expect(editor.getJSON().content).toEqual(content);
    },
  );

  it.each(["clicking it", "moving the caret after it"])(
    "fills a hint without marks with the formatting around it after %s",
    (how) => {
      const bold = [{ type: "bold" }];
      const editor = createEditor([
        paragraph({ ...text("Owner: "), marks: bold }, hint),
      ]);
      if (how === "clicking it") clickHint(editor, 8);
      else editor.commands.setTextSelection(9);
      editor.view.dispatch(editor.state.tr.insertText("Sam"));
      expect(editor.getJSON().content).toEqual([
        paragraph({ ...text("Owner: Sam"), marks: bold }),
      ]);
    },
  );

  it.each([
    ["at the end of its line", [text("Owner: "), hint], 9, [text("Owner: "), hint, { type: "hardBreak" }]],
    ["after clicking it mid-line", [text("By "), hint, text(" today")], 4, [text("By "), { type: "hardBreak" }, hint, text(" today")]],
  ])("keeps a hint when Shift+Enter breaks the line %s", (_where, content, pos, expected) => {
    const editor = createEditor([paragraph(...content)]);
    if (pos === 4) clickHint(editor, pos);
    else editor.commands.setTextSelection(pos);
    editor.commands.setHardBreak();
    expect(editor.getJSON().content).toEqual([paragraph(...expected)]);
  });

  it("keeps the prompt when the user leaves it and edits neighboring text", () => {
    const editor = createEditor([
      paragraph(text("By "), hint, text(" tomorrow")),
    ]);
    clickHint(editor, 4);
    editor.commands.setTextSelection(1);
    editor.commands.setTextSelection(4);
    editor.view.dispatch(editor.state.tr.insertText("the owner: "));
    expect(editor.getJSON().content).toEqual([
      paragraph(text("By the owner: "), hint, text(" tomorrow")),
    ]);
  });

  it.each([1, 2])(
    "replaces a standalone hint by typing at caret position %i and supports undo",
    (pos) => {
      const editor = createEditor([paragraph(hint)]);
      editor.commands.setTextSelection(pos);
      editor.view.dispatch(editor.state.tr.insertText("Sam"));
      expect(editor.getJSON().content).toEqual([paragraph(text("Sam"))]);
      editor.commands.undo();
      expect(editor.getJSON().content).toEqual([paragraph(hint)]);
      editor.commands.redo();
      expect(editor.getJSON().content).toEqual([paragraph(text("Sam"))]);
    },
  );

  it.each([8, 9])(
    "uses the native insertion at %i when Chrome's last reported selection is still on the previous line",
    (pos) => {
      const br = { type: "hardBreak" };
      const bold = [{ type: "bold" }];
      const content = [
        paragraph(
          text("Header"),
          br,
          { ...hint, marks: bold },
          br,
          text("Footer"),
        ),
      ];
      const editor = createEditor(content);
      expect(editor.state.selection.from).toBe(1);
      const { view } = editor;
      const handled = view.someProp("handleTextInput", (handle) =>
        handle(view, pos, pos, "S", () =>
          view.state.tr.insertText("S", pos, pos),
        ),
      );
      expect(handled).toBe(true);
      expect(editor.getJSON().content).toEqual([
        paragraph(
          text("Header"),
          br,
          { ...text("S"), marks: bold },
          br,
          text("Footer"),
        ),
      ]);
      expect(editor.state.selection.from).toBe(9);
      editor.commands.undo();
      expect(editor.getJSON().content).toEqual(content);
    },
  );

  it("replaces an end-of-line hint on rich paste and keeps the pasted formatting", () => {
    const editor = createEditor([paragraph(text("Owner: "), hint)]);
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.view.pasteHTML(
      "<strong>Sam</strong>",
      new Event("paste") as ClipboardEvent,
    );
    expect(editor.getJSON().content[0].content).toEqual([
      text("Owner: "),
      { ...text("Sam"), marks: [{ type: "bold" }] },
    ]);
  });

  it("lets an author type around a hint and only opens its editor in a template", () => {
    const onEdit = vi.fn();
    const editor = createEditor([paragraph(hint)], onEdit);
    expect(NodeSelection.isSelectable(editor.state.doc.nodeAt(1))).toBe(true);
    expect(editor.can().editTemplatePlaceholder()).toBe(true);
    expect(onEdit).not.toHaveBeenCalled();
    editor.commands.editTemplatePlaceholder();
    expect(onEdit).toHaveBeenCalledOnce();
    editor.view.dispatch(editor.state.tr.insertText("Owner: "));
    expect(editor.getJSON().content).toEqual([
      paragraph(text("Owner: "), hint),
    ]);
    expect(createEditor([paragraph()]).can().editTemplatePlaceholder()).toBe(
      false,
    );
  });

  it("turns selected bullets into independent hints and restores the whole list with one undo", () => {
    const onEdit = vi.fn();
    const labels = [
      "Read the proposal",
      "Review the dashboard",
      "Add questions",
    ];
    const heading = {
      type: "heading",
      attrs: { level: 2 },
      content: [text("Agenda")],
    };
    const editor = createEditor(
      [
        heading,
        {
          type: "bulletList",
          content: labels.map((label) => ({
            type: "listItem",
            content: [paragraph(text(label))],
          })),
        },
        heading,
        paragraph(),
      ],
      onEdit,
    );
    const { doc } = editor.state;
    const listPos = doc.firstChild.nodeSize;
    editor.commands.setTextSelection({
      from: listPos + 3,
      to: listPos + doc.child(1).nodeSize - 3,
    });
    const before = editor.getJSON();
    expect(editor.can().editTemplatePlaceholder()).toBe(true);
    expect(editor.getJSON()).toEqual(before);
    expect(editor.commands.editTemplatePlaceholder()).toBe(true);
    expect(onEdit).not.toHaveBeenCalled();
    const content = editor.getJSON().content;
    expect(content[0]).toEqual(before.content[0]);
    expect(content[2]).toEqual(before.content[2]);
    expect(content[1]).toEqual({
      type: "bulletList",
      content: labels.map((label) => ({
        type: "listItem",
        content: [
          paragraph({ type: "templatePlaceholder", attrs: { hint: label } }),
        ],
      })),
    });
    editor.commands.undo();
    expect(editor.getJSON()).toEqual(before);
  });

  it("converts a single highlighted phrase immediately, preserving formatting and surrounding spaces", () => {
    const onEdit = vi.fn();
    const editor = createEditor(
      [
        paragraph(
          text("Owner: "),
          { ...text("First name"), marks: [{ type: "bold" }] },
          text(" next"),
        ),
      ],
      onEdit,
    );
    const original = editor.getJSON();
    editor.commands.setTextSelection({ from: 7, to: 19 });
    expect(editor.commands.editTemplatePlaceholder()).toBe(true);
    expect(onEdit).not.toHaveBeenCalled();
    expect(editor.getJSON().content).toEqual([
      paragraph(
        text("Owner: "),
        {
          type: "templatePlaceholder",
          attrs: { hint: "First name" },
          marks: [{ type: "bold" }],
        },
        text(" next"),
      ),
    ]);
    editor.commands.undo();
    expect(editor.getJSON()).toEqual(original);
  });

  it("converts Select All in a heading without opening the popover", () => {
    const onEdit = vi.fn();
    const editor = createEditor(
      [{ type: "heading", attrs: { level: 2 }, content: [text("Outcome")] }],
      onEdit,
    );
    editor.commands.selectAll();
    expect(editor.commands.editTemplatePlaceholder()).toBe(true);
    expect(editor.state.doc.firstChild.type.name).toBe("heading");
    expect(editor.state.doc.firstChild.firstChild.attrs.hint).toBe("Outcome");
    expect(onEdit).not.toHaveBeenCalled();
  });

  it("converts each tab's panel text while preserving the tab names", () => {
    const names = ["Budget", "Timeline"];
    const editor = createEditor(
      [
        paragraph(text("Section")),
        {
          type: "tabs",
          content: names.map((name) => ({
            type: "tab",
            attrs: { id: name },
            content: [
              { type: "tabLabel", content: [text(name)] },
              { type: "tabPanel", content: [paragraph(text(`Enter ${name}`))] },
            ],
          })),
        },
        paragraph(),
      ],
      vi.fn(),
      [Tabs, Tab, TabLabel, TabPanel],
    );
    const original = editor.getJSON();
    editor.commands.selectAll();
    expect(editor.commands.editTemplatePlaceholder()).toBe(true);
    names.forEach((name, index) => {
      const tab = editor.state.doc.child(1).child(index);
      expect(tab.firstChild.textContent).toBe(name);
      expect(tab.lastChild.firstChild.firstChild.attrs.hint).toBe(
        `Enter ${name}`,
      );
    });
    editor.commands.undo();
    expect(editor.getJSON()).toEqual(original);
  });

  it("preserves hard breaks, blank paragraphs, partial lines and the marks on converted text", () => {
    const editor = createEditor(
      [
        paragraph(text("Keep first"), { type: "hardBreak" }, text("second")),
        paragraph(),
        paragraph(
          { ...text("last"), marks: [{ type: "italic" }] },
          text(" stays"),
        ),
      ],
      vi.fn(),
    );
    editor.commands.setTextSelection({
      from: 6,
      to: editor.state.doc.content.size - 7,
    });
    editor.commands.editTemplatePlaceholder();
    const asHint = (hint: string) => ({
      type: "templatePlaceholder",
      attrs: { hint },
    });
    expect(editor.getJSON().content).toEqual([
      paragraph(
        text("Keep "),
        asHint("first"),
        { type: "hardBreak" },
        asHint("second"),
      ),
      { type: "paragraph" },
      paragraph(
        { ...asHint("last"), marks: [{ type: "italic" }] },
        text(" stays"),
      ),
    ]);
  });

  it("fills the clicked hint after a peer edits nearby and syncs its undo", () => {
    const document = new Y.Doc();
    const createPeer = () =>
      new Editor({
        extensions: [
          StarterKit.configure({ undoRedo: false }),
          TemplatePlaceholder,
          Collaboration.configure({ document }),
        ],
      });
    const writer = createPeer();
    const reader = createPeer();
    try {
      const content = [paragraph(text("By "), hint, text(" today"))];
      writer.commands.setContent({ type: "doc", content });
      expect(reader.getJSON().content).toEqual(content);
      clickHint(writer, 4);
      reader.view.dispatch(reader.state.tr.insertText("Written ", 1, 1));
      yUndoPluginKey.getState(writer.state).undoManager.stopCapturing();
      writer.view.dispatch(writer.state.tr.insertText("Sam"));
      expect(reader.getJSON().content).toEqual([
        paragraph(text("Written By Sam today")),
      ]);
      writer.commands.undo();
      expect(reader.getJSON().content).toEqual([
        paragraph(text("Written By "), hint, text(" today")),
      ]);
    } finally {
      writer.destroy();
      reader.destroy();
      document.destroy();
    }
  });
});
