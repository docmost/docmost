import { Logger } from '@nestjs/common';
import { buildPlantumlImageUrl } from '@docmost/editor-ext';

const logger = new Logger('PlantumlExport');

const DEFAULT_TIMEOUT_MS = 10_000;

export interface PlantumlExportOptions {
  baseUrl: string;
  format: string;
  timeoutMs?: number;
}

function mimeTypeFor(format: string): string {
  return format === 'png' ? 'image/png' : 'image/svg+xml';
}

function collectPlantumlNodes(node: any, found: any[]): void {
  if (!node || typeof node !== 'object') return;

  if (
    node.type === 'codeBlock' &&
    node.attrs?.language === 'plantuml' &&
    getNodeText(node).length > 0
  ) {
    found.push(node);
  }

  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      collectPlantumlNodes(child, found);
    }
  }
}

function getNodeText(node: any): string {
  if (!Array.isArray(node.content)) return '';
  return node.content
    .map((child: any) => (typeof child.text === 'string' ? child.text : ''))
    .join('');
}

async function fetchDiagram(
  source: string,
  options: PlantumlExportOptions,
): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const url = await buildPlantumlImageUrl(
      options.baseUrl,
      options.format,
      source,
    );
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      logger.warn(
        `PlantUML server responded with ${response.status}; keeping the code block`,
      );
      return null;
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${mimeTypeFor(options.format)};base64,${buffer.toString('base64')}`;
  } catch (err: any) {
    logger.warn(
      `Could not render PlantUML diagram, keeping the code block: ${err?.message}`,
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Replaces PlantUML code blocks with image nodes so that exports contain
 * rendered diagrams instead of source.
 *
 * Rendering goes through PLANTUML_URL, the same server the editor preview
 * uses.
 *
 * A failure never breaks the export: the original code block is kept.
 */
export async function replacePlantumlBlocksWithImages(
  prosemirrorJson: any,
  options: PlantumlExportOptions,
): Promise<any> {
  const clone = structuredClone(prosemirrorJson);

  const nodes: any[] = [];
  collectPlantumlNodes(clone, nodes);

  if (nodes.length === 0) {
    return clone;
  }

  const rendered = await Promise.all(
    nodes.map((node) => fetchDiagram(getNodeText(node), options)),
  );

  nodes.forEach((node, index) => {
    const dataUri = rendered[index];
    if (!dataUri) return;

    // Mutate in place so the node keeps its position in the tree.
    const alt = 'PlantUML diagram';
    delete node.content;
    node.type = 'image';
    node.attrs = { src: dataUri, alt };
  });

  return clone;
}
