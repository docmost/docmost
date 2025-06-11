

interface DocNode {
  type: string;
  attrs?: any;
  content: Array<{ type: string; text: string; marks?: any[] }>;
}

async function importEsmModule<T>(name: string): Promise<T> {
  const module = eval(`(async () => {return await import("${name}")})()`);
  return module as T;
}

export async function extractDocNodeFromPDF(buffer: Buffer) {
  const { getDocument } = await importEsmModule<any>(
    'pdfjs-dist/legacy/build/pdf.mjs',
  );

  const uint8Array = new Uint8Array(buffer);
  const loadingTask = getDocument({ data: uint8Array });
  const pdf = await loadingTask.promise;

  const docNode: any = { type: 'doc', content: [] };

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    let subContent = [];
    let mainContent = null;
    let line ='';
    content.items.forEach((item: any) => {
      const hasEOL = !!item.hasEOL;
      const text = item.str.trim();

      const fontSize = item.transform[0]; // crude approximation
      if (mainContent == null) {
        if (fontSize > 20) {
          mainContent = {
            type: 'heading',
            attrs: { level: 1, textAlign: 'left' },
          };
        } else if (fontSize > 14) {
          mainContent = {
            type: 'heading',
            attrs: { level: 2, textAlign: 'left' },
          };
        }
        else if (fontSize > 12) {
          mainContent = {
            type: 'heading',
            attrs: { level: 3, textAlign: 'left' },
          };
        }else {
          mainContent = {
            type: 'paragraph',
            attrs: { textAlign: 'left' },
          };
        }
      }
      line += text? text : ' ';
      if (hasEOL === true) {
        subContent.push({ type: 'text', text: line });
        mainContent.content = JSON.parse(JSON.stringify(subContent));
        docNode.content.push(JSON.parse(JSON.stringify(mainContent)));
        subContent = [];
        mainContent = null;
        line = '';
      }
    });
  }

  return docNode;
}
