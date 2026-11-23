import { act, render } from "@testing-library/react";
import { type Editor, type JSONContent } from "@tiptap/core";
import { expect, it, vi } from "vitest";
import CommentEditor from "./comment-editor";

vi.mock("@/main.tsx", async () => ({
  queryClient: new (await import("@tanstack/react-query")).QueryClient(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (text: string) => text }),
}));

const image = {
  type: "image",
  attrs: {
    src: "/api/files/4b9c834f-c781-49ec-9826-f935ab574830/diagram.png",
    attachmentId: "4b9c834f-c781-49ec-9826-f935ab574830",
    alt: "Thread diagram",
  },
};
const thread = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Review", marks: [{ type: "bold" }] }],
    },
    { ...image, attrs: { ...image.attrs, width: 800, height: 400 } },
  ],
};

it("renders an imported attachment alongside the existing formatted comment", () => {
  const { getByAltText, getByText } = render(
    <CommentEditor editable={false} defaultContent={thread} />,
  );
  const img = getByAltText("Thread diagram");
  expect(img.getAttribute("src")).toBe(image.attrs.src);
  expect(img.hasAttribute("width")).toBe(false);
  expect(img.hasAttribute("height")).toBe(false);
  expect(getByText("Review").tagName).toBe("STRONG");
});

it("keeps the attachment in image-only JSON when an editor removes the last text", () => {
  const update = vi.fn<(content: JSONContent) => void>();
  const { getByLabelText } = render(
    <CommentEditor editable onUpdate={update} defaultContent={thread} />,
  );
  const { editor } = getByLabelText("Comment") as HTMLElement & {
    editor: Editor;
  };
  expect(editor.getText().trim()).toBe("Review");
  act(() => {
    editor.commands.deleteRange({ from: 1, to: 7 });
  });
  expect(editor.getText().trim()).toBe("");
  const images = update.mock.lastCall?.[0].content.filter(
    (node) => node.type === "image",
  );
  expect(images).toMatchObject([image]);
});

it("preserves attachment and web images copied into an empty reply", () => {
  const update = vi.fn<(content: JSONContent) => void>();
  const { getByLabelText } = render(
    <CommentEditor editable onUpdate={update} />,
  );
  const { editor } = getByLabelText("Comment") as HTMLElement & {
    editor: Editor;
  };
  const webSrc = "https://images.example.org/review%20graph.png";
  act(() => {
    editor.view.pasteHTML(
      `<img src="${image.attrs.src}" alt="Thread diagram" data-attachment-id="${image.attrs.attachmentId}">
       <img src="${webSrc}" alt="2026"><img src="unresolved.png">`,
      new Event("paste") as ClipboardEvent,
    );
  });
  const images = update.mock.lastCall?.[0].content.filter(
    (node) => node.type === "image",
  );
  expect(images).toMatchObject([
    image,
    { type: "image", attrs: { src: webSrc, alt: "2026" } },
  ]);
  expect(editor.getText().trim()).toBe("");
});

it("pastes table cells in order and saves their contents as ordinary comment blocks", () => {
  const href = "https://example.org/guide";
  const update = vi.fn<(content: JSONContent) => void>();
  const { container, getByLabelText, getByRole, rerender } = render(
    <CommentEditor editable onUpdate={update} />,
  );
  const { editor } = getByLabelText("Comment") as HTMLElement & {
    editor: Editor;
  };
  expect(editor.schema.nodes.table).toBeUndefined();
  act(() => {
    editor.view.pasteHTML(
      '<table><tr><th>Team</th><td><span data-text-color="#13579b" style="color: #13579b">Owner</span></td></tr>' +
        `<tr><td><p><a href="${href}">Guide</a></p><p>Next</p></td>` +
        `<td><img src="${image.attrs.src}" alt="Thread diagram" data-attachment-id="${image.attrs.attachmentId}"></td></tr></table>` +
        '<ul data-type="taskList"><li data-type="taskItem"><p>Review</p>' +
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Done</p></li></ul></li></ul>',
      new Event("paste") as ClipboardEvent,
    );
  });
  const saved = update.mock.lastCall[0];
  expect(saved.content.slice(0, 5)).toMatchObject([
    { type: "paragraph", content: [{ text: "Team" }] },
    {
      type: "paragraph",
      content: [
        { text: "Owner", marks: [{ type: "textStyle", attrs: { color: "#13579b" } }] },
      ],
    },
    {
      type: "paragraph",
      content: [{ text: "Guide", marks: [{ type: "link", attrs: { href } }] }],
    },
    { type: "paragraph", content: [{ text: "Next" }] },
    image,
  ]);
  const tasks = editor.state.doc.child(5);
  expect(tasks.type.name).toBe("taskList");
  expect(tasks.child(0).child(1).toJSON()).toMatchObject({
    type: "taskList",
    content: [{ type: "taskItem", attrs: { checked: true } }],
  });

  rerender(
    <CommentEditor key="saved" editable={false} defaultContent={saved} />,
  );
  expect(container.querySelector("table")).toBeNull();
  expect(getByRole("link", { name: "Guide" }).getAttribute("href")).toBe(href);
  expect(getByRole("img", { name: "Thread diagram" }).getAttribute("src")).toBe(
    image.attrs.src,
  );
});
