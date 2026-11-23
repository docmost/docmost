import { getSchema, Node as TiptapNode } from "@tiptap/core";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { Node } from "@tiptap/pm/model";
import { StarterKit } from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { deletedBlockDOM } from "./deleted-block";

const Image = TiptapNode.create({
  name: "image",
  group: "block",
  atom: true,
  renderHTML: () => ["img"],
});

const Callout = TiptapNode.create({
  name: "callout",
  group: "block",
  content: "block+",
  renderHTML: () => ["div", { "data-type": "callout" }, 0],
});

const schema = getSchema([StarterKit, TaskList, TaskItem, Image, Callout]);
const special = new Set(["image", "callout"]);

const text = (value: string, marks?: object[]) =>
  marks ? { type: "text", text: value, marks } : { type: "text", text: value };
const p = (...content: object[]) => ({ type: "paragraph", content });
const node = (json: object) => Node.fromJSON(schema, json);

describe("deletedBlockDOM", () => {
  it("keeps a list item a list item and strikes its text", () => {
    const item = node({ type: "listItem", content: [p(text("Bravo"))] });

    expect(deletedBlockDOM(item, special).outerHTML).toBe(
      '<li class="history-diff-block-deleted"><p><span class="history-diff-deleted">Bravo</span></p></li>',
    );
  });

  it("strikes every run of formatted text", () => {
    const paragraph = node(p(text("a "), text("b", [{ type: "bold" }])));

    expect(deletedBlockDOM(paragraph, special).innerHTML).toBe(
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

    const dom = deletedBlockDOM(item, special);

    expect(
      [...dom.querySelectorAll(".history-diff-deleted")].map(
        (span) => span.textContent,
      ),
    ).toEqual(["Alpha", "Nested"]);
    expect(dom.querySelector("li > ul > li > p")?.textContent).toBe("Nested");
  });

  it("draws a special node inside the block as a deleted node", () => {
    const item = node({
      type: "listItem",
      content: [p(text("Step")), { type: "image" }],
    });

    expect(deletedBlockDOM(item, special).innerHTML).toBe(
      '<p><span class="history-diff-deleted">Step</span></p><div class="history-diff-node-deleted"><img></div>',
    );
  });

  it("strikes no text inside a special node, which is dimmed as a whole", () => {
    const item = node({
      type: "listItem",
      content: [
        p(text("Step")),
        { type: "callout", content: [p(text("Careful"))] },
      ],
    });

    expect(deletedBlockDOM(item, special).innerHTML).toBe(
      '<p><span class="history-diff-deleted">Step</span></p><div class="history-diff-node-deleted"><div data-type="callout"><p>Careful</p></div></div>',
    );
  });

  it("disables the checkbox of a task", () => {
    const task = node({
      type: "taskItem",
      attrs: { checked: false },
      content: [p(text("Call"))],
    });

    expect(deletedBlockDOM(task, special).querySelector("input")?.disabled).toBe(true);
  });
});
