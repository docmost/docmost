import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import {
  Button,
  Group,
  Image,
  Modal,
  useComputedColorScheme,
} from '@mantine/core';
import { useState } from 'react';
import { Excalidraw, exportToSvg, loadFromBlob } from '@excalidraw/excalidraw';
import { uploadFile } from '@/features/page/services/page-service.ts';
import { svgStringToFile } from '@/lib';
import { useDisclosure } from '@mantine/hooks';
import { getFileUrl } from '@/lib/config.ts';
import { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types/types';
import { IAttachment } from '@/lib/types';

export default function ExcalidrawView(props: NodeViewProps) {
  const { node, updateAttributes, editor } = props;
  const { src, title, width, attachmentId } = node.attrs;

  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI>(null);
  const [excalidrawData, setExcalidrawData] = useState<any>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const computedColorScheme = useComputedColorScheme();

  const handleOpen = async (event: React.MouseEvent<HTMLImageElement>) => {
    if (!editor.isEditable) {
      return;
    }

    // only respond on double click
    if (event.detail !== 2) {
      return;
    }

    try {
      const url = getFileUrl(src);
      const request = await fetch(url, { credentials: 'include' });

      const data = await loadFromBlob(await request.blob(), null, null);
      setExcalidrawData(data);
    } catch (err) {
      console.error(err);
    } finally {
      open();
    }
  };

  const handleSave = async () => {
    if (!excalidrawAPI) {
      return;
    }

    const svg = await exportToSvg({
      elements: excalidrawAPI?.getSceneElements(),
      appState: {
        exportEmbedScene: true,
        exportWithDarkMode: computedColorScheme == 'light' ? false : true,
      },
      files: excalidrawAPI?.getFiles(),
    });

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);

    const fileName = 'diagram.excalidraw.svg';

    const excalidrawSvgFile = await svgStringToFile(svgString, fileName);

    const pageId = editor.storage?.pageId;

    let attachment: IAttachment = null;
    if (attachmentId) {
      attachment = await uploadFile(excalidrawSvgFile, pageId, attachmentId);
    } else {
      attachment = await uploadFile(excalidrawSvgFile, pageId);
    }

    updateAttributes({
      src: `/files/${attachment.id}/${attachment.fileName}?t=${new Date(attachment.updatedAt).getTime()}`,
      title: attachment.fileName,
      size: attachment.fileSize,
      attachmentId: attachment.id,
    });

    close();
  };

  return (
    <NodeViewWrapper>
      <Modal.Root opened={opened} onClose={close} size={'90%'} fullScreen>
        <Modal.Overlay />
        <Modal.Content style={{ overflow: 'hidden' }}>
          <Modal.Body>
            <Group justify="flex-end">
              <Button variant="default" onClick={handleSave}>
                Save & Exit
              </Button>
              <Button onClick={close} variant="light" color="red">
                Discard
              </Button>
            </Group>
            <div style={{ height: '80vh' }}>
              <Excalidraw
                excalidrawAPI={(api) => setExcalidrawAPI(api)}
                initialData={excalidrawData}
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
