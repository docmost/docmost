import { jsonToNode } from 'src/collaboration/collaboration.util';
import { ExportFormat } from './dto/export-dto';
import { Node } from '@tiptap/pm/model';
import { validate as isValidUUID } from 'uuid';
import * as path from 'path';
import { Page } from '@docmost/db/types/entity.types';

export type PageExportTree = Record<string, Page[]>;

export function getExportExtension(format: string) {
  if (format === ExportFormat.HTML) {
    return '.html';
  }

  if (format === ExportFormat.Markdown) {
    return '.md';
  }
  return;
}

export function getPageTitle(title: string) {
  return title ? title : 'untitled';
}

export function getProsemirrorContent(content: any) {
  return (
    content ?? {
      type: 'doc',
      content: [{ type: 'paragraph', attrs: { textAlign: 'left' } }],
    }
  );
}

export function getAttachmentIds(prosemirrorJson: any) {
  const doc = jsonToNode(prosemirrorJson);
  const attachmentIds = [];

  doc?.descendants((node: Node) => {
    if (isAttachmentNode(node.type.name)) {
      if (node.attrs.attachmentId && isValidUUID(node.attrs.attachmentId)) {
        if (!attachmentIds.includes(node.attrs.attachmentId)) {
          attachmentIds.push(node.attrs.attachmentId);
        }
      }
    }
  });

  return attachmentIds;
}

export function isAttachmentNode(nodeType: string) {
  const attachmentNodeTypes = [
    'attachment',
    'image',
    'video',
    'excalidraw',
    'drawio',
  ];
  return attachmentNodeTypes.includes(nodeType);
}

export function updateAttachmentUrls(prosemirrorJson: any) {
  const doc = jsonToNode(prosemirrorJson);

  doc?.descendants((node: Node) => {
    if (isAttachmentNode(node.type.name)) {
      if (node.attrs.src && node.attrs.src.startsWith('/files')) {
        //@ts-expect-error
        node.attrs.src = node.attrs.src.replace('/files', 'files');
      } else if (node.attrs.url && node.attrs.url.startsWith('/files')) {
        //@ts-expect-error
        node.attrs.url = node.attrs.url.replace('/files', 'files');
      }
    }
  });

  return doc.toJSON();
}

export function replaceInternalLinks(
  prosemirrorJson: any,
  slugIdToPath: Record<string, string>,
  currentPagePath: string,
) {
  const doc = jsonToNode(prosemirrorJson);
  const internalLinkRegex =
    /^(https?:\/\/)?([^\/]+)?(\/s\/([^\/]+)\/)?p\/([a-zA-Z0-9-]+)\/?$/;

  doc.descendants((node: Node) => {
    for (const mark of node.marks) {
      if (mark.type.name === 'link' && mark.attrs.href) {
        const match = mark.attrs.href.match(internalLinkRegex);
        if (match) {
          const markLink = mark.attrs.href;

          const slugId = extractPageSlugId(match[5]);
          const localPath = slugIdToPath[slugId];

          if (!localPath) {
            continue;
          }

          const relativePath = computeRelativePath(currentPagePath, localPath);

          //@ts-expect-error
          mark.attrs.href = relativePath;
          //@ts-expect-error
          mark.attrs.target = '_self';
          if (node.isText) {
            // if link and text are same, use page title
            if (markLink === node.text) {
              //@ts-expect-error
              node.text = getInternalLinkPageName(relativePath);
            }
          }
        }
      }
    }
  });

  return doc.toJSON();
}

export function getInternalLinkPageName(path: string): string {
  return decodeURIComponent(
    path?.split('/').pop().split('.').slice(0, -1).join('.'),
  );
}

export function extractPageSlugId(input: string): string {
  if (!input) {
    return undefined;
  }
  const parts = input.split('-');
  return parts.length > 1 ? parts[parts.length - 1] : input;
}

export function buildTree(pages: Page[]): PageExportTree {
  const tree: PageExportTree = {};
  const titleCount: Record<string, Record<string, number>> = {};

  for (const page of pages) {
    const parentPageId = page.parentPageId;

    if (!titleCount[parentPageId]) {
      titleCount[parentPageId] = {};
    }

    let title = getPageTitle(page.title);

    if (titleCount[parentPageId][title]) {
      title = `${title} (${titleCount[parentPageId][title]})`;
      titleCount[parentPageId][getPageTitle(page.title)] += 1;
    } else {
      titleCount[parentPageId][title] = 1;
    }

    page.title = title;
    if (!tree[parentPageId]) {
      tree[parentPageId] = [];
    }
    tree[parentPageId].push(page);
  }
  return tree;
}

export function computeLocalPath(
  tree: PageExportTree,
  format: string,
  parentPageId: string | null,
  currentPath: string,
  slugIdToPath: Record<string, string>,
) {
  const children = tree[parentPageId] || [];

  for (const page of children) {
    const title = encodeURIComponent(getPageTitle(page.title));
    const localPath = `${currentPath}${title}`;
    slugIdToPath[page.slugId] = `${localPath}${getExportExtension(format)}`;

    computeLocalPath(tree, format, page.id, `${localPath}/`, slugIdToPath);
  }
}

function computeRelativePath(from: string, to: string) {
  return path.relative(path.dirname(from), to);
}
