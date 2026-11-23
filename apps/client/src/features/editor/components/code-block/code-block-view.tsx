import { NodeViewContent, NodeViewProps, NodeViewWrapper, useEditorState } from "@tiptap/react";
import { ActionIcon, Group, Select, Tooltip } from "@mantine/core";
import { CopyButton } from "@/components/common/copy-button";
import { useLayoutEffect, useRef, useState } from "react";
import { IconCheck, IconCopy } from "@tabler/icons-react";
import classes from "./code-block.module.css";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { lazyWithPrefetch } from "@/lib/lazy-prefetch.ts";

const MermaidView = lazyWithPrefetch(
  () => import("@/features/editor/components/code-block/mermaid-view.tsx"),
);

export default function CodeBlockView(props: NodeViewProps) {
  const { t } = useTranslation();
  const { node, updateAttributes, extension, editor, getPos } = props;
  const { language } = node.attrs;
  const [languageValue, setLanguageValue] = useState<string | null>(
    language || null,
  );
  const [isSelected, setIsSelected] = useState(false);
  const isMermaid = language === "mermaid";
  const wasMermaid = useRef(isMermaid);

  // before paint, so a block that becomes mermaid does not hide its source for a frame
  useLayoutEffect(() => {
    // only mermaid hides its source, and finding a block's position is slow on long pages
    if (!isMermaid) {
      wasMermaid.current = false;
      return;
    }

    const updateSelection = () => {
      const { state } = editor;
      const { from, to } = state.selection;
      const pos = getPos();
      // Check if the selection intersects with the node's range
      const isNodeSelected =
        (from >= pos && from < pos + node.nodeSize) ||
        (to > pos && to <= pos + node.nodeSize);
      setIsSelected(isNodeSelected);
    };

    // the caret can already be in a block that just became mermaid
    if (!wasMermaid.current) updateSelection();
    wasMermaid.current = true;

    editor.on("selectionUpdate", updateSelection);
    return () => {
      editor.off("selectionUpdate", updateSelection);
    };
  }, [editor, isMermaid, getPos(), node.nodeSize]);

  const isEditable = useEditorState({
    editor,
    selector: ({ editor }) => editor?.isEditable ?? false,
  });

  function changeLanguage(language: string) {
    setLanguageValue(language);
    updateAttributes({
      language: language,
    });
  }

  return (
    <NodeViewWrapper className="codeBlock">
      <Group
        justify="flex-end"
        contentEditable={false}
        className={classes.menuGroup}
      >
        <Select
          placeholder="auto"
          checkIconPosition="right"
          data={extension.options.lowlight.listLanguages().sort()}
          value={languageValue}
          onChange={changeLanguage}
          searchable
          style={{ maxWidth: "130px" }}
          classNames={{ input: classes.selectInput }}
          disabled={!isEditable}
          // closed dropdowns stay mounted by default: one hidden list of every language per code block
          comboboxProps={{ keepMounted: false }}
        />

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
                onClick={copy}
              >
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>

      <pre
        spellCheck="false"
        hidden={
          ((language === "mermaid" && !isEditable) ||
            (language === "mermaid" && !isSelected)) &&
          node.textContent.length > 0
        }
      >
        {/* @ts-ignore */}
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
