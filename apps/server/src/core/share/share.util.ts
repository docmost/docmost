import { Node } from '@tiptap/pm/model';
import { validate as isValidUUID } from 'uuid';
import { isAttachmentNode } from '../../common/helpers/prosemirror/utils';
import { getAttachmentIdFromUrl } from '../../common/helpers/prosemirror/attachment-refs';

/**
 * The attachment a node points to: its `attachmentId`, or the id in its file
 * url. Content that the editor did not write (markdown or html sent through
 * the API, imports) only has the url.
 */
export function getNodeAttachmentId(node: Node): string | undefined {
  if (!isAttachmentNode(node.type.name)) return undefined;
  const { attachmentId, src, url } = node.attrs;
  if (isValidUUID(attachmentId)) return attachmentId;
  return getIdFromRelativeUrl(src) ?? getIdFromRelativeUrl(url);
}

// Only this instance's own file urls: an absolute url can be an image on
// another host whose path happens to look like one.
function getIdFromRelativeUrl(url: unknown): string | undefined {
  return typeof url === 'string' && url.startsWith('/')
    ? getAttachmentIdFromUrl(url)
    : undefined;
}

export function updateAttachmentAttr(
  node: Node,
  attr: 'src' | 'url',
  token: string,
) {
  // Older content can store absolute file urls (https://host/api/files/...).
  const attrVal: string | undefined = node.attrs[attr]?.replace(
    /^https?:\/\/[^/]+/,
    '',
  );
  if (
    attrVal &&
    (attrVal.startsWith('/files') || attrVal.startsWith('/api/files')) &&
    !attrVal.includes('/files/public/')
  ) {
    // @ts-ignore
    node.attrs[attr] = updateAttachmentUrl(attrVal, token);
  }
}

export function updateAttachmentUrl(src: string, jwtToken: string) {
  const updatedSrc = src.replace('/files/', '/files/public/');
  const separator = updatedSrc.includes('?') ? '&' : '?';
  return `${updatedSrc}${separator}jwt=${jwtToken}`;
}
