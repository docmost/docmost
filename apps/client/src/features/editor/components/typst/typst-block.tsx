import {
  MutableRefObject,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import {
  Stack,
  Textarea,
  Box,
  Text,
  useComputedColorScheme,
} from "@mantine/core";
import { useDebouncedValue } from "@mantine/hooks";
import { useTranslation } from "react-i18next";
import classes from "./typst.module.css";
import { renderTypstToSvg } from "@/features/editor/utils";

const normalizeCssHeight = (
  value: string | number | null | undefined
): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    return `${value}px`;
  }

  const trimmed = value.trim();

  if (!trimmed.length) {
    return null;
  }

  if (trimmed.toLowerCase() === "auto") {
    return null;
  }

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const numeric = Number.parseFloat(trimmed);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      return `${numeric}px`;
    }
  }

  return trimmed;
};

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
  const computedColorScheme = useComputedColorScheme();
  const isDarkMode = computedColorScheme === "dark";

  const editMode = node.attrs.editMode || "display";
  const scale = node.attrs.scale || 100;
  const rawHeight = node.attrs.height as string | number | null | undefined;
  const heightCss = normalizeCssHeight(rawHeight);

  const renderOutput = useCallback(
    async (
      value: string,
      container: HTMLDivElement | null,
      jobRef: MutableRefObject<number>,
      applyScale: number = 100,
      maxHeight?: string | number | null,
      shouldInvert: boolean = false
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

        const normalizedMaxHeight = normalizeCssHeight(maxHeight);
        const svgElements = Array.from(
          container.querySelectorAll<SVGElement>("svg")
        );
        svgElements.forEach((svgElement) => {
          svgElement.style.removeProperty("transform");
          svgElement.style.removeProperty("transform-origin");
          {
            const widthAttr =
              svgElement.getAttribute("width") ?? svgElement.style.width;
            let numericWidth = Number.NaN;
            if (typeof widthAttr === "string" && widthAttr.trim().length) {
              numericWidth = parseFloat(widthAttr);
            }
            if (!Number.isFinite(numericWidth)) {
              const rect = svgElement.getBoundingClientRect();
              if (rect && Number.isFinite(rect.width)) {
                numericWidth = rect.width;
              }
            }
            if (Number.isFinite(numericWidth)) {
              const scaled = numericWidth * (applyScale / 100);
              svgElement.style.setProperty("width", `${scaled}px`, "important");
            } else {
              svgElement.style.removeProperty("width");
            }
          }
          svgElement.style.height = "auto";
          svgElement.style.maxWidth = "none";
          svgElement.style.display = "block";

          if (shouldInvert) {
            svgElement.style.filter = "invert(1) hue-rotate(180deg)";
          } else {
            svgElement.style.removeProperty("filter");
          }
        });

        container.style.width = "100%";
        container.style.overflowX = "auto";
        container.style.removeProperty("overflow");

        if (normalizedMaxHeight) {
          container.style.maxHeight = normalizedMaxHeight;
          container.style.height = normalizedMaxHeight;
          container.style.overflowY = "auto";
        } else {
          container.style.removeProperty("max-height");
          container.style.removeProperty("height");
          container.style.removeProperty("overflow-y");
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
    [t]
  );

  useEffect(() => {
    renderOutput(
      node.attrs.text ?? "",
      resultRef.current,
      resultJob,
      scale,
      heightCss,
      isDarkMode
    );
  }, [node.attrs.text, renderOutput, scale, heightCss, isDarkMode]);

  useEffect(() => {
    if (editMode === "split") {
      renderOutput(
        debouncedPreview ?? "",
        previewRef.current,
        previewJob,
        scale,
        heightCss,
        isDarkMode
      );
    }
  }, [debouncedPreview, editMode, renderOutput, scale, heightCss, isDarkMode]);

  useEffect(() => {
    if (debouncedPreview === null) {
      return;
    }
    queueMicrotask(() => {
      updateAttributes({ text: debouncedPreview });
    });
  }, [debouncedPreview, updateAttributes]);

  useEffect(() => {
    if (props.selected && editMode === "display") {
      setPreview(node.attrs.text ?? "");
    }
  }, [props.selected, node.attrs.text, editMode]);

  useEffect(() => {
    if (editMode !== "display" && preview === null) {
      setPreview(node.attrs.text ?? "");
    } else if (editMode === "display") {
      setPreview(null);
      setTimeout(() => {
        renderOutput(
          node.attrs.text ?? "",
          resultRef.current,
          resultJob,
          scale,
          heightCss,
          isDarkMode
        );
      }, 0);
    }
  }, [
    editMode,
    node.attrs.text,
    preview,
    renderOutput,
    scale,
    heightCss,
    isDarkMode,
  ]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      updateAttributes({ editMode: "display" });
      return;
    }

    if (!textAreaRef.current) {
      return;
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (editMode !== "split") return;

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
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const isReadonly = !editor.isEditable;

  if (editMode === "display" || isReadonly) {
    return (
      <NodeViewWrapper
        ref={nodeViewRef}
        data-typst="true"
        className={[
          classes.typstBlock,
          classes.displayMode,
          props.selected ? classes.selected : "",
          error ? classes.error : "",
          !(node.attrs.text ?? "").trim().length ? classes.empty : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className={classes.displayContainer}
          style={heightCss ? { height: heightCss } : undefined}
        >
          <div
            ref={resultRef}
            className={classes.displayContent}
            style={
              heightCss ? { maxHeight: heightCss, height: "100%" } : undefined
            }
          ></div>
        </div>
        {!(node.attrs.text ?? "").trim().length && (
          <div>{t("Empty equation")}</div>
        )}
        {error && <div>{t("Error in equation")}</div>}
      </NodeViewWrapper>
    );
  }

  if (editMode === "inline") {
    return (
      <NodeViewWrapper
        ref={nodeViewRef}
        data-typst="true"
        className={[classes.typstBlock, classes.inlineEditor]
          .filter(Boolean)
          .join(" ")}
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

  if (editMode === "split") {
    return (
      <NodeViewWrapper
        ref={nodeViewRef}
        data-typst="true"
        className={[classes.typstBlock, classes.splitView]
          .filter(Boolean)
          .join(" ")}
      >
        <Stack gap="sm">
          <div className={classes.splitContainer}>
            <div
              className={classes.splitEditor}
              style={{ width: `${splitRatio}%` }}
            >
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
                spellCheck={false}
                styles={{ input: { caretColor: "blue" } }}
              />
            </div>
            <div
              className={`${classes.splitResizer}`}
              style={{ marginLeft: "4px", marginRight: "4px" }}
              onMouseDown={handleMouseDown}
            />
            <div
              className={classes.splitPreview}
              style={{ width: `${100 - splitRatio}%` }}
            >
              <Text size="xs" fw={500} mb="xs" c="dimmed">
                {t("Preview")}
              </Text>
              <Box
                className={classes.previewContainer}
                style={heightCss ? { height: heightCss } : undefined}
              >
                <div
                  ref={previewRef}
                  style={
                    heightCss
                      ? { maxHeight: heightCss, height: "100%" }
                      : undefined
                  }
                ></div>
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
