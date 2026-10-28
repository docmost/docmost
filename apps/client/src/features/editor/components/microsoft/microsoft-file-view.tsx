import { NodeViewProps, NodeViewWrapper, useEditorState } from "@tiptap/react";
import { ActionIcon, Card, Group, Text, Tooltip } from "@mantine/core";
import { IconAt, IconTrash } from "@tabler/icons-react";
import { useSetAtom, type PrimitiveAtom } from "jotai";
import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  sanitizeMicrosoftFileItems,
  type MicrosoftFileItem,
} from "@docmost/editor-ext";
import { ResizableWrapper } from "../common/resizable-wrapper";
import { getIntegrationIcon } from "@/features/integration/components/integration-icons";
import { MicrosoftPickerModal } from "@/features/microsoft/picker/microsoft-picker-modal";
import { consumeMicrosoftPickerRequest, microsoftFullscreenAtom } from "@/features/microsoft/atoms/microsoft-atoms";
import { M365Item, MicrosoftInsertMode } from "@/features/microsoft/types/microsoft.types";
import { replaceMicrosoftFileWithMentions } from "@/features/microsoft/utils/microsoft-mentions";
import { FilePreviewFrame } from "./file-preview-frame";
import { FileCarousel } from "./file-carousel";
import classes from "./microsoft-file.module.css";

const JUSTIFY: Record<string, string> = { left: "flex-start", center: "center", right: "flex-end" };

export default function MicrosoftFileView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, editor, selected, getPos, updateAttributes } = props;
  const items = sanitizeMicrosoftFileItems(node.attrs.items);
  const embedName = items.map((item) => item.name || item.webUrl).join(", ");
  const setFullscreen = useSetAtom(microsoftFullscreenAtom as PrimitiveAtom<MicrosoftFileItem | null>);
  const [pickerOpened, setPickerOpened] = useState(false);
  const isEditable = useEditorState({ editor, selector: (ctx) => ctx.editor.isEditable });

  useEffect(() => {
    if (consumeMicrosoftPickerRequest(node.attrs.pendingKey) && editor.isEditable) {
      setPickerOpened(true);
    }
  }, []);

  const handleSelect = useCallback(
    (picked: M365Item[], mode: MicrosoftInsertMode) => {
      const next: MicrosoftFileItem[] = picked.map((item) => ({
        driveId: item.driveId,
        itemId: item.itemId,
        webUrl: item.webUrl,
        name: item.name,
      }));
      setPickerOpened(false);
      if (mode === "embed") {
        updateAttributes({ items: next, pendingKey: null });
        return;
      }
      const pos = getPos();
      if (typeof pos === "number" && replaceMicrosoftFileWithMentions(editor, pos, next)) {
        editor.commands.focus(undefined, { scrollIntoView: false });
      }
    },
    [editor, getPos, updateAttributes],
  );

  const handleResize = useCallback(
    (width: number, height: number) => updateAttributes({ width, height }),
    [updateAttributes],
  );

  const handleMention = () => {
    const pos = getPos();
    if (typeof pos === "number" && replaceMicrosoftFileWithMentions(editor, pos, items)) {
      editor.commands.focus(undefined, { scrollIntoView: false });
    }
  };

  const handleDelete = () => {
    const pos = getPos();
    if (typeof pos !== "number") return;
    editor.commands.setNodeSelection(pos);
    editor.commands.deleteSelection();
  };

  const picker = editor.isEditable ? (
    <MicrosoftPickerModal
      opened={pickerOpened}
      onClose={() => setPickerOpened(false)}
      onSelect={handleSelect}
    />
  ) : null;

  if (!items.length) {
    return (
      <NodeViewWrapper data-drag-handle>
        <Card
          withBorder
          radius="md"
          p="sm"
          className={clsx(classes.emptyCard, selected && "ProseMirror-selectednode")}
          onClick={() => editor.isEditable && setPickerOpened(true)}
        >
          <Group gap="sm" justify="center">
            {getIntegrationIcon("microsoft_365", 20)}
            <Text size="sm" c="dimmed">
              {editor.isEditable ? t("Choose a SharePoint file") : t("No file selected")}
            </Text>
          </Group>
        </Card>
        {picker}
      </NodeViewWrapper>
    );
  }

  return (
    <NodeViewWrapper data-drag-handle className={classes.embedNodeView}>
      <div className={classes.embedContainer} style={{ justifyContent: JUSTIFY[node.attrs.align] ?? "center" }}>
        <ResizableWrapper
          initialWidth={node.attrs.width || 800}
          initialHeight={node.attrs.height || 600}
          minWidth={280}
          maxWidth={1200}
          minHeight={220}
          maxHeight={1200}
          onResize={handleResize}
          isEditable={editor.isEditable}
          selected={selected}
          className={clsx(classes.embedWrapper, selected && "ProseMirror-selectednode")}
        >
          {items.length > 1 ? (
            <FileCarousel items={items} onFullscreen={setFullscreen} />
          ) : (
            <FilePreviewFrame
              key={`${items[0].driveId}:${items[0].itemId}`}
              item={items[0]}
              onFullscreen={setFullscreen}
            />
          )}
          {isEditable && !selected && (
            // Stops ProseMirror selecting the embed on press, which would unmount these buttons before the click.
            <div className={classes.hoverMenu} onMouseDown={(event) => event.preventDefault()}>
              <Tooltip position="top" label={t("Mention")} withinPortal>
                <ActionIcon
                  size="sm"
                  variant="filled"
                  color="dark"
                  onClick={handleMention}
                  aria-label={t("Mention {{name}}", { name: embedName })}
                >
                  <IconAt size={14} />
                </ActionIcon>
              </Tooltip>
              <Tooltip position="top" label={t("Delete")} withinPortal>
                <ActionIcon
                  size="sm"
                  variant="filled"
                  color="dark"
                  onClick={handleDelete}
                  aria-label={t("Delete {{name}}", { name: embedName })}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Tooltip>
            </div>
          )}
        </ResizableWrapper>
      </div>
      {picker}
    </NodeViewWrapper>
  );
}
