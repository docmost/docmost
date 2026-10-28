import { Modal } from "@mantine/core";
import clsx from "clsx";
import { useAtom, useSetAtom, type PrimitiveAtom } from "jotai";
import { useEffect } from "react";
import type { MicrosoftFileItem } from "@docmost/editor-ext";
import {
  microsoftFullscreenAtom,
  microsoftFullscreenHostsAtom,
  microsoftPreviewDialogAtom,
} from "@/features/microsoft/atoms/microsoft-atoms";
import { FilePreviewFrame } from "./file-preview-frame";
import classes from "./microsoft-file.module.css";

type PreviewModalProps = {
  item: MicrosoftFileItem | null;
  fullScreen?: boolean;
  onClose: () => void;
};

function PreviewModal({ item, fullScreen = false, onClose }: PreviewModalProps) {
  return (
    <Modal.Root
      opened={Boolean(item)}
      onClose={onClose}
      fullScreen={fullScreen}
      size={1200}
      padding={0}
      centered
      classNames={{
        content: clsx(classes.previewModal, !fullScreen && classes.previewDialog),
        body: classes.previewModalBody,
      }}
    >
      <Modal.Overlay />
      <Modal.Content aria-label={item?.name}>
        <Modal.Body>
          {item && (
            <FilePreviewFrame
              key={`${item.driveId}:${item.itemId}`}
              item={item}
              fill
              onClose={onClose}
            />
          )}
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}

export function MicrosoftFullscreenModal() {
  const [fullscreenItem, setFullscreenItem] = useAtom(
    microsoftFullscreenAtom as PrimitiveAtom<MicrosoftFileItem | null>,
  );
  const [dialogItem, setDialogItem] = useAtom(
    microsoftPreviewDialogAtom as PrimitiveAtom<MicrosoftFileItem | null>,
  );
  const setHosts = useSetAtom(microsoftFullscreenHostsAtom);

  useEffect(() => {
    setHosts((n) => n + 1);
    return () => setHosts((n) => n - 1);
  }, [setHosts]);

  return (
    <>
      <PreviewModal item={fullscreenItem} fullScreen onClose={() => setFullscreenItem(null)} />
      <PreviewModal item={dialogItem} onClose={() => setDialogItem(null)} />
    </>
  );
}
