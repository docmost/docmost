import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import {
  decodeBlob,
  encodeYdocBlob,
} from "@/features/encryption/services/encrypted-blob";
import { MalformedEncryptedDataError } from "@/features/encryption/services/encryption-errors";

const jsonBlob = (content: unknown) =>
  new TextEncoder().encode(JSON.stringify(content));

describe("decodeBlob", () => {
  it("reads a v2 Yjs container", () => {
    const doc = new Y.Doc();
    doc.getText("body").insert(0, "hello");
    const encoded = encodeYdocBlob(doc);

    const decoded = decodeBlob(encoded);
    expect(decoded.kind).toBe("ydoc");

    if (decoded.kind !== "ydoc") throw new Error("expected a ydoc blob");
    const restored = new Y.Doc();
    Y.applyUpdate(restored, decoded.update);
    expect(restored.getText("body").toString()).toBe("hello");
  });

  it("still reads a v1 JSON container written by earlier builds", () => {
    const content = { type: "doc", content: [{ type: "paragraph" }] };
    const decoded = decodeBlob(jsonBlob(content));

    expect(decoded.kind).toBe("json");
    if (decoded.kind !== "json") throw new Error("expected a json blob");
    expect(decoded.content).toEqual(content);
  });

  it("reports an unrecognised container rather than failing inside JSON.parse", () => {
    // e.g. a container written by a newer client: saying "unrecognised format"
    // is actionable, while a JSON syntax error on binary is not
    const future = new Uint8Array([
      0x44, 0x4d, 0x59, 0x44, 0x39, 0x3a, 1, 2, 3,
    ]);
    expect(() => decodeBlob(future)).toThrow(MalformedEncryptedDataError);
  });

  it("reports truncated JSON as malformed", () => {
    const truncated = new TextEncoder().encode('{"type":"doc"');
    expect(() => decodeBlob(truncated)).toThrow(MalformedEncryptedDataError);
  });

  it("never mistakes a Yjs update for JSON", () => {
    // the v2 marker cannot collide with v1, whose first byte is always "{"
    const doc = new Y.Doc();
    doc.getMap("m").set("k", "v");
    expect(decodeBlob(encodeYdocBlob(doc)).kind).toBe("ydoc");
  });
});
