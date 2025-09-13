import { NodeViewContent, NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { ActionIcon, CopyButton, Group, Select, Tooltip, TextInput } from "@mantine/core";
import { useEffect, useState, useRef } from "react";
import { IconCheck, IconCopy, IconDownload, IconTextWrap, IconTextWrapDisabled, IconEyeOff, IconEye } from "@tabler/icons-react";
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
  const { language, title, wrapLines = true, hideHeader = false } = node.attrs;
  const [languageValue, setLanguageValue] = useState<string | null>(
    language || null,
  );
  const [titleValue, setTitleValue] = useState<string>(title || "");
  const [isSelected, setIsSelected] = useState(false);
  const codeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setLanguageValue(language || null);
  }, [language]);

  useEffect(() => {
    setTitleValue(title || "");
  }, [title]);

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

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const selection = editor.state.selection;
      const nodePos = getPos();
      const nodeEnd = nodePos + node.nodeSize;
      
      if (selection.from >= nodePos && selection.to <= nodeEnd) {
        event.preventDefault();
        event.stopPropagation();
        
        const text = event.clipboardData?.getData("text/plain");
        if (text) {
          const { state, view } = editor;
          const { tr } = state;
          const { from, to } = state.selection;
          
          tr.replaceWith(from, to, state.schema.text(text));
          view.dispatch(tr);
        }
      }
    };

    document.addEventListener("paste", handlePaste, true);
    
    return () => {
      document.removeEventListener("paste", handlePaste, true);
    };
  }, [editor, getPos, node.nodeSize]);

  function changeLanguage(language: string) {
    setLanguageValue(language);
    updateAttributes({
      language: language,
    });
  }

  function changeTitle(title: string) {
    setTitleValue(title);
    updateAttributes({
      title: title || null,
    });
  }

  function toggleWrapLines() {
    updateAttributes({
      wrapLines: !wrapLines,
    });
  }

  function toggleHeaderVisibility() {
    updateAttributes({
      hideHeader: !hideHeader,
    });
  }

  function downloadCode() {
    const content = node?.textContent || "";
    let filename = titleValue || "code";
    
    const hasExtension = filename.includes('.') && filename.lastIndexOf('.') > filename.lastIndexOf('/');
    if (!hasExtension && languageValue) {
      filename += `.${languageValue}`;
    }
    if (!hasExtension && !languageValue) {
      filename += '.txt';
    }
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <NodeViewWrapper className="codeBlock">
      {!hideHeader && (
        <Group
          justify="space-between"
          contentEditable={false}
          className={classes.headerGroup}
          mb={4}
        >
          <div className={classes.titleContainer}>
            {editor.isEditable ? (
              <TextInput
                placeholder={t("Title")}
                value={titleValue}
                onChange={(e) => changeTitle(e.target.value)}
                variant="unstyled"
                size="xs"
                className={classes.titleInput}
              />
            ) : (
              titleValue && (
                <div className={classes.titleDisplay}>
                  {titleValue}
                </div>
              )
            )}
          </div>
          
          <Group gap="xs" className={classes.actionsGroup}>
            <Tooltip label={hideHeader ? t("Show header") : t("Hide header")} withArrow position="top">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={toggleHeaderVisibility}
              >
                {hideHeader ? <IconEye size={14} /> : <IconEyeOff size={14} />}
              </ActionIcon>
            </Tooltip>

            <Tooltip label={wrapLines ? t("Disable line wrap") : t("Enable line wrap")} withArrow position="top">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={toggleWrapLines}
              >
                {wrapLines ? <IconTextWrapDisabled size={14} /> : <IconTextWrap size={14} />}
              </ActionIcon>
            </Tooltip>

            <Select
              placeholder="auto"
              checkIconPosition="right"
              data={extension.options.lowlight.listLanguages().sort()}
              value={languageValue}
              onChange={changeLanguage}
              searchable
              size="xs"
              style={{ minWidth: "100px" }}
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
      )}

      <pre
        spellCheck="false"
        className={wrapLines ? classes.wrapLines : classes.noWrapLines}
        hidden={
          ((language === "mermaid" && !editor.isEditable) ||
            (language === "mermaid" && !isSelected)) &&
          node.textContent.length > 0
        }
      >
        {hideHeader && (
          <div className={classes.hiddenHeaderActions}>
            <Tooltip label={t("Show header")} withArrow position="top">
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                onClick={toggleHeaderVisibility}
                className={classes.showHeaderButton}
              >
                <IconEye size={14} />
              </ActionIcon>
            </Tooltip>
          </div>
        )}
        <NodeViewContent as="code" className={`language-${language}`} ref={codeRef} />
      </pre>

      {language === "mermaid" && (
        <Suspense fallback={null}>
          <MermaidView props={props} />
        </Suspense>
      )}
    </NodeViewWrapper>
  );
}
