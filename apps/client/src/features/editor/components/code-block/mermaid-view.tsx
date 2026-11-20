import { NodeViewProps, useEditorState } from "@tiptap/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  detectType,
  DiagramType,
  load,
  mount,
  Mounted,
  parse,
  registered,
} from "pele/lazy";
import classes from "./code-block.module.css";
import { useTranslation } from "react-i18next";

interface MermaidViewProps {
  props: NodeViewProps;
}

export default function MermaidView({ props }: MermaidViewProps) {
  const { t } = useTranslation();
  const { node, editor } = props;
  const source = node.textContent;
  const containerRef = useRef<HTMLDivElement>(null);
  const diagramRef = useRef<Mounted | null>(null);
  const [settledType, setSettledType] = useState<DiagramType | null>(null);
  const isEditable = useEditorState({
    editor,
    selector: (ctx) => ctx.editor?.isEditable ?? false,
  });

  const type = useMemo(() => {
    try {
      return detectType(source);
    } catch {
      return null;
    }
  }, [source]);

  // Diagram types load on demand; one that failed to load still mounts so Pele shows the error.
  const isTypeLoaded = !type || registered(type) || settledType === type;

  // Pele skips redraws while the container is hidden, so validity comes from the source.
  const isInvalid = useMemo(() => {
    if (!source || !isTypeLoaded) return false;
    try {
      parse(source);
      return false;
    } catch {
      return true;
    }
  }, [source, isTypeLoaded]);

  // Zoom makes wide diagrams focusable, which would pull focus away from editing.
  const zoom = useMemo(
    () =>
      !isEditable && {
        labels: {
          zoomIn: t("Zoom in"),
          zoomOut: t("Zoom out"),
          reset: t("Reset zoom"),
        },
      },
    [isEditable, t],
  );

  useEffect(() => {
    if (isTypeLoaded) return;
    const settle = () => setSettledType(type);
    load(type).then(settle, settle);
  }, [type, isTypeLoaded]);

  useEffect(() => {
    if (!source) {
      diagramRef.current?.destroy();
      diagramRef.current = null;
      containerRef.current.replaceChildren();
      return;
    }
    if (!isTypeLoaded) return;
    if (diagramRef.current) {
      diagramRef.current.update(source, { zoom });
      return;
    }
    diagramRef.current = mount(containerRef.current, source, { zoom });
  }, [source, zoom, isTypeLoaded]);

  useEffect(() => () => diagramRef.current?.destroy(), []);

  const showReaderError = isInvalid && !isEditable;

  return (
    <>
      <div
        ref={containerRef}
        className={classes.mermaid}
        contentEditable={false}
        hidden={showReaderError}
      />
      {showReaderError && (
        <div className={classes.error} contentEditable={false}>
          {t("Invalid Mermaid diagram")}
        </div>
      )}
    </>
  );
}
