import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Group, Loader, Text } from "@mantine/core";
import { useCallback, useMemo, useState } from "react";
import { getFileUrl } from "@/lib/config.ts";
import { ResizableWrapper } from "../common/resizable-wrapper";
import clsx from "clsx";
import classes from "./pdf-view.module.css";
import { useTranslation } from "react-i18next";
import { isInternalFileUrl } from "@docmost/editor-ext";
import { IconFileTypePdf } from "@tabler/icons-react";

export default function PdfView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { editor, node, getPos, selected, updateAttributes } = props;
  const { src, placeholder, width: nodeWidth, height: nodeHeight } = node.attrs;
  const [hasError, setHasError] = useState(false);

  const safeSrc = useMemo(() => {
    if (!src || !isInternalFileUrl(src)) return null;
    return getFileUrl(src);
  }, [src]);

  const handleSelect = useCallback(() => {
    const pos = getPos();
    if (pos !== undefined) {
      editor.commands.setNodeSelection(pos);
    }
  }, [editor, getPos]);

  const handleResize = useCallback(
    (newWidth: number, newHeight: number) => {
      updateAttributes({ width: newWidth, height: newHeight });
    },
    [updateAttributes],
  );

  if (!src || !safeSrc) {
    return (
      <NodeViewWrapper data-drag-handle>
        <div className={`${classes.pdfWrapper} ${classes.skeleton}`} style={{ height: 600 }}>
          <Group justify="center" wrap="nowrap" gap="xs" maw="100%" px="md">
            <Loader size={20} style={{ flexShrink: 0 }} />
            <Text component="span" size="sm" truncate="end">
              {placeholder?.name
                ? t("Uploading {{name}}", { name: placeholder.name })
                : t("Uploading file")}
            </Text>
          </Group>
        </div>
      </NodeViewWrapper>
    );
  }

  if (hasError) {
    return (
      <NodeViewWrapper data-drag-handle>
        <div className={classes.pdfError} onClick={handleSelect}>
          <IconFileTypePdf size={32} stroke={1.5} />
          <Text size="sm" c="dimmed">
            {t("Failed to load PDF")}
          </Text>
        </div>
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper data-drag-handle className={classes.pdfNodeView}>
      <div className={classes.pdfContainer}>
        <ResizableWrapper
          initialWidth={nodeWidth || 800}
          initialHeight={nodeHeight || 600}
          minWidth={200}
          maxWidth={1200}
          minHeight={200}
          maxHeight={1200}
          onResize={handleResize}
          isEditable={editor.isEditable}
          selected={selected}
          className={clsx(classes.pdfResizeWrapper, {
            "ProseMirror-selectednode": selected,
          })}
        >
          <iframe
            className={classes.pdfIframe}
            src={safeSrc}
            loading="lazy"
            frameBorder="0"
            onError={() => setHasError(true)}
            onLoad={(e) => {
              try {
                const iframe = e.currentTarget;
                const status = iframe.contentDocument?.querySelector("pre")?.textContent;
                if (status && status.includes('"statusCode":404')) {
                  setHasError(true);
                }
              } catch {
                // cross-origin - can't inspect, assume OK
              }
            }}
          />
          {!selected && <div className={classes.clickOverlay} onClick={handleSelect} />}
        </ResizableWrapper>
      </div>
    </NodeViewWrapper>
  );
}
