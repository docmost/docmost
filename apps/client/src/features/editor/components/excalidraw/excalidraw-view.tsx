import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
  ActionIcon,
  Button,
  Card,
  Group,
  Text,
  useComputedColorScheme,
} from "@mantine/core";
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { uploadFile } from "@/features/page/services/page-service.ts";
import { svgStringToFile } from "@/lib";
import { useDisclosure } from "@mantine/hooks";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { IAttachment } from "@/features/attachments/types/attachment.types";
import clsx from "clsx";
import { IconEdit, IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useHandleLibrary } from "@excalidraw/excalidraw";
import { localStorageLibraryAdapter } from "@/features/editor/components/excalidraw/excalidraw-utils.ts";
import { modals } from "@mantine/modals";

const ExcalidrawComponent = lazy(() =>
  import("@excalidraw/excalidraw").then((module) => ({
    default: module.Excalidraw,
  })),
);

export default function ExcalidrawView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, updateAttributes, editor, selected } = props;
  const { attachmentId } = node.attrs;

  const [excalidrawAPI, setExcalidrawAPI] =
    useState<ExcalidrawImperativeAPI>(null);
  useHandleLibrary({
    excalidrawAPI,
    adapter: localStorageLibraryAdapter,
  });
  const [excalidrawData, setExcalidrawData] = useState<any>(null);
  const [opened, { open, close }] = useDisclosure(false);
  const computedColorScheme = useComputedColorScheme();

  const isDirtyRef = useRef(false);
  const isSavingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const isInitialLoadRef = useRef(true);
  const lastFingerprintRef = useRef("");

  // Lock body scroll when modal is open
  useEffect(() => {
    if (opened) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [opened]);

  const handleOpen = async () => {
    if (!editor.isEditable) return;

    if (node.attrs.src) {
      try {
        const request = await fetch(node.attrs.src, {
          credentials: "include",
          cache: "no-store",
        });
        const { loadFromBlob } = await import("@excalidraw/excalidraw");
        const data = await loadFromBlob(await request.blob(), null, null);
        setExcalidrawData(data);
      } catch (err) {
        console.error("Failed to load excalidraw data:", err);
      }
    }

    isDirtyRef.current = false;
    isInitialLoadRef.current = true;
    open();
  };

  const saveData = useCallback(async (updateSrc = true) => {
    if (!excalidrawAPI || isSavingRef.current) return;

    isSavingRef.current = true;
    setIsSaving(true);

    try {
      const { exportToSvg } = await import("@excalidraw/excalidraw");

      const svg = await exportToSvg({
        elements: excalidrawAPI?.getSceneElements(),
        appState: {
          exportEmbedScene: true,
          exportWithDarkMode: false,
        },
        files: excalidrawAPI?.getFiles(),
      });

      const serializer = new XMLSerializer();
      let svgString = serializer.serializeToString(svg);

      svgString = svgString.replace(
        /https:\/\/unpkg\.com\/@excalidraw\/excalidraw@undefined/g,
        "https://unpkg.com/@excalidraw/excalidraw@latest",
      );

      const fileName = "diagram.excalidraw.svg";
      const excalidrawSvgFile = await svgStringToFile(svgString, fileName);

      // @ts-ignore
      const pageId = editor.storage?.pageId;

      let attachment: IAttachment = null;
      if (attachmentId) {
        attachment = await uploadFile(excalidrawSvgFile, pageId, attachmentId);
      } else {
        attachment = await uploadFile(excalidrawSvgFile, pageId);
      }

      if (updateSrc) {
        updateAttributes({
          src: `/api/files/${attachment.id}/${attachment.fileName}?t=${new Date(attachment.updatedAt).getTime()}`,
          title: attachment.fileName,
          size: attachment.fileSize,
          attachmentId: attachment.id,
        });
      } else {
        updateAttributes({
          attachmentId: attachment.id,
        });
      }

      isDirtyRef.current = false;
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }, [excalidrawAPI, editor, attachmentId, updateAttributes]);

  const handleSaveAndExit = useCallback(async () => {
    try {
      await saveData();
      close();
    } catch {
      /* empty */
    }
  }, [saveData, close]);

  const handleClose = useCallback(() => {
    if (!isDirtyRef.current) {
      close();
      return;
    }

    modals.openConfirmModal({
      title: t("Unsaved changes"),
      children: (
        <Text size="sm">
          {t("You have unsaved changes that will be lost.")}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Discard"), cancel: t("Cancel") },
      confirmProps: { color: "red" },
      onConfirm: () => {
        isDirtyRef.current = false;
        close();
      },
    });
  }, [close, t]);

  useEffect(() => {
    if (!opened) return;

    const interval = setInterval(() => {
      if (isDirtyRef.current && !isSavingRef.current) {
        saveData(false).catch(() => {});
      }
    }, 30_000);

    return () => clearInterval(interval);
  }, [opened, saveData]);

  // Fullscreen edit modal via portal — bypasses all parent CSS constraints
  const editModal = opened ? createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        background: "var(--mantine-color-body)",
      }}
    >
      {/* Toolbar */}
      <Group
        justify="flex-end"
        wrap="nowrap"
        bg="var(--mantine-color-body)"
        p="xs"
        style={{
          borderBottom: "1px solid var(--mantine-color-default-border)",
          flexShrink: 0,
        }}
      >
        <Button onClick={handleSaveAndExit} size="compact-sm" loading={isSaving}>
          {t("Save & Exit")}
        </Button>
        <ActionIcon
          onClick={handleClose}
          variant="subtle"
          color="red"
          size="md"
          title={t("Exit")}
        >
          <IconX size={18} />
        </ActionIcon>
      </Group>

      {/* Canvas — fills all remaining space */}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <Suspense fallback={null}>
          <ExcalidrawComponent
            excalidrawAPI={(api) => setExcalidrawAPI(api)}
            onChange={(elements, _appState, files) => {
              const fingerprint = `${elements.length}:${elements.reduce((s, e) => s + (e.version || 0), 0)}:${Object.keys(files).length}`;
              if (isInitialLoadRef.current) {
                lastFingerprintRef.current = fingerprint;
                isInitialLoadRef.current = false;
                return;
              }
              if (fingerprint !== lastFingerprintRef.current) {
                lastFingerprintRef.current = fingerprint;
                isDirtyRef.current = true;
              }
            }}
            initialData={{
              ...excalidrawData,
              scrollToContent: true,
            }}
            theme={computedColorScheme}
          />
        </Suspense>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <NodeViewWrapper data-drag-handle>
      {editModal}

      {/* Preview card */}
      <Card
        radius="md"
        onClick={(e) => e.detail === 2 && handleOpen()}
        p="xs"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
        }}
        withBorder
        className={clsx(selected ? "ProseMirror-selectednode" : "")}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <ActionIcon variant="transparent" color="gray">
            <IconEdit size={18} />
          </ActionIcon>
          <Text component="span" size="lg" c="dimmed">
            {t("Double-click to edit Excalidraw diagram")}
          </Text>
        </div>
      </Card>
    </NodeViewWrapper>
  );
}
