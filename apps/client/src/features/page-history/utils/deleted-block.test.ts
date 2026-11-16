import { getSchema } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Node } from "@tiptap/pm/model";
import { StarterKit } from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { deletedBlockDOM } from "./deleted-block";

const schema = getSchema([StarterKit, TaskList, TaskItem]);

const text = (value: string, marks?: object[]) =>
  marks ? { type: "text", text: value, marks } : { type: "text", text: value };
const p = (...content: object[]) => ({ type: "paragraph", content });
const node = (json: object) => Node.fromJSON(schema, json);

describe("deletedBlockDOM", () => {
  it("keeps a list item a list item and strikes its text", () => {
    const item = node({ type: "listItem", content: [p(text("Bravo"))] });

    expect(deletedBlockDOM(item).outerHTML).toBe(
      '<li class="history-diff-block-deleted"><p><span class="history-diff-deleted">Bravo</span></p></li>',
    );
  });

  it("strikes every run of formatted text", () => {
    const paragraph = node(p(text("a "), text("b", [{ type: "bold" }])));

    expect(deletedBlockDOM(paragraph).innerHTML).toBe(
      '<span class="history-diff-deleted">a </span><strong><span class="history-diff-deleted">b</span></strong>',
    );
  });

  it("strikes the text of the blocks inside it", () => {
    const item = node({
      type: "listItem",
      content: [
        p(text("Alpha")),
        {
          type: "bulletList",
          content: [{ type: "listItem", content: [p(text("Nested"))] }],
        },
      ],
    });

    const dom = deletedBlockDOM(item);

    expect(
      [...dom.querySelectorAll(".history-diff-deleted")].map(
        (span) => span.textContent,
      ),
    ).toEqual(["Alpha", "Nested"]);
    expect(dom.querySelector("li > ul > li > p")?.textContent).toBe("Nested");
  });

  it("disables the checkbox of a task", () => {
    const task = node({
      type: "taskItem",
      attrs: { checked: false },
      content: [p(text("Call"))],
    });

    expect(deletedBlockDOM(task).querySelector("input")?.disabled).toBe(true);
  });
});
