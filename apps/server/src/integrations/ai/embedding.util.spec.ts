import { chunkText, toVectorLiteral } from './embedding.util';

describe('embedding.util', () => {
  describe('chunkText', () => {
    it('returns no chunks for empty/whitespace input', async () => {
      expect(await chunkText('')).toEqual([]);
      expect(await chunkText('   \n\t ')).toEqual([]);
      expect(await chunkText(null as any)).toEqual([]);
    });

    it('produces a single chunk for short text', async () => {
      const chunks = await chunkText('hello world');
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toMatchObject({ text: 'hello world', index: 0, start: 0 });
      expect(chunks[0].length).toBe('hello world'.length);
    });

    it('splits long text into sequential, in-order chunks', async () => {
      const para = Array.from({ length: 40 }, (_, i) => `Sentence number ${i}.`).join(' ');
      const chunks = await chunkText(para, { chunkSize: 100, chunkOverlap: 20 });

      expect(chunks.length).toBeGreaterThan(1);
      // indices are 0..n-1 in order
      expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i));
      // starts are non-decreasing
      for (let i = 1; i < chunks.length; i++) {
        expect(chunks[i].start).toBeGreaterThanOrEqual(chunks[i - 1].start);
      }
      // every chunk is real text from the source
      for (const c of chunks) {
        expect(c.text.length).toBeGreaterThan(0);
        expect(c.length).toBe(c.text.length);
        expect(para).toContain(c.text);
      }
    });

    it('is deterministic', async () => {
      const text = 'a '.repeat(500);
      const a = await chunkText(text, { chunkSize: 80, chunkOverlap: 10 });
      const b = await chunkText(text, { chunkSize: 80, chunkOverlap: 10 });
      expect(a).toEqual(b);
    });
  });

  describe('toVectorLiteral', () => {
    it('formats a number array as a pgvector literal', () => {
      expect(toVectorLiteral([0.1, 0.2, -0.3])).toBe('[0.1,0.2,-0.3]');
      expect(toVectorLiteral([])).toBe('[]');
    });
  });
});
