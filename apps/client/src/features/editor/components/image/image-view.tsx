import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Image, Loader, Text, Tooltip } from "@mantine/core";
import { useMemo, useEffect, useState, useCallback, useRef } from "react";
import { getFileUrl } from "@/lib/config.ts";
import { findParentNode } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import clsx from "clsx";
import classes from "./image-view.module.css";
import { useTranslation } from "react-i18next";
import { pageService } from "@/features/page/services/page-service.ts";

export default function ImageView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { editor, node, selected, getPos } = props;
  const { src, width, align, title, aspectRatio, placeholder, attachmentId } = node.attrs;
  const [cropMetadata, setCropMetadata] = useState(null);
  const [canCreateColumns, setCanCreateColumns] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const alignClass = useMemo(() => {
    if (align === "left") return classes.alignLeft;
    if (align === "right") return classes.alignRight;
    if (align === "center") return classes.alignCenter;
    return classes.alignCenter;
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
    if (attachmentId) {
      pageService
        .getAttachmentInfo(attachmentId)
        .then((attachment) => {
          if (attachment.cropMetadata) {
            setCropMetadata(attachment.cropMetadata);

            // Sync to node attributes if missing and in editable mode
            if (!node.attrs.cropMetadata && editor.isEditable) {
              const pos = getPos();
              if (typeof pos === "number") {
                editor.commands.updateAttributes(node.type.name, {
                  cropMetadata: attachment.cropMetadata,
                  updatedAt: Date.now(),
                });
              }
            }
          } else {
            setCropMetadata(null);
          }
        })
        .catch(() => {
          // Ignore errors, crop metadata is optional
        });
    }
  }, [attachmentId, node.attrs.updatedAt]);

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
    setCanCreateColumns(false);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    if (!editor.isEditable) return;

    const draggedData = event.dataTransfer.getData('text/plain');
    if (!draggedData.startsWith('image-node-')) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOver(true);

    // Check if multi-column creation is possible
    const pos = getPos();
    const dropResolvedPos = editor.state.doc.resolve(pos);
    const prevNode = dropResolvedPos.nodeBefore;
    const nextNode = dropResolvedPos.nodeAfter;

    const hasAdjacentImages = (prevNode?.type.name === 'image') || (nextNode?.type.name === 'image');
    setCanCreateColumns(hasAdjacentImages);
  }, [editor.isEditable, editor.state.doc, getPos]);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
    setCanCreateColumns(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    if (!editor.isEditable) return;

    event.preventDefault();
    setDragOver(false);
    setCanCreateColumns(false);

    const draggedData = event.dataTransfer.getData('text/plain');
    if (!draggedData.startsWith('image-node-')) return;

    const draggedPos = parseInt(draggedData.replace('image-node-', ''));
    const dropPos = getPos();

    if (draggedPos === dropPos) return;

    // Get the dragged node
    const draggedNode = editor.state.doc.nodeAt(draggedPos);
    if (!draggedNode || draggedNode.type.name !== 'image') return;

    const { tr, schema } = editor.state;
    const dropResolvedPos = tr.doc.resolve(dropPos);

    // Check if we're dropping inside a columns node
    const selection = TextSelection.create(tr.doc, dropResolvedPos.pos);
    const columnsNodeInfo = findParentNode(node => node.type.name === 'columns')(selection);
    const isInColumns = !!columnsNodeInfo;

    if (isInColumns) {
      // We're dropping inside an existing columns layout
      const columnsPos = columnsNodeInfo.pos;
      const columnCount = columnsNodeInfo.node.childCount;

      // If we have space for more columns, increase the count
      if (columnCount < 5) {
        const newLayout = getLayoutForColumnCount(columnCount + 1);
        tr.setNodeMarkup(columnsPos, undefined, { layout: newLayout });

        // Add the dragged image to a new column
        const column = schema.nodes.column.create(null, [draggedNode]);
        tr.insert(columnsPos + columnsNodeInfo.node.nodeSize - 1, column);
      } else {
        // Maximum columns reached, just move the image within the columns
        tr.insert(dropPos, draggedNode);
      }

      // Remove from old position (accounting for any changes if needed, but here simple delete works if we do it in one tr)
      tr.delete(draggedPos, draggedPos + draggedNode.nodeSize);
    } else {
      // Check if there are adjacent images to create columns with
      const prevNode = dropResolvedPos.nodeBefore;
      const nextNode = dropResolvedPos.nodeAfter;

      const hasPrevImage = prevNode?.type.name === 'image';
      const hasNextImage = nextNode?.type.name === 'image';

      if (hasPrevImage || hasNextImage) {
        // Create a columns layout with the adjacent images
        const imagesToWrap = [];

        if (hasPrevImage) imagesToWrap.push(prevNode);
        imagesToWrap.push(draggedNode);
        if (hasNextImage) imagesToWrap.push(nextNode);

        // Position to insert the new columns node
        const startPos = hasPrevImage ? dropPos - (prevNode?.nodeSize || 0) : dropPos;
        const endPos = hasNextImage ? dropPos + (nextNode?.nodeSize || 0) : dropPos + draggedNode.nodeSize;

        // Remove the images from their current positions
        tr.delete(startPos, endPos);
        // Also remove dragged node if it's elsewhere
        if (draggedPos < startPos || draggedPos >= endPos) {
          tr.delete(draggedPos, draggedPos + draggedNode.nodeSize);
        }

        // Create columns layout
        const columnCount = Math.min(imagesToWrap.length, 3);
        const layout = getLayoutForColumnCount(columnCount);

        const columnsContent = imagesToWrap.map(image =>
          schema.nodes.column.create(null, [image])
        );

        const columnsNode = schema.nodes.columns.create({ layout }, columnsContent);
        tr.insert(startPos, columnsNode);
      } else {
        // Simple move - no adjacent images, just reposition
        tr.delete(draggedPos, draggedPos + draggedNode.nodeSize);
        const insertPos = dropPos > draggedPos ? dropPos - draggedNode.nodeSize : dropPos;
        tr.insert(insertPos, draggedNode);
      }
    }

    editor.view.dispatch(tr);
  }, [editor, getPos]);

  // Helper function to get appropriate layout for column count
  const getLayoutForColumnCount = (count: number): string => {
    switch (count) {
      case 2: return 'two_equal';
      case 3: return 'three_equal';
      case 4: return 'four_equal';
      case 5: return 'five_equal';
      default: return 'two_equal';
    }
  };

  const imageRef = useRef<HTMLImageElement>(null);

  const applyCropStyles = useCallback(() => {
    const el = imageRef.current;
    const metadata = node.attrs.cropMetadata || cropMetadata;

    if (!el) return;

    if (!metadata) {
      el.style.width = "100%";
      el.style.height = "auto";
      el.style.marginLeft = "0";
      el.style.marginTop = "0";
      el.style.position = "static";
      return;
    }

    const { x, y, width: w, height: h } = metadata;
    const nw = el.naturalWidth;
    const nh = el.naturalHeight;

    if (nw > 0 && nh > 0) {
      // The imageWrapper has a fixed width (passed from Tiptap or 100%)
      // We need to scale the image so that the cropped portion fills that width.
      const scale = 100 / (w / nw * 100); // How much to zoom the image
      
      el.className = clsx(el.className, classes.croppedImage);
      el.style.width = `${scale * 100}%`;
      el.style.height = "auto";
      el.style.marginLeft = `-${(x / nw) * scale * 100}%`;
      el.style.marginTop = `-${(y / nh) * scale * 100}%`;
      
      // Calculate wrapper height based on crop aspect ratio
      const wrapper = el.parentElement;
      if (wrapper) {
          const cropAspectRatio = w / h;
          // We can't easily get the computed width here without potentially causing layout thrashing,
          // but we can set the wrapper's aspect ratio.
          wrapper.style.aspectRatio = `${cropAspectRatio}`;
      }
    }
  }, [cropMetadata, node.attrs.cropMetadata]);

  useEffect(() => {
    applyCropStyles();
  }, [cropMetadata, node.attrs.cropMetadata, applyCropStyles]);

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
            [classes.canCreateColumns]: dragOver && canCreateColumns,
          }
        )}
        style={{
          aspectRatio: aspectRatio ? aspectRatio : src ? undefined : "16 / 9",
          width,
        }}
      >
        {src && (
          <Tooltip
            label={
              isDragging
                ? "Drop to move image"
                : dragOver && canCreateColumns
                  ? "Drop here to create multi-column layout"
                  : selected
                    ? t("Tip: Select multiple images and wrap them in columns for layout")
                    : ""
            }
            position="top"
            disabled={!selected && !isDragging && !dragOver}
          >
            <Image
              ref={imageRef}
              radius="md"
              fit="contain"
              src={getFileUrl(src)}
              alt={title}
              onLoad={applyCropStyles}
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
              style={{ width: "100%" }}
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
