import { useEffect, useRef, useState } from "react";
import { Button, Group, useComputedColorScheme } from "@mantine/core";
import {
  Excalidraw,
  exportScene,
  loadFromBlob,
  useHandleLibrary,
} from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import ReactClearModal from "react-clear-modal";
import { useTranslation } from "react-i18next";
import {
  type DiagramEditorProps,
  useDiagramDraft,
} from "../common/use-diagram-draft";
import { notifyDiagramSaveError } from "../common/diagram-save-error";
import { localStorageLibraryAdapter } from "./excalidraw-utils";

export function ExcalidrawEditor(props: DiagramEditorProps) {
  const { session } = props;
  const { t } = useTranslation();
  const theme = useComputedColorScheme();
  const [api, setApi] = useState<ExcalidrawImperativeAPI>(null);
  useHandleLibrary({ excalidrawAPI: api, adapter: localStorageLibraryAdapter });
  const [scene, setScene] = useState<
    Awaited<ReturnType<typeof loadFromBlob>> | null | undefined
  >(session.initial ? undefined : null);
  const fingerprint = useRef<string | null>(null);
  const draft = useDiagramDraft(props);
  useEffect(() => {
    if (!session.initial) return;
    let active = true;
    loadFromBlob(session.initial, null, null)
      .then((data) => {
        if (active) setScene(data);
      })
      .catch((error) => {
        if (active) {
          notifyDiagramSaveError(error);
          props.onClose();
        }
      });
    return () => {
      active = false;
    };
  }, [session]);

  async function exportSvg() {
    if (!api) throw new Error("Diagram editor is still loading");
    const svg = await exportScene({
      type: "svg",
      data: { elements: api.getSceneElements(), files: api.getFiles() },
      config: { embedScene: true, theme: "light" },
    });
    return new XMLSerializer()
      .serializeToString(svg)
      .replace(
        /https:\/\/unpkg\.com\/@excalidraw\/excalidraw@undefined/g,
        "https://unpkg.com/@excalidraw/excalidraw@latest",
      );
  }

  useEffect(() => {
    if (!api) return;
    const timer = setInterval(
      () => draft.autosave(exportSvg),
      session.previousAttachmentId ? 60_000 : 30_000,
    );
    return () => clearInterval(timer);
  }, [api, session]);

  return (
    <ReactClearModal
      isOpen
      onRequestClose={draft.requestClose}
      disableCloseOnBgClick
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)", padding: 0, zIndex: 200 }}
      contentProps={{ style: { padding: 0, width: "90vw" } }}
    >
      <Group
        justify="flex-end"
        wrap="nowrap"
        bg="var(--mantine-color-body)"
        p="xs"
      >
        <Button
          onClick={() => draft.publish(exportSvg)}
          size="compact-sm"
          disabled={!api}
          loading={draft.isSaving}
        >
          {t("Save & Exit")}
        </Button>
        <Button onClick={draft.requestClose} color="red" size="compact-sm">
          {t("Exit")}
        </Button>
      </Group>
      <div style={{ height: "90vh" }}>
        {scene !== undefined && (
          <Excalidraw
            onExcalidrawAPI={setApi}
            initialData={{ ...scene, scrollToContent: true }}
            onChange={(elements, _state, files) => {
              const next = `${elements.length}:${elements.reduce((n, e) => n + e.version, 0)}:${Object.keys(files).length}`;
              if (fingerprint.current !== null && fingerprint.current !== next)
                draft.markChanged();
              fingerprint.current = next;
            }}
            theme={theme}
          />
        )}
      </div>
    </ReactClearModal>
  );
}
