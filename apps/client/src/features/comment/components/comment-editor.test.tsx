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

it("keeps colored text in table cells and nested tasks when a reply is edited", () => {
  const { getByLabelText } = render(<CommentEditor editable />);
  const { editor } = getByLabelText("Comment") as HTMLElement & {
    editor: Editor;
  };
  act(() => {
    editor.commands.setContent(
      '<table><tr><td><p><span data-text-color="#13579b" style="color: #13579b">Owner</span></p></td></tr></table>' +
        '<ul data-type="taskList"><li data-type="taskItem"><p>Review</p>' +
        '<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><p>Done</p></li></ul></li></ul>',
    );
  });
  const table = editor.state.doc.child(0);
  expect(table.type.name).toBe("table");
  const cell = table.child(0).child(0);
  expect(cell.child(0).child(0).toJSON()).toMatchObject({
    text: "Owner",
    marks: [{ type: "textStyle", attrs: { color: "#13579b" } }],
  });
  const tasks = editor.state.doc.child(1);
  expect(tasks.type.name).toBe("taskList");
  expect(tasks.child(0).child(1).toJSON()).toMatchObject({
    type: "taskList",
    content: [{ type: "taskItem", attrs: { checked: true } }],
  });
});
