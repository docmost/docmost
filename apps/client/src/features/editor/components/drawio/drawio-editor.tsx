import { useEffect, useRef, useState } from "react";
import { LoadingOverlay, Modal, useComputedColorScheme } from "@mantine/core";
import { DrawIoEmbed, type DrawIoEmbedRef } from "react-drawio";
import { useTranslation } from "react-i18next";
import { getDrawioUrl } from "@/lib/config";
import { decodeBase64ToSvgString } from "@/lib/utils";
import {
  type DiagramEditorProps,
  useDiagramDraft,
} from "../common/use-diagram-draft";
import { notifyDiagramSaveError } from "../common/diagram-save-error";

function drawingModel(xml?: string) {
  if (!xml) return;
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const diagrams = Array.from(doc.getElementsByTagName("diagram"));
  if (diagrams.length) return diagrams.map((page) => page.outerHTML).join("");
  if (doc.documentElement.localName === "mxGraphModel")
    return doc.documentElement.outerHTML;
}

export function DrawioEditor(props: DiagramEditorProps) {
  const { session } = props;
  const { t } = useTranslation();
  const color = useComputedColorScheme();
  const frame = useRef<DrawIoEmbedRef>(null);
  const draft = useDiagramDraft(props);
  const initialModel = useRef<string | undefined>(undefined);
  const [initial, setInitial] = useState<string | null>(
    session.initial ? null : "",
  );

  useEffect(() => {
    if (!session.initial) return;
    const reader = new FileReader();
    reader.onload = () => setInitial(reader.result as string);
    reader.onerror = () => {
      notifyDiagramSaveError(reader.error);
      props.onClose();
    };
    reader.readAsDataURL(session.initial);
    return () => {
      reader.onload = null;
      reader.onerror = null;
    };
  }, [session]);

  useEffect(() => {
    const timer = setInterval(
      () => {
        if (draft.pending()) frame.current?.exportDiagram({ format: "xmlsvg" });
      },
      session.previousAttachmentId ? 60_000 : 30_000,
    );
    return () => clearInterval(timer);
  }, [session]);

  return (
    <Modal.Root
      opened
      onClose={draft.requestClose}
      fullScreen
      aria-label={t("Diagram editor")}
    >
      <Modal.Overlay />
      <Modal.Content style={{ overflow: "hidden" }}>
        <Modal.Body pos="relative">
          <LoadingOverlay visible={draft.isSaving || initial === null} />
          <div style={{ height: "100vh" }}>
            {initial !== null && (
              <DrawIoEmbed
                ref={frame}
                xml={initial}
                baseUrl={getDrawioUrl()}
                autosave
                urlParameters={{
                  ui: color === "light" ? "kennedy" : "dark",
                  spin: true,
                  libraries: true,
                  saveAndExit: true,
                  noSaveBtn: true,
                }}
                onLoad={(event) => {
                  initialModel.current = drawingModel(event.xml);
                }}
                onAutoSave={() => draft.markChanged()}
                onClose={(event) => {
                  if (!event.parentEvent) draft.requestClose();
                }}
                onExport={(event) => {
                  const exportSvg = () => decodeBase64ToSvgString(event.data);
                  if (event.message.parentEvent === "save") {
                    const model = drawingModel(event.xml);
                    if (
                      model &&
                      initialModel.current &&
                      model !== initialModel.current
                    )
                      draft.markChanged();
                    draft.publish(exportSvg);
                  } else {
                    draft.autosave(exportSvg);
                  }
                }}
              />
            )}
          </div>
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
