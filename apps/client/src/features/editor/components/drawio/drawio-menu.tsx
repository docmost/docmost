import { BubbleMenu as BaseBubbleMenu } from "@tiptap/react/menus";
import { findParentNode, posToDOMRect, useEditorState } from "@tiptap/react";
import { useCallback, useRef, useState } from "react";
import { Node as PMNode } from "prosemirror-model";
import {
  EditorMenuProps,
  ShouldShowProps,
} from "@/features/editor/components/table/types/types.ts";
import { ActionIcon, Modal, Tooltip, useComputedColorScheme } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import clsx from "clsx";
import {
  IconLayoutAlignCenter,
  IconLayoutAlignLeft,
  IconLayoutAlignRight,
  IconDownload,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { getDrawioUrl, getFileUrl } from "@/lib/config.ts";
import { uploadFile } from "@/features/page/services/page-service.ts";
import {
  DrawIoEmbed,
  DrawIoEmbedRef,
  EventExit,
  EventSave,
} from "react-drawio";
import { decodeBase64ToSvgString, svgStringToFile } from "@/lib/utils";
import { IAttachment } from "@/features/attachments/types/attachment.types";
import classes from "../common/toolbar-menu.module.css";

export function DrawioMenu({ editor }: EditorMenuProps) {
  const { t } = useTranslation();
  const [opened, { open, close }] = useDisclosure(false);
  const [initialXML, setInitialXML] = useState<string>("");
  const drawioRef = useRef<DrawIoEmbedRef>(null);
  const computedColorScheme = useComputedColorScheme();

  const editorState = useEditorState({
    editor,
    selector: (ctx) => {
      if (!ctx.editor) {
        return null;
      }

      const drawioAttr = ctx.editor.getAttributes("drawio");
      return {
        isDrawio: ctx.editor.isActive("drawio"),
        isAlignLeft: ctx.editor.isActive("drawio", { align: "left" }),
        isAlignCenter: ctx.editor.isActive("drawio", { align: "center" }),
        isAlignRight: ctx.editor.isActive("drawio", { align: "right" }),
        src: drawioAttr?.src || null,
        attachmentId: drawioAttr?.attachmentId || null,
      };
    },
  });

  const shouldShow = useCallback(
    ({ state }: ShouldShowProps) => {
      if (!state) {
        return false;
      }

      return editor.isActive("drawio") && editor.getAttributes("drawio")?.src;
    },
    [editor],
  );

  const getReferencedVirtualElement = useCallback(() => {
    if (!editor) return;
    const { selection } = editor.state;
    const predicate = (node: PMNode) => node.type.name === "drawio";
    const parent = findParentNode(predicate)(selection);

    if (parent) {
      const dom = editor.view.nodeDOM(parent?.pos) as HTMLElement;
      const domRect = dom.getBoundingClientRect();
      return {
        getBoundingClientRect: () => domRect,
        getClientRects: () => [domRect],
      };
    }

    const domRect = posToDOMRect(editor.view, selection.from, selection.to);
    return {
      getBoundingClientRect: () => domRect,
      getClientRects: () => [domRect],
    };
  }, [editor]);

  const alignLeft = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setDrawioAlign("left")
      .run();
  }, [editor]);

  const alignCenter = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setDrawioAlign("center")
      .run();
  }, [editor]);

  const alignRight = useCallback(() => {
    editor
      .chain()
      .focus(undefined, { scrollIntoView: false })
      .setDrawioAlign("right")
      .run();
  }, [editor]);

  const handleDownload = useCallback(() => {
    if (!editorState?.src) return;
    const url = getFileUrl(editorState.src);
    const a = document.createElement("a");
    a.href = url;
    a.download = "";
    a.click();
  }, [editorState?.src]);

  const handleDelete = useCallback(() => {
    editor.commands.deleteSelection();
  }, [editor]);

  const handleOpen = useCallback(async () => {
    if (!editorState?.src) return;

    try {
      const url = getFileUrl(editorState.src);
      const request = await fetch(url, {
        credentials: "include",
        cache: "no-store",
      });
      const blob = await request.blob();

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = () => {
        const base64data = (reader.result || "") as string;
        setInitialXML(base64data);
      };
    } catch (err) {
      console.error(err);
    } finally {
      open();
    }
  }, [editorState?.src, open]);

  const handleSave = useCallback(
    async (data: EventSave) => {
      const svgString = decodeBase64ToSvgString(data.xml);
      const fileName = "diagram.drawio.svg";
      const drawioSVGFile = await svgStringToFile(svgString, fileName);

      // @ts-ignore
      const pageId = editor.storage?.pageId;
      const attachmentId = editorState?.attachmentId;

      let attachment: IAttachment = null;
      if (attachmentId) {
        attachment = await uploadFile(drawioSVGFile, pageId, attachmentId);
      } else {
        attachment = await uploadFile(drawioSVGFile, pageId);
      }

      editor.commands.updateAttributes("drawio", {
        src: `/api/files/${attachment.id}/${attachment.fileName}?t=${new Date(attachment.updatedAt).getTime()}`,
        title: attachment.fileName,
        size: attachment.fileSize,
        attachmentId: attachment.id,
      });

      close();
    },
    [editor, editorState?.attachmentId, close],
  );

  return (
    <>
      <BaseBubbleMenu
        editor={editor}
        pluginKey={`drawio-menu`}
        updateDelay={0}
        getReferencedVirtualElement={getReferencedVirtualElement}
        options={{
          placement: "top",
          offset: 8,
          flip: false,
        }}
        shouldShow={shouldShow}
      >
        <div className={classes.toolbar}>
          <Tooltip position="top" label={t("Align left")}>
            <ActionIcon
              onClick={alignLeft}
              size="lg"
              aria-label={t("Align left")}
              variant="subtle"
              className={clsx({ [classes.active]: editorState?.isAlignLeft })}
            >
              <IconLayoutAlignLeft size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label={t("Align center")}>
            <ActionIcon
              onClick={alignCenter}
              size="lg"
              aria-label={t("Align center")}
              variant="subtle"
              className={clsx({ [classes.active]: editorState?.isAlignCenter })}
            >
              <IconLayoutAlignCenter size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label={t("Align right")}>
            <ActionIcon
              onClick={alignRight}
              size="lg"
              aria-label={t("Align right")}
              variant="subtle"
              className={clsx({ [classes.active]: editorState?.isAlignRight })}
            >
              <IconLayoutAlignRight size={18} />
            </ActionIcon>
          </Tooltip>

          <div className={classes.divider} />

          <Tooltip position="top" label={t("Edit")}>
            <ActionIcon
              onClick={handleOpen}
              size="lg"
              aria-label={t("Edit")}
              variant="subtle"
            >
              <IconEdit size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label={t("Download")}>
            <ActionIcon
              onClick={handleDownload}
              size="lg"
              aria-label={t("Download")}
              variant="subtle"
            >
              <IconDownload size={18} />
            </ActionIcon>
          </Tooltip>

          <Tooltip position="top" label={t("Delete")}>
            <ActionIcon
              onClick={handleDelete}
              size="lg"
              aria-label={t("Delete")}
              variant="subtle"
            >
              <IconTrash size={18} />
            </ActionIcon>
          </Tooltip>
        </div>
      </BaseBubbleMenu>

      <Modal.Root opened={opened} onClose={close} fullScreen>
        <Modal.Overlay />
        <Modal.Content style={{ overflow: "hidden" }}>
          <Modal.Body>
            <div style={{ height: "100vh" }}>
              <DrawIoEmbed
                ref={drawioRef}
                xml={initialXML}
                baseUrl={getDrawioUrl()}
                urlParameters={{
                  ui: computedColorScheme === "light" ? "kennedy" : "dark",
                  spin: true,
                  libraries: true,
                  saveAndExit: true,
                  noSaveBtn: true,
                }}
                onSave={(data: EventSave) => {
                  if (data.parentEvent !== "save") {
                    return;
                  }
                  handleSave(data);
                }}
                onClose={(data: EventExit) => {
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
    </>
  );
}

export default DrawioMenu;
