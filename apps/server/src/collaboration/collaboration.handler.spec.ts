import * as Y from 'yjs';
import { TiptapTransformer } from '@hocuspocus/transformer';
import { removeAttachmentNodes } from './collaboration.handler';
import { tiptapExtensions } from './collaboration.util';

describe('removeAttachmentNodes', () => {
  it('removes matching attachment nodes at any depth', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('default');

    const topLevelImage = new Y.XmlElement('image');
    topLevelImage.setAttribute('attachmentId', 'attachment-1');

    const wrapper = new Y.XmlElement('wrapper');
    const nestedAttachment = new Y.XmlElement('attachment');
    nestedAttachment.setAttribute('attachmentId', 'attachment-1');
    const retainedImage = new Y.XmlElement('image');
    retainedImage.setAttribute('attachmentId', 'attachment-2');
    wrapper.insert(0, [nestedAttachment, retainedImage]);

    fragment.insert(0, [topLevelImage, wrapper]);

    expect(removeAttachmentNodes(fragment, 'attachment-1')).toBe(2);
    expect(fragment.length).toBe(1);
    expect(wrapper.length).toBe(1);
    expect((wrapper.get(0) as Y.XmlElement).getAttribute('attachmentId')).toBe(
      'attachment-2',
    );
  });

  it('is idempotent when the attachment is already absent', () => {
    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('default');
    const paragraph = new Y.XmlElement('paragraph');
    fragment.insert(0, [paragraph]);

    expect(removeAttachmentNodes(fragment, 'missing')).toBe(0);
    expect(fragment.length).toBe(1);
  });

  it('removes nodes from the real Tiptap Yjs document shape', () => {
    const doc = TiptapTransformer.toYdoc(
      {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Keep me' }],
          },
          {
            type: 'image',
            attrs: {
              src: '/api/files/attachment-1/diagram.png',
              attachmentId: 'attachment-1',
            },
          },
        ],
      },
      'default',
      tiptapExtensions,
    );

    expect(
      removeAttachmentNodes(doc.getXmlFragment('default'), 'attachment-1'),
    ).toBe(1);

    const result = TiptapTransformer.fromYdoc(doc, 'default');
    expect(result.content).toEqual([
      expect.objectContaining({
        type: 'paragraph',
        content: [{ type: 'text', text: 'Keep me' }],
      }),
    ]);
  });
});
