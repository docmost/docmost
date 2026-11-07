import { MantineProvider } from "@mantine/core";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { Editor, type JSONContent } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { StarterKit } from "@tiptap/starter-kit";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Indent } from "@docmost/editor-ext";
import type { ToolbarState } from "../use-toolbar-state";
import { InlineMarksGroup } from "./inline-marks-group";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (value: string) => value }),
}));

const paragraph = (text: string): JSONContent => ({
  type: "paragraph",
  content: [{ type: "text", text }],
});

const item = (text: string, ...children: JSONContent[]): JSONContent => ({
  type: "listItem",
  content: [paragraph(text), ...children],
});

const task = (text: string, ...children: JSONContent[]): JSONContent => ({
  type: "taskItem",
  content: [paragraph(text), ...children],
});

const list = (type: string, ...content: JSONContent[]): JSONContent => ({
  type,
  content,
});

// The document as nested text and list types, without the default attributes.
function outline(node: JSONContent): unknown {
  if (node.type === "paragraph") {
    return node.content?.map((child) => child.text).join("") ?? "";
  }
  return { [node.type as string]: node.content?.map(outline) };
}

describe("InlineMarksGroup indentation", () => {
  let editor: Editor;

  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    editor?.destroy();
  });

  function setup(content: JSONContent[], cursorText: string) {
    editor = new Editor({
      extensions: [
        StarterKit.configure({ trailingNode: false }),
        TaskList,
        TaskItem.configure({ nested: true }),
        Indent,
      ],
      content: { type: "doc", content },
    });

    let cursor = 0;
    editor.state.doc.descendants((node, pos) => {
      if (node.text === cursorText) cursor = pos + 1;
    });
    editor.commands.setTextSelection(cursor);

    render(
      <MantineProvider env="test">
        <InlineMarksGroup editor={editor} state={{} as ToolbarState} />
      </MantineProvider>,
    );
  }

  function clickMenuItem(label: string) {
    fireEvent.click(screen.getByLabelText("More inline formatting"));
    fireEvent.click(screen.getByText(label));
  }

  const documentOutline = () =>
    (outline(editor.getJSON()) as { doc: unknown }).doc;

  it.each(["bulletList", "orderedList"])(
    "nests an item under the previous one in a %s",
    (listType) => {
      setup([list(listType, item("one"), item("two"))], "two");

      clickMenuItem("Increase indent");

      expect(documentOutline()).toEqual([
        {
          [listType]: [
            { listItem: ["one", { [listType]: [{ listItem: ["two"] }] }] },
          ],
        },
      ]);
    },
  );

  it("moves a nested item one level up", () => {
    setup(
      [list("bulletList", item("one", list("bulletList", item("two"))))],
      "two",
    );

    clickMenuItem("Decrease indent");

    expect(documentOutline()).toEqual([
      { bulletList: [{ listItem: ["one"] }, { listItem: ["two"] }] },
    ]);
  });

  it("nests and lifts task items", () => {
    setup([list("taskList", task("one"), task("two"))], "two");

    clickMenuItem("Increase indent");

    expect(documentOutline()).toEqual([
      {
        taskList: [
          { taskItem: ["one", { taskList: [{ taskItem: ["two"] }] }] },
        ],
      },
    ]);

    clickMenuItem("Decrease indent");

    expect(documentOutline()).toEqual([
      { taskList: [{ taskItem: ["one"] }, { taskItem: ["two"] }] },
    ]);
  });

  it("moves the closest item when a task list is nested in a bullet list", () => {
    setup(
      [
        list(
          "bulletList",
          item("first"),
          item("outer", list("taskList", task("one"), task("two"))),
        ),
      ],
      "two",
    );

    clickMenuItem("Increase indent");

    expect(documentOutline()).toEqual([
      {
        bulletList: [
          { listItem: ["first"] },
          {
            listItem: [
              "outer",
              {
                taskList: [
                  {
                    taskItem: ["one", { taskList: [{ taskItem: ["two"] }] }],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });

  it("leaves the first item of a list in place", () => {
    setup([list("bulletList", item("one"), item("two"))], "one");

    clickMenuItem("Increase indent");

    expect(documentOutline()).toEqual([
      { bulletList: [{ listItem: ["one"] }, { listItem: ["two"] }] },
    ]);
  });

  it("still indents paragraphs", () => {
    setup([paragraph("text")], "text");

    clickMenuItem("Increase indent");
    expect(editor.getJSON().content?.[0].attrs?.indent).toBe(1);

    clickMenuItem("Decrease indent");
    expect(editor.getJSON().content?.[0].attrs?.indent).toBe(0);
  });
});
