import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { Image, Modal } from '@mantine/core';
import { useRef, useState } from 'react';
import { uploadFile } from '@/features/page/services/page-service.ts';
import { useDisclosure } from '@mantine/hooks';
import { getFileUrl } from '@/lib/config.ts';
import { DrawIoEmbed, DrawIoEmbedRef, EventSave } from 'react-drawio';
import { IAttachment } from '@/lib/types';
import { decodeBase64ToSvgString, svgStringToFile } from '@/lib/utils';

export default function DrawioView(props: NodeViewProps) {
  const { node, updateAttributes, editor } = props;
  const { src, title, width } = node.attrs;
  const drawioRef = useRef<DrawIoEmbedRef>(null);
  const [initialXML, setInitialXML] = useState<string>('');
  const [opened, { open, close }] = useDisclosure(false);

  const handleOpen = async () => {
    if (!editor.isEditable) {
      return;
    }

    try {
      const url = getFileUrl(src);
      const request = await fetch(window.decodeURIComponent(url));
      const blob = await request.blob();

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        let base64data = (reader.result || '') as string;
        setInitialXML(base64data);
      };
    } catch (err) {
      console.error(err);
    } finally {
      open();
    }
  };

  const handleSave = async (data: EventSave) => {
    const svgString = decodeBase64ToSvgString(data.xml);

    const fileName = 'diagram.drawio.svg';
    const drawioSVGFile = await svgStringToFile(svgString, fileName);

    const pageId = editor.storage?.pageId;

    const attachment = (await uploadFile(
      drawioSVGFile,
      pageId
    )) as unknown as IAttachment;

    updateAttributes({
      src: `/files/${attachment.id}/${attachment.fileName}`,
      title: attachment.fileName,
      size: attachment.fileSize,
      attachmentId: attachment.id,
    });

    close();
  };

  return (
    <NodeViewWrapper>
      <Modal.Root opened={opened} onClose={close} fullScreen>
        <Modal.Overlay />
        <Modal.Content style={{ overflow: 'hidden' }}>
          <Modal.Body>
            <div style={{ height: '100vh' }}>
              <DrawIoEmbed
                ref={drawioRef}
                xml={initialXML}
                urlParameters={{
                  ui: 'kennedy',
                  spin: true,
                  libraries: true,
                  saveAndExit: true,
                  noSaveBtn: true,
                }}
                onSave={(data: EventSave) => {
                  // If the save is triggered by another event, then do nothing
                  if (data.parentEvent !== 'save') {
                    return;
                  }
                  handleSave(data);
                }}
                onClose={(data) => {
                  // If the exit is triggered by another event, then do nothing
                  if (data.parentEvent) {
                    return;
                  }
                  close();
                }}
              />
            </div>
          </Modal.Body>
        </Modal.Content>
      </Modal.Root>

      <Image
        onClick={handleOpen}
        radius="md"
        fit="contain"
        src={getFileUrl(src)}
        width={width}
        fallbackSrc="https://placehold.co/600x25?text=click%20to%20draw"
        alt={title}
      />
    </NodeViewWrapper>
  );
}
