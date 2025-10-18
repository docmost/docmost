import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ActionIcon, CopyButton, Group, Select, Tooltip } from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck, IconCopy, IconZoomIn, IconZoomOut, IconZoomReset, IconExternalLink } from "@tabler/icons-react";
import classes from "./code-block.module.css";
import React from "react";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";

const MermaidView = React.lazy(
  () => import("@/features/editor/components/code-block/mermaid-view.tsx"),
);

export default function CodeBlockView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, updateAttributes, extension, editor, getPos } = props;
  const { language } = node.attrs;
  const [isSelected, setIsSelected] = useState(false);

  // Mermaid zoom and pan state with extended range (0.2x to 12x)
  const [scale, setScale] = useState<number>(1);
  const [position, setPosition] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [mermaidLink, setMermaidLink] = useState<string>("");

  // Throttled selection listener with try/catch to avoid rare getPos() races
  const rafRef = useRef(0);
  useEffect(() => {
    const onSel = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        try {
          const { from, to } = editor.state.selection;
          const pos = getPos();
          const end = pos + node.nodeSize;
          setIsSelected((from >= pos && from < end) || (to > pos && to <= end));
        } catch {
          // node may be temporarily detached; ignore
        }
      });
    };
    editor.on("selectionUpdate", onSel);
    return () => {
      cancelAnimationFrame(rafRef.current);
      editor.off("selectionUpdate", onSel);
    };
  }, [editor, getPos, node.nodeSize]);

  const changeLanguage = useCallback((newLanguage: string) => {
    updateAttributes({
      language: newLanguage ?? "",
    });
  }, [updateAttributes]);

  // Zoom handlers with event propagation prevention and extended range
  const handleZoomIn = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setScale((prev) => Math.min(prev + 0.25, 12));
  }, []);

  const handleZoomOut = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setScale((prev) => Math.max(prev - 0.25, 0.2));
  }, []);

  const handleResetZoom = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // Memoize callback to prevent unnecessary re-renders of MermaidView
  const handleLinkGenerated = useCallback((link: string) => {
    setMermaidLink(link);
  }, []);

  const isMermaidDiagram = language === "mermaid";
  const showMermaidControls = isMermaidDiagram && node.textContent.length > 0;
  const shouldHideCode = isMermaidDiagram && node.textContent.length > 0 && (!editor.isEditable || !isSelected);

  const isResetDisabled = Math.abs(scale - 1) < 0.01 && Math.abs(position.x) < 1 && Math.abs(position.y) < 1;

  return (
    <NodeViewWrapper className="codeBlock">
      <Group
        justify="flex-end"
        contentEditable={false}
        className={classes.menuGroup}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <Select
          placeholder="auto"
          checkIconPosition="right"
          data={extension.options.lowlight.listLanguages().sort()}
          value={language || null}
          onMouseDown={(e) => e.stopPropagation()}
          onChange={changeLanguage}
          searchable
          style={{ maxWidth: "130px" }}
          classNames={{ input: classes.selectInput }}
          disabled={!editor.isEditable}
        />

        {/* Mermaid zoom controls */}
        {showMermaidControls && (
          <>
            <Tooltip label={t("Zoom in")} withArrow position="bottom">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={handleZoomIn}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={scale >= 12}
              >
                <IconZoomIn size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label={t("Zoom out")} withArrow position="bottom">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={handleZoomOut}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={scale <= 0.2}
              >
                <IconZoomOut size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label={t("Reset view")} withArrow position="bottom">
              <ActionIcon
                variant="subtle"
                color="gray"
                onClick={handleResetZoom}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={isResetDisabled}
              >
                <IconZoomReset size={16} />
              </ActionIcon>
            </Tooltip>

            <Tooltip label={`${Math.round(scale * 100)}%`} withArrow position="bottom">
              <div
                style={{
                  padding: "0 8px",
                  fontSize: "12px",
                  color: "var(--mantine-color-gray-7)",
                  minWidth: "45px",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {Math.round(scale * 100)}%
              </div>
            </Tooltip>

            {mermaidLink && (
              <Tooltip label={t("Open in Mermaid Live")} withArrow position="bottom">
                <ActionIcon
                  component="a"
                  href={`https://mermaid.live/view#${mermaidLink}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="subtle"
                  color="gray"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconExternalLink size={16} />
                </ActionIcon>
              </Tooltip>
            )}
          </>
        )}

        <CopyButton value={node?.textContent} timeout={2000}>
          {({ copied, copy }) => (
            <Tooltip
              label={copied ? t("Copied") : t("Copy")}
              withArrow
              position="right"
            >
              <ActionIcon
                color={copied ? "teal" : "gray"}
                variant="subtle"
                onClick={(e) => {
                  e.stopPropagation();
                  copy();
                }}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>

      <pre
        spellCheck="false"
        hidden={shouldHideCode}
      >
        <NodeViewContent as="code" className={`language-${language}`} />
      </pre>

      {isMermaidDiagram && (
        <Suspense fallback={null}>
          <MermaidView
            props={props}
            scale={scale}
            position={position}
            setScale={setScale}
            setPosition={setPosition}
            onLinkGenerated={handleLinkGenerated}
          />
        </Suspense>
      )}
    </NodeViewWrapper>
  );
}
