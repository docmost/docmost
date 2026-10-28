import { Modal } from "@mantine/core";
import { useAtom, useSetAtom, type PrimitiveAtom } from "jotai";
import { useEffect } from "react";
import type { MicrosoftFileItem } from "@docmost/editor-ext";
import {
  microsoftFullscreenAtom,
  microsoftFullscreenHostsAtom,
} from "@/features/microsoft/atoms/microsoft-atoms";
import { FilePreviewFrame } from "./file-preview-frame";

export function MicrosoftFullscreenModal() {
  const [item, setItem] = useAtom(microsoftFullscreenAtom as PrimitiveAtom<MicrosoftFileItem | null>);
  const setHosts = useSetAtom(microsoftFullscreenHostsAtom);

  useEffect(() => {
    setHosts((n) => n + 1);
    return () => setHosts((n) => n - 1);
  }, [setHosts]);

  return (
    <Modal opened={Boolean(item)} onClose={() => setItem(null)} fullScreen title={item?.name} keepMounted={false}>
      {item && <FilePreviewFrame key={`${item.driveId}:${item.itemId}`} item={item} fill />}
    </Modal>
  );
}
