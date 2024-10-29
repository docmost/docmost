import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { ActionIcon, Card, Image, Modal, Text, useComputedColorScheme } from '@mantine/core';
import { useRef, useState } from 'react';
import { uploadFile } from '@/features/page/services/page-service.ts';
import { useDisclosure } from '@mantine/hooks';
import { getFileUrl } from '@/lib/config.ts';
import {
  DrawIoEmbed,
  DrawIoEmbedRef,
  EventExit,
  EventSave,
} from 'react-drawio';
import { IAttachment } from '@/lib/types';
import { decodeBase64ToSvgString, svgStringToFile } from '@/lib/utils';
import clsx from 'clsx';
import { IconEdit } from '@tabler/icons-react';

export default function DrawioView(props: NodeViewProps) {
  const { node, updateAttributes, editor, selected } = props;
  const { src, title, width, attachmentId } = node.attrs;
  const drawioRef = useRef<DrawIoEmbedRef>(null);
  const [initialXML, setInitialXML] = useState<string>('');
  const [opened, { open, close }] = useDisclosure(false);
  const computedColorScheme = useComputedColorScheme();

  const handleOpen = async () => {
    if (!editor.isEditable) {
      return;
    }

    try {
      if (src) {
        const url = getFileUrl(src);
        const request = await fetch(url, {
          credentials: 'include',
          cache: 'no-store',
        });
        const blob = await request.blob();

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          let base64data = (reader.result || '') as string;
          setInitialXML(base64data);
        };
      }
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

    let attachment: IAttachment = null;

    if (attachmentId) {
      attachment = await uploadFile(drawioSVGFile, pageId, attachmentId);
    } else {
      attachment = await uploadFile(drawioSVGFile, pageId);
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
      <Modal.Root opened={opened} onClose={close} fullScreen>
        <Modal.Overlay />
        <Modal.Content style={{ overflow: 'hidden' }}>
          <Modal.Body>
            <div style={{ height: '100vh' }}>
              <DrawIoEmbed
                ref={drawioRef}
                xml={initialXML}
                urlParameters={{
                  ui: computedColorScheme === 'light' ? 'kennedy' : 'dark',
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
                onClose={(data: EventExit) => {
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

      {src ? (
        <div style={{ position: 'relative' }}>
          <Image
            onClick={(e) => e.detail === 2 && handleOpen()}
            radius="md"
            fit="contain"
            w={width}
            src={getFileUrl(src)}
            alt={title}
            className={clsx(
              selected ? 'ProseMirror-selectednode' : '',
              'alignCenter'
            )}
          />

          {selected && (
            <ActionIcon
              onClick={handleOpen}
              variant="default"
              color="gray"
              mx="xs"
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
              }}
            >
              <IconEdit size={18} />
            </ActionIcon>
          )}
        </div>
      ) : (
        <Card
          radius="md"
          onClick={(e) => e.detail === 2 && handleOpen()}
          p="xs"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          withBorder
          className={clsx(selected ? 'ProseMirror-selectednode' : '')}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ActionIcon variant="transparent" color="gray">
              <IconEdit size={18} />
            </ActionIcon>

            <Text component="span" size="lg" c="dimmed">
              Double-click to edit drawio diagram
            </Text>
          </div>
        </Card>
      )}
    </NodeViewWrapper>
  );
}
