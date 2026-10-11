import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildPlantumlImageUrl,
  encodePlantumlSource,
  normalizePlantumlFormat,
} from "./plantuml-encoder";

describe("encodePlantumlSource", () => {
  // These exact values come from Node's DEFLATE implementation and were verified
  // against a live PlantUML server. DEFLATE is not bit-deterministic across
  // implementations — a browser produces a different but equally valid encoding
  // that the same server also accepts. If this suite is ever moved to a browser
  // runner, expect these two assertions to fail and replace them with the
  // round-trip test below, which holds under any implementation.
  it("encodes a sequence diagram to the known reference value", async () => {
    const source = "@startuml\nAlice -> Bob: Hello\n@enduml";
    await expect(encodePlantumlSource(source)).resolves.toBe(
      "SoWkIImgAStDuNBCoKnELT2rKt3AJx9Iy4ZDoSddSaZDIm7A0G00",
    );
  });

  it("encodes a minimal diagram to the known reference value", async () => {
    await expect(encodePlantumlSource("A -> B")).resolves.toBe(
      "SrJGjLDm0W00",
    );
  });

  it("produces only URL-safe characters", async () => {
    const encoded = await encodePlantumlSource("@startuml\nA -> B\n@enduml");
    expect(encoded).toMatch(/^[0-9A-Za-z_-]+$/);
  });

  it("handles unicode without throwing", async () => {
    await expect(
      encodePlantumlSource("A -> B: Grüße 日本"),
    ).resolves.toMatch(/^[0-9A-Za-z_-]+$/);
  });

  it("does not depend on Node built-ins", () => {
    const source = readFileSync(
      new URL("./plantuml-encoder.ts", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/from ["']zlib["']/);
    expect(source).not.toMatch(/\bBuffer\b/);
  });
});

describe("buildPlantumlImageUrl", () => {
  it("composes base url, format and encoded source", async () => {
    await expect(
      buildPlantumlImageUrl("https://example.com/plantuml", "svg", "A -> B"),
    ).resolves.toBe("https://example.com/plantuml/svg/SrJGjLDm0W00");
  });

  it("strips a trailing slash from the base url", async () => {
    await expect(
      buildPlantumlImageUrl("https://example.com/plantuml/", "svg", "A -> B"),
    ).resolves.toBe("https://example.com/plantuml/svg/SrJGjLDm0W00");
  });

  it("strips multiple trailing slashes", async () => {
    await expect(
      buildPlantumlImageUrl("https://example.com/plantuml//", "png", "A -> B"),
    ).resolves.toBe("https://example.com/plantuml/png/SrJGjLDm0W00");
  });
});

describe("normalizePlantumlFormat", () => {
  it("passes through svg and png", () => {
    expect(normalizePlantumlFormat("svg")).toBe("svg");
    expect(normalizePlantumlFormat("png")).toBe("png");
  });

  it("is case insensitive", () => {
    expect(normalizePlantumlFormat("PNG")).toBe("png");
  });

  it("falls back to svg for unknown or missing values", () => {
    expect(normalizePlantumlFormat("gif")).toBe("svg");
    expect(normalizePlantumlFormat(undefined)).toBe("svg");
    expect(normalizePlantumlFormat("")).toBe("svg");
  });
});


// Round-trip test: proves the encoding pipeline works under any DEFLATE implementation
const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

/** Test-only inverse of the encoder, to prove the pipeline round-trips. */
async function decodePlantuml(encoded: string): Promise<string> {
  const sextet = (c: string) => {
    const i = ALPHABET.indexOf(c);
    return i < 0 ? 0 : i;
  };

  const bytes: number[] = [];
  for (let i = 0; i < encoded.length; i += 4) {
    const c1 = sextet(encoded[i]);
    const c2 = sextet(encoded[i + 1]);
    const c3 = sextet(encoded[i + 2]);
    const c4 = sextet(encoded[i + 3]);
    bytes.push(
      ((c1 << 2) | (c2 >> 4)) & 255,
      ((c2 << 4) | (c3 >> 2)) & 255,
      ((c3 << 6) | c4) & 255,
    );
  }

  const stream = new DecompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  void writer.write(new Uint8Array(bytes));
  void writer.close().catch(() => {});

  // The encoder pads to whole 3-byte groups; the padding trips the stream
  // after all real output has already been read.
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
  } catch {
    // trailing padding — everything real is already in chunks
  }

  const total = chunks.reduce((n, c) => n + c.length, 0);
  const buffer = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(buffer);
}

describe("encode/decode round trip", () => {
  it.each([
    "@startuml\nAlice -> Bob: Hello\n@enduml",
    "A -> B",
    "A -> B: Grüße 日本",
  ])("recovers the original source: %s", async (source) => {
    const encoded = await encodePlantumlSource(source);
    await expect(decodePlantuml(encoded)).resolves.toBe(source);
  });
});
