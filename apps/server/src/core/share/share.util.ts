import { Node } from '@tiptap/pm/model';
import { PagePermissionRepo } from '@docmost/db/repos/page/page-permission.repo';

// Restricted pages and pages under an unpublished approval page are never public.
export async function isHiddenFromPublic(
  pagePermissionRepo: Pick<
    PagePermissionRepo,
    'hasRestrictedAncestor' | 'hasUnpublishedAncestor'
  >,
  pageId: string,
): Promise<boolean> {
  const [restricted, unpublished] = await Promise.all([
    pagePermissionRepo.hasRestrictedAncestor(pageId),
    pagePermissionRepo.hasUnpublishedAncestor(pageId),
  ]);
  return restricted || unpublished;
}

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
