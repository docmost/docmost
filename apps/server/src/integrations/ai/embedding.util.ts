import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

export interface TextChunk {
  text: string;
  index: number;
  start: number;
  length: number;
}

/**
 * Splits page text into overlapping chunks for embedding. Deterministic.
 * Returns each chunk with its sequence index and best-effort source offset.
 */
export async function chunkText(
  text: string,
  opts: { chunkSize?: number; chunkOverlap?: number } = {},
): Promise<TextChunk[]> {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return [];

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: opts.chunkSize ?? 1000,
    chunkOverlap: opts.chunkOverlap ?? 200,
  });
  const parts = await splitter.splitText(trimmed);

  let searchFrom = 0;
  return parts.map((part, index) => {
    let start = trimmed.indexOf(part, searchFrom);
    if (start < 0) start = trimmed.indexOf(part);
    if (start < 0) start = searchFrom;
    // advance by 1 so the next (overlapping) chunk is still found in order
    searchFrom = start + 1;
    return { text: part, index, start, length: part.length };
  });
}

/** Serializes a number[] into the pgvector text literal form: [1,2,3]. */
export function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
