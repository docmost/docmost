import { getSchema } from "@tiptap/core";
import { Document } from "@tiptap/extension-document";
import { Text } from "@tiptap/extension-text";
import { TiptapImage } from "@docmost/editor-ext";
import { describe, expect, it } from "vitest";
import { getLightboxClickRequest } from "../common/lightbox-view";
import { publicImageLink } from "./public-image-link";

describe("linked images", () => {
  const href = "/s/team/p/training-abc123#rollback";

  it("opens an ordinary image in the lightbox and lets a link receive the click", () => {
    const schema = getSchema([Document, Text, TiptapImage]);
    const image = (href?: string) =>
      schema.nodes.image.create({
        href,
        src: "/api/files/attachment/training.png",
      });
    expect(getLightboxClickRequest(image())).toMatchObject({ type: "image" });
    expect(getLightboxClickRequest(image(href))).toBeNull();
  });

  it("follows page and section links within the current share or published space", () => {
    expect(publicImageLink(href, "my-share")).toBe(
      "/share/my-share/p/training-abc123#rollback",
    );
    expect(publicImageLink(href, undefined, "team")).toBe(
      "/docs/team/training-abc123#rollback",
    );
    expect(publicImageLink(href, undefined, "another-space")).toBe(href);
    const external = "https://example.com/s/team/p/training-abc123";
    expect(publicImageLink(external, "my-share")).toBe(external);
  });
});
