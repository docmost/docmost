export interface HeadingInfo {
  text: string;
  level: number;
}

export function extractHeadingsFromContent(content: any): HeadingInfo[] {
  if (!content || typeof content !== 'object') return [];

  const headings: HeadingInfo[] = [];

  function walkNodes(node: any): void {
    if (node?.type === 'heading' && node.attrs?.level && node.content) {
      const text = extractTextFromNode(node).trim();
      if (text) {
        headings.push({
          text,
          level: node.attrs.level,
        });
      }
    }

    if (Array.isArray(node?.content)) {
      node.content.forEach(walkNodes);
    }
  }

  walkNodes(content);
  return headings;
}

function extractTextFromNode(node: any): string {
  if (node.type === 'text') return node.text || '';
  return Array.isArray(node.content) ? node.content.map(extractTextFromNode).join('') : '';
}
