import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Image, Loader, Text, Tooltip } from "@mantine/core";
import { useMemo, useEffect, useState } from "react";
import { getFileUrl } from "@/lib/config.ts";
import clsx from "clsx";
import classes from "./image-view.module.css";
import { useTranslation } from "react-i18next";
import { pageService } from "@/features/page/services/page-service.ts";
import { IconColumns } from "@tabler/icons-react";

export default function ImageView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { editor, node, selected } = props;
  const { src, width, align, title, aspectRatio, placeholder, attachmentId } = node.attrs;
  const [cropMetadata, setCropMetadata] = useState(null);

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
    <NodeViewWrapper data-drag-handle>
      <div
        className={clsx(
          selected && "ProseMirror-selectednode",
          classes.imageWrapper,
          alignClass,
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
