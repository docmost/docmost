import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Image, Loader, Text, Tooltip } from "@mantine/core";
import { useMemo, useEffect, useState, useCallback } from "react";
import { getFileUrl } from "@/lib/config.ts";
import clsx from "clsx";
import classes from "./image-view.module.css";
import { useTranslation } from "react-i18next";
import { pageService } from "@/features/page/services/page-service.ts";
import { IconColumns } from "@tabler/icons-react";

export default function ImageView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { editor, node, selected, getPos } = props;
  const { src, width, align, title, aspectRatio, placeholder, attachmentId } = node.attrs;
  const [cropMetadata, setCropMetadata] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const alignClass = useMemo(() => {
    if (align === "left") return "alignLeft";
    if (align === "right") return "alignRight";
    if (align === "center") return "alignCenter";
    return "alignCenter";
  }, [align]);

  const previewSrc = useMemo(() => {
    editor.storage.shared.imagePreviews =
      editor.storage.shared.imagePreviews || {};

    if (placeholder?.id) {
      return editor.storage.shared.imagePreviews[placeholder.id];
    }

    return null;
  }, [placeholder, editor]);

  // Fetch crop metadata when attachmentId is available
  useEffect(() => {
    if (attachmentId && !cropMetadata) {
      pageService
        .getAttachmentInfo(attachmentId)
        .then((attachment) => {
          if (attachment.cropMetadata) {
            setCropMetadata(attachment.cropMetadata);
          }
        })
        .catch(() => {
          // Ignore errors, crop metadata is optional
        });
    }
  }, [attachmentId, cropMetadata]);

  const handleDragStart = useCallback((event: React.DragEvent) => {
    if (!editor.isEditable) return;

    setIsDragging(true);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', `image-node-${getPos()}`);

    // Create a custom drag image
    const dragImage = event.currentTarget.cloneNode(true) as HTMLElement;
    dragImage.style.opacity = '0.8';
    dragImage.style.transform = 'scale(0.95)';
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    event.dataTransfer.setDragImage(dragImage, event.nativeEvent.offsetX, event.nativeEvent.offsetY);

    // Remove the temporary element after a short delay
    setTimeout(() => {
      document.body.removeChild(dragImage);
    }, 0);
  }, [editor.isEditable, getPos]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setDragOver(false);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (!editor.isEditable) return;

    const draggedData = event.dataTransfer.getData('text/plain');
    if (!draggedData.startsWith('image-node-')) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOver(true);
  }, [editor.isEditable]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    if (!editor.isEditable) return;

    event.preventDefault();
    setDragOver(false);

    const draggedData = event.dataTransfer.getData('text/plain');
    if (!draggedData.startsWith('image-node-')) return;

    const draggedPos = parseInt(draggedData.replace('image-node-', ''));
    const dropPos = getPos();

    if (draggedPos === dropPos) return;

    // Get the dragged node
    const draggedNode = editor.state.doc.nodeAt(draggedPos);
    if (!draggedNode || draggedNode.type.name !== 'image') return;

    // Create transaction to move the node
    const { tr } = editor.state;

    // Delete from old position
    tr.delete(draggedPos, draggedPos + draggedNode.nodeSize);

    // Insert at new position (adjust for the deletion if needed)
    const insertPos = dropPos > draggedPos ? dropPos - draggedNode.nodeSize : dropPos;
    tr.insert(insertPos, draggedNode);

    // Dispatch the transaction
    editor.view.dispatch(tr);
  }, [editor, getPos]);

  const imageStyle = useMemo(() => {
    const baseStyle = { width };

    if (cropMetadata) {
      // Apply crop using object-position and clip-path
      const { x, y, width: cropWidth, height: cropHeight } = cropMetadata;
      return {
        ...baseStyle,
        objectPosition: `${-x}px ${-y}px`,
        clipPath: `inset(${y}px ${x + cropWidth}px ${y + cropHeight}px ${x}px)`,
      };
    }

    return baseStyle;
  }, [width, cropMetadata]);

  return (
    <NodeViewWrapper
      data-drag-handle
      draggable={editor.isEditable}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        className={clsx(
          selected && "ProseMirror-selectednode",
          classes.imageWrapper,
          alignClass,
          {
            [classes.dragging]: isDragging,
            [classes.dragOver]: dragOver,
          }
        )}
        style={{
          aspectRatio: aspectRatio ? aspectRatio : src ? undefined : "16 / 9",
          width,
        }}
      >
        {src && (
          <Tooltip
            label={t("Tip: Select multiple images and wrap them in columns for layout")}
            position="top"
            disabled={!selected}
          >
            <Image
              radius="md"
              fit="contain"
              src={getFileUrl(src)}
              alt={title}
              style={imageStyle}
            />
          </Tooltip>
        )}
        {!src && previewSrc && (
          <Group pos="relative" h="100%" w="100%">
            <Image
              radius="md"
              fit="contain"
              src={previewSrc}
              alt={placeholder?.name}
              style={imageStyle}
            />
            <Loader size={20} pos="absolute" bottom={6} right={6} />
          </Group>
        )}
        {!src && !previewSrc && (
          <Group justify="center" wrap="nowrap" gap="xs" maw="100%" px="md">
            <Loader size={20} style={{ flexShrink: 0 }} />
            <Text component="span" size="sm" truncate="end">
              {placeholder?.name
                ? t("Uploading {{name}}", { name: placeholder.name })
                : t("Uploading file")}
            </Text>
          </Group>
        )}
      </div>
    </NodeViewWrapper>
  );
}
