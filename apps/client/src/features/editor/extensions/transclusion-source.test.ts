import { Editor, Node, getSchema } from "@tiptap/core";
import { Collaboration } from "@tiptap/extension-collaboration";
import { StarterKit } from "@tiptap/starter-kit";
import {
  TransclusionReference,
  TransclusionSource,
  UniqueID,
} from "@docmost/editor-ext";
import { TRANSCLUSION_SOURCE_ALLOWED_NODE_TYPES } from "@docmost/editor-ext/src/lib/transclusion/constants";
import * as Y from "yjs";
import { describe, expect, it } from "vitest";

/**
 * Regression tests for #2504: "Sync blocks are one time use per page?"
 *
 * `insertTransclusionSource` used to bail out with `return false` whenever the
 * cursor sat inside an existing sync block, so adding a second block silently
 * did nothing. The content expression already forbids real nesting, so the new
 * behaviour is to insert the block as a sibling right after the enclosing one.
 */

// Registering every node in the allow-list drags in extension plugins that
// collide on a ProseMirror plugin key under jsdom. For the behaviour tests the
// content expression is therefore widened: the commands, the enclosing-block
// lookup and the attributes under test are the real ones. The real allow-list is
// exercised separately in "genuine nesting" below.
const TransclusionSourceForEditing = TransclusionSource.extend({
  content: "block+",
});

function createEditor(content: object[]) {
  const element = document.createElement("div");
  document.body.appendChild(element);

  return new Editor({
    element,
    extensions: [
      StarterKit.configure({ trailingNode: false }),
      TransclusionSourceForEditing,
      UniqueID.configure({
        types: ["heading", "paragraph", "transclusionSource"],
      }),
    ],
    content: { type: "doc", content },
  });
}

function sourceIds(editor: Editor): (string | null)[] {
  const ids: (string | null)[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === "transclusionSource") ids.push(node.attrs.id);
  });
  return ids;
}

/** Depth of the innermost enclosing transclusionSource at `pos`, or 0. */
function enclosingSourceDepth(editor: Editor, pos: number): number {
  const $pos = editor.state.doc.resolve(pos);
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type.name === "transclusionSource") return depth;
  }
  return 0;
}

/** First text position inside the nth transclusionSource. */
function positionInsideSource(editor: Editor, n: number): number {
  let found = -1;
  let seen = 0;
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "transclusionSource") {
      if (seen === n) {
        found = pos + 1;
        return false;
      }
      seen += 1;
    }
    return true;
  });
  return found;
}

const BASE = [
  { type: "paragraph", content: [{ type: "text", text: "alpha" }] },
];

describe("#2504: adding a synced block while the cursor is inside one", () => {
  it("inserts a sibling after the enclosing block instead of doing nothing", () => {
    const editor = createEditor(BASE);
    editor.commands.setTextSelection(1);
    editor.commands.insertTransclusionSource();
    expect(sourceIds(editor)).toHaveLength(1);

    editor.commands.setTextSelection(positionInsideSource(editor, 0));
    expect(
      enclosingSourceDepth(editor, editor.state.selection.from),
    ).toBeGreaterThan(0);

    expect(editor.commands.insertTransclusionSource()).toBe(true);

    const ids = sourceIds(editor);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it("the new block is a sibling, never nested", () => {
    const editor = createEditor(BASE);
    editor.commands.setTextSelection(1);
    editor.commands.insertTransclusionSource();
    editor.commands.setTextSelection(positionInsideSource(editor, 0));
    editor.commands.insertTransclusionSource();

    // both blocks sit directly under the doc (depth 1), not one inside the other
    const depths: number[] = [];
    editor.state.doc.forEach((node, pos) => {
      if (node.type.name === "transclusionSource") depths.push(pos);
    });
    expect(depths).toHaveLength(2);
    for (const pos of depths) {
      expect(editor.state.doc.resolve(pos).depth).toBe(0);
    }
  });

  it("the new block lands directly after the enclosing one", () => {
    const editor = createEditor([
      { type: "paragraph", content: [{ type: "text", text: "before" }] },
    ]);
    editor.commands.setTextSelection(1);
    editor.commands.insertTransclusionSource();
    editor.commands.setTextSelection(positionInsideSource(editor, 0));
    editor.commands.insertTransclusionSource();

    const types = (editor.getJSON().content as { type: string }[]).map(
      (n) => n.type,
    );
    expect(types.slice(0, 2)).toEqual([
      "transclusionSource",
      "transclusionSource",
    ]);
  });

  it("works from inside a block nested in a list item", () => {
    const editor = createEditor([
      {
        type: "bulletList",
        attrs: { id: "list1" },
        content: [
          {
            type: "listItem",
            attrs: { id: "li1" },
            content: [{ type: "paragraph", attrs: { id: "p1" } }],
          },
        ],
      },
    ]);

    let insideListItem = -1;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === "paragraph" && insideListItem === -1) {
        insideListItem = pos + 1;
        return false;
      }
      return true;
    });
    editor.commands.setTextSelection(insideListItem);

    expect(editor.commands.insertTransclusionSource()).toBe(true);
    expect(sourceIds(editor)).toHaveLength(1);
  });

  it("still replaces an empty paragraph at the top level", () => {
    const editor = createEditor([{ type: "paragraph" }]);
    editor.commands.setTextSelection(1);
    editor.commands.insertTransclusionSource();

    expect(sourceIds(editor)).toHaveLength(1);
    expect(editor.getJSON().content).toHaveLength(1);
  });

  it("inserting a block outside any block behaves as before", () => {
    const editor = createEditor(BASE);
    editor.commands.setTextSelection(1);
    editor.commands.insertTransclusionSource();

    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.chain().createParagraphNear().run();
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);

    expect(editor.commands.insertTransclusionSource()).toBe(true);
    expect(sourceIds(editor)).toHaveLength(2);
  });

  it("assigns unique ids across mixed inside/outside inserts", () => {
    const editor = createEditor(BASE);
    editor.commands.setTextSelection(1);
    editor.commands.insertTransclusionSource();

    editor.commands.setTextSelection(positionInsideSource(editor, 0));
    editor.commands.insertTransclusionSource();

    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.chain().createParagraphNear().run();
    editor.commands.setTextSelection(editor.state.doc.content.size - 1);
    editor.commands.insertTransclusionSource();

    const ids = sourceIds(editor);
    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(
      true,
    );
  });
});

