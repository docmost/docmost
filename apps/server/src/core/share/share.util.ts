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

function updateAttachmentUrl(src: string, jwtToken: string) {
  const updatedSrc = src.replace('/files/', '/files/public/');
  const separator = updatedSrc.includes('?') ? '&' : '?';
  return `${updatedSrc}${separator}jwt=${jwtToken}`;
}

export function canReadShares({
  workspaceSettings,
  spaceSettings,
  archivedAt,
}: {
  workspaceSettings: unknown;
  spaceSettings: unknown;
  archivedAt: Date | null;
}): boolean {
  const workspaceDisabled =
    (workspaceSettings as any)?.sharing?.disabled === true;
  const spaceDisabled = (spaceSettings as any)?.sharing?.disabled === true;

  return !workspaceDisabled && !spaceDisabled && !archivedAt;
}
