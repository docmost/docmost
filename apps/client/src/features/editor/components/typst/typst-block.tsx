import { MutableRefObject, useCallback, useEffect, useRef, useState } from "react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Stack, Textarea, Box, Text } from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import classes from "./typst.module.css";
import { renderTypstToSvg } from "@/features/editor/utils";

export default function TypstBlockView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, updateAttributes, editor } = props;
  const resultRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const nodeViewRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState(50); // Percentage for left panel
  const [debouncedPreview] = useDebouncedValue(preview, 600);
  const resultJob = useRef(0);
  const previewJob = useRef(0);

  const editMode = node.attrs.editMode || 'inline';
  const scale = node.attrs.scale || 100;

  const renderOutput = useCallback(
    async (
      value: string,
      container: HTMLDivElement | null,
      jobRef: MutableRefObject<number>,
      applyScale: number = 100,
    ) => {
      if (!container) {
        return;
      }
      const job = jobRef.current + 1;
      jobRef.current = job;
      if (!value.trim()) {
        container.innerHTML = "";
        if (jobRef.current === job) {
          setError(null);
        }
        return;
      }
      try {
        const svg = await renderTypstToSvg(value);
        if (jobRef.current !== job) {
          return;
        }
        container.innerHTML = svg;
        
        const svgElement = container.querySelector('svg');
        if (svgElement && applyScale !== 100) {
          svgElement.style.transform = `scale(${applyScale / 100})`;
          svgElement.style.transformOrigin = 'center';
        }
        
        setError(null);
      } catch (err) {
        if (jobRef.current !== job) {
          return;
        }
        container.innerHTML = "";
        setError(t("Typst rendering error"));
      }
    },
    [t],
  );

  useEffect(() => {
    renderOutput(node.attrs.text ?? "", resultRef.current, resultJob, scale);
  }, [node.attrs.text, renderOutput, scale]);

  useEffect(() => {
    if (editMode === 'split') {
      renderOutput(debouncedPreview ?? "", previewRef.current, previewJob, scale);
    }
  }, [debouncedPreview, editMode, renderOutput, scale]);

  useEffect(() => {
    if (debouncedPreview === null) {
      return;
    }
    queueMicrotask(() => {
      updateAttributes({ text: debouncedPreview });
    });
  }, [debouncedPreview, updateAttributes]);

  useEffect(() => {
    if (props.selected && editMode === 'display') {
      setPreview(node.attrs.text ?? "");
    }
  }, [props.selected, node.attrs.text, editMode]);

  useEffect(() => {
    if (editMode !== 'display' && preview === null) {
      setPreview(node.attrs.text ?? "");
    } else if (editMode === 'display') {
      setPreview(null);
      setTimeout(() => {
        renderOutput(node.attrs.text ?? "", resultRef.current, resultJob, scale);
      }, 0);
    }
  }, [editMode, node.attrs.text, preview, renderOutput, scale]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      updateAttributes({ editMode: 'display' });
      return;
    }

    if (!textAreaRef.current) {
      return;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editMode !== 'split') return;
    
    const startX = e.clientX;
    const startRatio = splitRatio;
    const container = nodeViewRef.current;
    if (!container) return;

    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width - 32; // pading

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newRatio = Math.min(Math.max(startRatio + deltaPercent, 20), 80);
      setSplitRatio(newRatio);
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const isReadonly = !editor.isEditable;

  if (editMode === 'display' || isReadonly) {
    return (
      <NodeViewWrapper
        ref={nodeViewRef}
        data-typst="true"
        className={
          [
            classes.typstBlock,
            classes.displayMode,
            props.selected ? classes.selected : "",
            error ? classes.error : "",
            !(node.attrs.text ?? "").trim().length ? classes.empty : "",
          ]
            .filter(Boolean)
            .join(" ")
        }
      >
        <div className={classes.displayContainer}>
          <div ref={resultRef} className={classes.displayContent}></div>
        </div>
        {!(node.attrs.text ?? "").trim().length && (
          <div>{t("Empty equation")}</div>
        )}
        {error && <div>{t("Error in equation")}</div>}
      </NodeViewWrapper>
    );
  }

  if (editMode === 'inline') {
    return (
      <NodeViewWrapper
        ref={nodeViewRef}
        data-typst="true"
        className={[classes.typstBlock, classes.inlineEditor].filter(Boolean).join(" ")}
      >
        <Stack gap="sm">
          <Textarea
            minRows={6}
            maxRows={20}
            autosize
            resize="vertical"
            ref={textAreaRef}
            value={preview ?? ""}
            placeholder={"#set heading(level: 1)[Title]"}
            className={classes.inlineTextarea}
            onKeyDown={handleKeyDown}
            onChange={(event) => setPreview(event.target.value)}
            autoFocus
          />
          {error && (
            <Text size="sm" c="red">
              {error}
            </Text>
          )}
        </Stack>
      </NodeViewWrapper>
    );
  }

  if (editMode === 'split') {
    return (
      <NodeViewWrapper
        ref={nodeViewRef}
        data-typst="true"
        className={[classes.typstBlock, classes.splitView].filter(Boolean).join(" ")}
      >
        <Stack gap="sm">
          <div className={classes.splitContainer}>
            <div className={classes.splitEditor} style={{ width: `${splitRatio}%` }}>
              <Text size="xs" fw={500} mb="xs" c="dimmed">
                {t("Editor")}
              </Text>
              <Textarea
                minRows={8}
                maxRows={24}
                autosize
                resize="vertical"
                ref={textAreaRef}
                value={preview ?? ""}
                placeholder={"#set heading(level: 1)[Title]"}
                className={classes.splitTextarea}
                onKeyDown={handleKeyDown}
                onChange={(event) => setPreview(event.target.value)}
                autoFocus
              />
            </div>
            <div 
              className={classes.splitResizer}
              onMouseDown={handleMouseDown}
            />
            <div className={classes.splitPreview} style={{ width: `${100 - splitRatio}%` }}>
              <Text size="xs" fw={500} mb="xs" c="dimmed">
                {t("Preview")}
              </Text>
              <Box className={classes.previewContainer}>
                <div ref={previewRef}></div>
                {!preview?.trim() && (
                  <Text c="dimmed" ta="center" py="xl">
                    {t("Empty equation")}
                  </Text>
                )}
              </Box>
            </div>
          </div>
          {error && (
            <Text size="sm" c="red">
              {error}
            </Text>
          )}
        </Stack>
      </NodeViewWrapper>
    );
  }

  return null;
}
