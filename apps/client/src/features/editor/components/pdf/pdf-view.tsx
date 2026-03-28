import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ActionIcon, Group, Loader, Text, Tooltip } from "@mantine/core";
import { useCallback, useMemo, useState } from "react";
import { getFileUrl } from "@/lib/config.ts";
import { ResizableWrapper } from "../common/resizable-wrapper";
import clsx from "clsx";
import classes from "./pdf-view.module.css";
import { useTranslation } from "react-i18next";
import { isInternalFileUrl } from "@docmost/editor-ext";
import {
  IconFileTypePdf,
  IconPaperclip,
  IconTrash,
} from "@tabler/icons-react";

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

  const handleConvertToAttachment = useCallback(() => {
    if (!src) return;
    const pos = getPos();
    if (pos === undefined) return;
    const currentNode = editor.state.doc.nodeAt(pos);
    if (!currentNode || currentNode.type.name !== "pdf") return;

    editor
      .chain()
      .insertContentAt(
        { from: pos, to: pos + currentNode.nodeSize },
        {
          type: "attachment",
          attrs: {
            url: currentNode.attrs.src,
            name: currentNode.attrs.name,
            attachmentId: currentNode.attrs.attachmentId,
            size: currentNode.attrs.size,
            mime: "application/pdf",
          },
        },
      )
      .run();
  }, [editor, src, getPos]);

  const handleDelete = useCallback(() => {
    const pos = getPos();
    if (pos === undefined) return;
    editor.commands.setNodeSelection(pos);
    editor.commands.deleteSelection();
  }, [editor, getPos]);

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
        <div data-pdf-error className={clsx(classes.pdfError, { "ProseMirror-selectednode": selected })} onClick={handleSelect}>
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
          {editor.isEditable && (
            <div className={classes.hoverMenu}>
              <Tooltip position="top" label={t("Convert to attachment")} withinPortal>
                <ActionIcon
                  size="sm"
                  variant="filled"
                  color="dark"
                  onClick={handleConvertToAttachment}
                  aria-label={t("Convert to attachment")}
                >
                  <IconPaperclip size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip position="top" label={t("Delete")} withinPortal>
                <ActionIcon
                  size="sm"
                  variant="filled"
                  color="dark"
                  onClick={handleDelete}
                  aria-label={t("Delete")}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
        </ResizableWrapper>
      </div>
    </NodeViewWrapper>
  );
}
