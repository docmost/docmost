import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ActionIcon, CopyButton, Group, Select, Tooltip } from "@mantine/core";
import { useEffect, useState } from "react";
import {
  IconCheck,
  IconCopy,
  IconDownload,
  IconTextWrap,
  IconTextWrapDisabled,
} from "@tabler/icons-react";
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
  const { language, wrap } = node.attrs;
  const [languageValue, setLanguageValue] = useState<string | null>(
    language || null,
  );
  const [isSelected, setIsSelected] = useState(false);

  useEffect(() => {
    setLanguageValue(language || null);
  }, [language]);

  useEffect(() => {
    const updateSelection = () => {
      const { state } = editor;
      const { from, to } = state.selection;
      // Check if the selection intersects with the node's range
      const isNodeSelected =
        (from >= getPos() && from < getPos() + node.nodeSize) ||
        (to > getPos() && to <= getPos() + node.nodeSize);
      setIsSelected(isNodeSelected);
    };

    editor.on("selectionUpdate", updateSelection);
    return () => {
      editor.off("selectionUpdate", updateSelection);
    };
  }, [editor, getPos(), node.nodeSize]);

  function changeLanguage(language: string) {
    setLanguageValue(language);
    updateAttributes({
      language: language,
    });
  }

  function toggleWrapLines() {
    updateAttributes({
      wrap: !wrap,
    });
  }

  function downloadCode() {
    const content = node?.textContent || "";
    let filename = "code";

    const hasExtension =
      filename.includes(".") &&
      filename.lastIndexOf(".") > filename.lastIndexOf("/");
    if (!hasExtension && languageValue) {
      filename += `.${languageValue}`;
    }
    if (!hasExtension && !languageValue) {
      filename += ".txt";
    }

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <NodeViewWrapper className="codeBlock">
      <Group
        justify="space-between"
        contentEditable={false}
        className={classes.headerGroup}
        mb={0}
      >
        <Group gap="xs" className={classes.actionsGroup}>
          <Tooltip
            label={wrap ? t("Disable line wrap") : t("Enable line wrap")}
            withArrow
            position="top"
          >
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={toggleWrapLines}
            >
              {wrap ? (
                <IconTextWrapDisabled size={14} />
              ) : (
                <IconTextWrap size={14} />
              )}
            </ActionIcon>
          </Tooltip>

          <Select
            placeholder="auto"
            checkIconPosition="right"
            data={extension.options.lowlight.listLanguages().sort()}
            value={languageValue}
            onChange={changeLanguage}
            searchable
            size="sm"
            style={{ maxWidth: "130px" }}
            classNames={{ input: classes.selectInput }}
            disabled={!editor.isEditable}
          />

          <Tooltip label={t("Download code")} withArrow position="top">
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              onClick={downloadCode}
            >
              <IconDownload size={14} />
            </ActionIcon>
          </Tooltip>

          <CopyButton value={node?.textContent} timeout={2000}>
            {({ copied, copy }) => (
              <Tooltip
                label={copied ? t("Copied") : t("Copy")}
                withArrow
                position="top"
              >
                <ActionIcon
                  color={copied ? "teal" : "gray"}
                  variant="subtle"
                  size="sm"
                  onClick={copy}
                >
                  {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        </Group>
      </Group>

      <pre
        spellCheck="false"
        className={wrap ? classes.lineWrap : classes.noLineWrap}
        hidden={
          ((language === "mermaid" && !editor.isEditable) ||
            (language === "mermaid" && !isSelected)) &&
          node.textContent.length > 0
        }
      >
        <NodeViewContent as="code" className={`language-${language}`} />
      </pre>

      {language === "mermaid" && (
        <Suspense fallback={null}>
          <MermaidView props={props} />
        </Suspense>
      )}
    </NodeViewWrapper>
  );
}
