export const PLANTUML_DEFAULT_URL = "https://www.plantuml.com/plantuml";
export const PLANTUML_DEFAULT_FORMAT = "svg";

const PLANTUML_FORMATS = ["svg", "png"];

// PlantUML's own 64-character alphabet. This is NOT standard base64 and
// the order matters — see https://plantuml.com/text-encoding
const ALPHABET =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";

function encodeByte(value: number): string {
  return ALPHABET.charAt(value & 0x3f);
}

function encodeTriplet(b1: number, b2: number, b3: number): string {
  const c1 = b1 >> 2;
  const c2 = ((b1 & 0x3) << 4) | (b2 >> 4);
  const c3 = ((b2 & 0xf) << 2) | (b3 >> 6);
  const c4 = b3 & 0x3f;
  return encodeByte(c1) + encodeByte(c2) + encodeByte(c3) + encodeByte(c4);
}

function encodeBytes(data: Uint8Array): string {
  let result = "";
  for (let i = 0; i < data.length; i += 3) {
    if (i + 2 === data.length) {
      result += encodeTriplet(data[i], data[i + 1], 0);
    } else if (i + 1 === data.length) {
      result += encodeTriplet(data[i], 0, 0);
    } else {
      result += encodeTriplet(data[i], data[i + 1], data[i + 2]);
    }
  }
  return result;
}

/**
 * Encodes PlantUML source into the URL path segment PlantUML servers expect:
 * raw DEFLATE, then PlantUML's custom 64-character alphabet.
 * Uses the Compression Streams API for browser and Node compatibility.
 */
export async function encodePlantumlSource(source: string): Promise<string> {
  const stream = new CompressionStream("deflate-raw");
  const writer = stream.writable.getWriter();
  void writer.write(new TextEncoder().encode(source));
  void writer.close();

  const deflated = await new Response(stream.readable).arrayBuffer();
  return encodeBytes(new Uint8Array(deflated));
}

/**
 * Composes the image URL for a PlantUML server, tolerating a trailing
 * slash in the configured base URL.
 */
export async function buildPlantumlImageUrl(
  baseUrl: string,
  format: string,
  source: string,
): Promise<string> {
  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const encoded = await encodePlantumlSource(source);
  return `${normalizedBase}/${format}/${encoded}`;
}

export function normalizePlantumlFormat(value: string | undefined): string {
  const candidate = (value ?? "").toLowerCase();
  return PLANTUML_FORMATS.includes(candidate)
    ? candidate
    : PLANTUML_DEFAULT_FORMAT;
}

