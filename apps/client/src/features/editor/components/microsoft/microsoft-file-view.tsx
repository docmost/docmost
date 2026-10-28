import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Card, Group, Text } from "@mantine/core";
import { useSetAtom, type PrimitiveAtom } from "jotai";
import clsx from "clsx";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  sanitizeMicrosoftFileItems,
  type MicrosoftFileDisplay,
  type MicrosoftFileItem,
} from "@docmost/editor-ext";
import { ResizableWrapper } from "../common/resizable-wrapper";
import { getIntegrationIcon } from "@/features/integration/components/integration-icons";
import { MicrosoftPickerModal } from "@/features/microsoft/picker/microsoft-picker-modal";
import { consumeMicrosoftPickerRequest, microsoftFullscreenAtom } from "@/features/microsoft/atoms/microsoft-atoms";
import { M365Item } from "@/features/microsoft/types/microsoft.types";
import { FilePreviewFrame } from "./file-preview-frame";
import { FileCarousel } from "./file-carousel";
import { FileLinkList } from "./file-link-list";
import classes from "./microsoft-file.module.css";

const JUSTIFY: Record<string, string> = { left: "flex-start", center: "center", right: "flex-end" };

export default function MicrosoftFileView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, editor, selected, updateAttributes } = props;
  const items = sanitizeMicrosoftFileItems(node.attrs.items);
  const display: MicrosoftFileDisplay = node.attrs.display === "link" ? "link" : "embed";
  const setFullscreen = useSetAtom(microsoftFullscreenAtom as PrimitiveAtom<MicrosoftFileItem | null>);
  const [pickerOpened, setPickerOpened] = useState(false);

  useEffect(() => {
    if (consumeMicrosoftPickerRequest(node.attrs.pendingKey) && editor.isEditable) {
      setPickerOpened(true);
    }
  }, []);

  const handleSelect = useCallback(
    (picked: M365Item[], pickedDisplay: MicrosoftFileDisplay) => {
      const next: MicrosoftFileItem[] = picked.map((item) => ({
        driveId: item.driveId,
        itemId: item.itemId,
        webUrl: item.webUrl,
        name: item.name,
      }));
      updateAttributes({ items: next, display: pickedDisplay, pendingKey: null });
      setPickerOpened(false);
    },
    [updateAttributes],
  );

  const handleResize = useCallback(
    (width: number, height: number) => updateAttributes({ width, height }),
    [updateAttributes],
  );

  const picker = editor.isEditable ? (
    <MicrosoftPickerModal
      opened={pickerOpened}
      onClose={() => setPickerOpened(false)}
      onSelect={handleSelect}
      initialDisplay={display}
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
              {editor.isEditable ? t("Choose a SharePoint or OneDrive file") : t("No file selected")}
            </Text>
          </Group>
        </Card>
        {picker}
      </NodeViewWrapper>
    );
  }

  if (display === "link") {
    return (
      <NodeViewWrapper data-drag-handle className={clsx(selected && "ProseMirror-selectednode")}>
        <FileLinkList items={items} />
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
        </ResizableWrapper>
      </div>
      {picker}
    </NodeViewWrapper>
  );
}
