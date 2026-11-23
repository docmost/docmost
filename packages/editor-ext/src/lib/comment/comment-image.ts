import { Node } from '@tiptap/core';
import { normalizeFileUrl } from '../media-utils';
import { isHttpUrl, isInternalFileUrl, sanitizeUrl } from '../utils';

export function getCommentImageSrc(src: unknown): string {
  if (typeof src !== 'string') return '';
  const url = sanitizeUrl(src);
  return isInternalFileUrl(url) || isHttpUrl(url) ? normalizeFileUrl(url) : '';
}

export const CommentImage = Node.create({
  name: 'image',
  group: 'block',

  addAttributes() {
    return {
      src: { default: null },
      alt: {
        default: '',
        parseHTML: (element) => element.getAttribute('alt'),
      },
      attachmentId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-attachment-id'),
        renderHTML: ({ attachmentId }) => ({
          'data-attachment-id': attachmentId,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'img[src]',
        getAttrs: (element) =>
          getCommentImageSrc(element.getAttribute('src')) ? null : false,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'img',
      {
        ...HTMLAttributes,
        src: getCommentImageSrc(HTMLAttributes.src) || null,
        class: 'comment-image',
      },
    ];
  },
});
