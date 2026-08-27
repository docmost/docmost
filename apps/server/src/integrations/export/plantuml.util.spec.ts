import { replacePlantumlBlocksWithImages } from './plantuml.util';

describe('replacePlantumlBlocksWithImages', () => {
  const options = {
    baseUrl: 'https://plantuml.example.com',
    format: 'svg',
  };

  function docWithPlantuml() {
    return {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'plantuml' },
          content: [{ type: 'text', text: '@startuml\nA -> B\n@enduml' }],
        },
      ],
    };
  }

  let fetchSpy: jest.SpyInstance;

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  function mockFetchOk(body = '<svg>diagram</svg>') {
    fetchSpy = jest.spyOn(global, 'fetch' as any).mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from(body, 'utf8'),
    } as any);
  }

  it('replaces a plantuml code block with an image node', async () => {
    mockFetchOk();
    const result = await replacePlantumlBlocksWithImages(
      docWithPlantuml(),
      options,
    );

    const node = result.content[0];
    expect(node.type).toBe('image');
    expect(node.attrs.src).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('requests the composed PlantUML url', async () => {
    mockFetchOk();
    await replacePlantumlBlocksWithImages(docWithPlantuml(), options);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    // Computed from the raw code block text '@startuml\nA -> B\n@enduml'
    // via the real buildPlantumlImageUrl (PlantUML's DEFLATE + custom-alphabet
    // encoding) — the pipeline passes code block text through unmodified,
    // matching apps/client's plantuml-view.tsx (node.textContent -> buildPlantumlImageUrl).
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'https://plantuml.example.com/svg/SoWkIImgAStDuN9KqBLJSE9oICrB0N81',
    );
  });

  it('uses the png mime type when format is png', async () => {
    mockFetchOk();
    const result = await replacePlantumlBlocksWithImages(docWithPlantuml(), {
      ...options,
      format: 'png',
    });

    expect(result.content[0].attrs.src).toMatch(/^data:image\/png;base64,/);
  });

  it('leaves the code block untouched when the request fails', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch' as any)
      .mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await replacePlantumlBlocksWithImages(
      docWithPlantuml(),
      options,
    );

    expect(result.content[0].type).toBe('codeBlock');
    expect(result.content[0].attrs.language).toBe('plantuml');
  });

  it('leaves the code block untouched on a non-ok response', async () => {
    fetchSpy = jest
      .spyOn(global, 'fetch' as any)
      .mockResolvedValue({ ok: false, status: 400 } as any);

    const result = await replacePlantumlBlocksWithImages(
      docWithPlantuml(),
      options,
    );

    expect(result.content[0].type).toBe('codeBlock');
  });

  it('renders the diagram via the configured server', async () => {
    // Only HTML export calls this function — Markdown keeps the fenced
    // source on purpose, so it never reaches here.
    mockFetchOk();

    const result = await replacePlantumlBlocksWithImages(
      docWithPlantuml(),
      options,
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.content[0].type).toBe('image');
    expect(result.content[0].attrs.src).toMatch(/^data:image\/svg\+xml;base64,/);
  });

  it('leaves mermaid blocks untouched', async () => {
    fetchSpy = jest.spyOn(global, 'fetch' as any);

    const doc = {
      type: 'doc',
      content: [
        {
          type: 'codeBlock',
          attrs: { language: 'mermaid' },
          content: [{ type: 'text', text: 'flowchart LR\n A --> B' }],
        },
      ],
    };

    const result = await replacePlantumlBlocksWithImages(doc, options);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.content[0].type).toBe('codeBlock');
  });

  it('skips empty plantuml blocks', async () => {
    fetchSpy = jest.spyOn(global, 'fetch' as any);

    const doc = {
      type: 'doc',
      content: [
        { type: 'codeBlock', attrs: { language: 'plantuml' }, content: [] },
      ],
    };

    const result = await replacePlantumlBlocksWithImages(doc, options);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.content[0].type).toBe('codeBlock');
  });

  it('replaces plantuml blocks nested inside other nodes', async () => {
    mockFetchOk();

    const doc = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            {
              type: 'codeBlock',
              attrs: { language: 'plantuml' },
              content: [{ type: 'text', text: 'A -> B' }],
            },
          ],
        },
      ],
    };

    const result = await replacePlantumlBlocksWithImages(doc, options);

    expect(result.content[0].content[0].type).toBe('image');
  });

  it('does not mutate the input document', async () => {
    mockFetchOk();
    const doc = docWithPlantuml();
    await replacePlantumlBlocksWithImages(doc, options);

    expect(doc.content[0].type).toBe('codeBlock');
  });

  describe('when URL building fails', () => {
    it('keeps the code block instead of failing the export', async () => {
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'codeBlock',
            attrs: { language: 'plantuml' },
            content: [{ type: 'text', text: '@startuml\nA -> B\n@enduml' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'other content' }],
          },
        ],
      };

      // A non-string baseUrl makes the URL-building step throw.
      const result = await replacePlantumlBlocksWithImages(doc, {
        baseUrl: null as any,
        format: 'svg',
      });

      expect(result.content[0].type).toBe('codeBlock');
      expect(result.content[1].content[0].text).toBe('other content');
    });
  });
});
