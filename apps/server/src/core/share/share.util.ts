import { Node } from '@tiptap/pm/model';

export function updateAttachmentAttr(
  node: Node,
  attr: 'src' | 'url',
  token: string,
) {
  const attrVal = node.attrs[attr];
  if (
    attrVal &&
    (attrVal.startsWith('/files') || attrVal.startsWith('/api/files'))
  ) {
    // @ts-ignore
    node.attrs[attr] = updateAttachmentUrl(attrVal, token);
  }
}

function encodePathsInUrl(src: string) {
  if (src.includes('?')) {
    const index = src.indexOf('?');
    const base = src.substring(0, index);
    const query = src.substring(index + 1);

    const encodedBase = base.split('/').map(encodeURIComponent).join('/');
    return `${encodedBase}?${query}`;
  }

  return src.split('/').map(encodeURIComponent).join('/');
}

function updateAttachmentUrl(src: string, jwtToken: string) {
  const updatedSrc = src.replace('/files/', '/files/public/');
  const encodedSrc = encodePathsInUrl(updatedSrc);
  const separator = updatedSrc.includes('?') ? '&' : '?';
  return `${encodedSrc}${separator}jwt=${jwtToken}`;
}
