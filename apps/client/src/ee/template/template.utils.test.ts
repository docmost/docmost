import { describe, expect, it } from "vitest";
import { withoutUploadPlaceholders } from "./template.utils";

const uploading = (type: string) => ({
  type,
  attrs: { src: null, attachmentId: null, placeholder: { id: "p1", name: "a.png" } },
});

describe("withoutUploadPlaceholders", () => {
  it("turns media that is still uploading into empty paragraphs, at any depth", () => {
    const content = {
      type: "doc",
      content: [
        uploading("image"),
        {
          type: "columns",
          content: [
            { type: "column", content: [uploading("video")] },
            { type: "column", content: [uploading("attachment")] },
          ],
        },
      ],
    };

    expect(withoutUploadPlaceholders(content)).toEqual({
      type: "doc",
      content: [
        { type: "paragraph" },
        {
          type: "columns",
          content: [
            { type: "column", content: [{ type: "paragraph" }] },
            { type: "column", content: [{ type: "paragraph" }] },
          ],
        },
      ],
    });
  });

  it("keeps uploaded media and other nodes as they are", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "image",
          attrs: { src: "/api/files/f1/a.png", attachmentId: "f1", placeholder: null },
        },
        { type: "paragraph", content: [{ type: "text", text: "Agenda" }] },
      ],
    };

    expect(withoutUploadPlaceholders(content)).toEqual(content);
  });

  it("does not change the content it is given", () => {
    const content = { type: "doc", content: [uploading("pdf")] };
    const before = structuredClone(content);

    withoutUploadPlaceholders(content);

    expect(content).toEqual(before);
  });
});