describe("#2504: genuine nesting stays impossible", () => {
  /**
   * Builds a schema from the real TransclusionSource plus lightweight stubs for
   * the node names in its allow-list, so the production content expression is
   * the one under test.
   */
  function realSourceSchema() {
    const stubs = TRANSCLUSION_SOURCE_ALLOWED_NODE_TYPES.map((name) =>
      Node.create({
        name,
        group: "block",
        content: "text*",
        renderHTML: () => ["div", { "data-stub": name }],
        parseHTML: () => [{ tag: `div[data-stub="${name}"]` }],
      }),
    );

    return getSchema([
      Node.create({
        name: "doc",
        content: "block+",
      }),
      Node.create({ name: "text", group: "inline" }),
      ...stubs,
      TransclusionSource,
      TransclusionReference,
    ]);
  }

  it("rejects a transclusionSource directly inside another", () => {
    const schema = realSourceSchema();
    const inner = schema.nodes.transclusionSource.create(
      { id: "inner" },
      schema.nodes.paragraph.create(),
    );
    const outer = schema.nodes.transclusionSource.create(
      { id: "outer" },
      inner,
    );

    expect(() => outer.check()).toThrow();
  });

  it("rejects a transclusionReference inside a source", () => {
    const schema = realSourceSchema();
    const ref = schema.nodes.transclusionReference.create({
      sourcePageId: "66666666-6666-4666-8666-666666666666",
      transclusionId: "other",
    });
    const outer = schema.nodes.transclusionSource.create({ id: "outer" }, ref);

    expect(() => outer.check()).toThrow();
  });

  it("accepts several sibling sources on one page", () => {
    const schema = realSourceSchema();
    const doc = schema.nodes.doc.create(null, [
      schema.nodes.paragraph.create(),
      schema.nodes.transclusionSource.create(
        { id: "a" },
        schema.nodes.paragraph.create(),
      ),
      schema.nodes.transclusionSource.create(
        { id: "b" },
        schema.nodes.paragraph.create(),
      ),
      schema.nodes.transclusionSource.create(
        { id: "c" },
        schema.nodes.paragraph.create(),
      ),
    ]);

    expect(() => doc.check()).not.toThrow();
  });
});

describe("#2504: collaborative editing (Yjs)", () => {
  /**
   * Docmost edits through Hocuspocus/Yjs, not a plain editor. With
   * `Collaboration` configured Tiptap ignores the `content` option; the
   * document comes from the Y.Doc, so the initial state has to be built with
   * commands.
   */
  function createCollabEditor(ydoc: Y.Doc) {
    const element = document.createElement("div");
    document.body.appendChild(element);

    return new Editor({
      element,
      extensions: [
        StarterKit.configure({ trailingNode: false, undoRedo: false }),
        TransclusionSourceForEditing,
        Collaboration.configure({ document: ydoc }),
        UniqueID.configure({
          types: ["heading", "paragraph", "transclusionSource"],
        }),
      ],
    });
  }

  it("adds a sibling block while the cursor is inside one", () => {
    const editor = createCollabEditor(new Y.Doc());

    editor.commands.setTextSelection(1);
    editor.commands.insertContent("alpha");
    editor.commands.insertTransclusionSource();
    expect(sourceIds(editor)).toHaveLength(1);

    editor.commands.setTextSelection(positionInsideSource(editor, 0));

    expect(editor.commands.insertTransclusionSource()).toBe(true);

    const ids = sourceIds(editor);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBe(
      true,
    );
  });
});
