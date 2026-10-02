import { Node } from '@tiptap/pm/model';

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

function updateAttachmentUrl(src: string, jwtToken: string) {
  const updatedSrc = src.replace('/files/', '/files/public/');
  const separator = updatedSrc.includes('?') ? '&' : '?';
  return `${updatedSrc}${separator}jwt=${jwtToken}`;
}
