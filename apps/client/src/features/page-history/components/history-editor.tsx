import "@/features/editor/styles/index.css";
import classes from "@/features/editor/styles/editor.module.css";
import React, { useEffect, useMemo } from "react";
import { EditorContent, useEditor, Mark, mergeAttributes } from "@tiptap/react";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { Document } from "@tiptap/extension-document";
import { Heading } from "@tiptap/extension-heading";
import { Text } from "@tiptap/extension-text";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useTranslation } from "react-i18next";
import { Container } from "@mantine/core";
import { computeDiff } from "../utils/diff";
import { generateHTML } from "@tiptap/core";
import clsx from "clsx";

// Custom mark to handle both additions and deletions with background blocks
const DiffMark = Mark.create({
  name: 'diffMark',
  addAttributes() {
    return {
      type: {
        default: 'none',
        parseHTML: element => element.getAttribute('data-diff-type'),
        renderHTML: attributes => ({ 'data-diff-type': attributes.type }),
      },
    }
  },
  parseHTML() {
    return [
      { tag: 'span[data-diff-type]' },
      { tag: 'ins' },
      { tag: 'del' },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    const type = HTMLAttributes['data-diff-type'];
    let style = "";
    
    if (type === 'add') {
      style = 'background-color: #acf2bd !important; color: #1e3a22 !important; padding: 2px 0; border-radius: 2px; text-decoration: none !important; box-decoration-break: clone; -webkit-box-decoration-break: clone;';
    } else if (type === 'remove') {
      style = 'background-color: #fdb8c0 !important; color: #4b1113 !important; text-decoration: line-through !important; padding: 2px 0; border-radius: 2px; box-decoration-break: clone; -webkit-box-decoration-break: clone;';
    }

    return ['span', mergeAttributes(HTMLAttributes, { style }), 0]
  },
});

export interface HistoryEditorProps {
  title: string;
  content: any;
  previousTitle?: string;
  previousContent?: any;
}

export function HistoryEditor({
  title,
  content,
  previousTitle,
  previousContent,
}: HistoryEditorProps) {
  const { t } = useTranslation();

  const historyExtensions = useMemo(() => [
    ...mainExtensions,
    DiffMark,
  ], []);

  const diffTitle = useMemo(() => {
    const displayTitle = title || t("Untitled");
    if (!previousTitle || title === previousTitle) return `<h1>${displayTitle}</h1>`;
    
    const diffs = computeDiff(previousTitle, title);
    const html = diffs
      .map((d) => {
        if (d.type === "add") {
          return `<span data-diff-type="add">${d.value}</span>`;
        }
        if (d.type === "remove") {
          return `<span data-diff-type="remove">${d.value}</span>`;
        }
        return d.value;
      })
      .join("");
    return `<h1>${html}</h1>`;
  }, [title, previousTitle, t]);

  const diffContent = useMemo(() => {
    const currentHTML = generateHTML(content, mainExtensions);
    if (!previousContent) return currentHTML;

    const previousHTML = generateHTML(previousContent, mainExtensions);
    if (currentHTML === previousHTML) return currentHTML;

    const diffs = computeDiff(previousHTML, currentHTML);
    return diffs
      .map((d) => {
        const isTag = d.value.startsWith('<') && d.value.endsWith('>');
        if (isTag) return d.value;

        if (d.type === "add") {
          return `<span data-diff-type="add">${d.value}</span>`;
        }
        if (d.type === "remove") {
          return `<span data-diff-type="remove">${d.value}</span>`;
        }
        return d.value;
      })
      .join("");
  }, [content, previousContent]);

  const titleEditor = useEditor({
    extensions: [
      Document.extend({ content: "heading" }),
      Heading.configure({ levels: [1] }),
      Text,
      DiffMark,
      Placeholder.configure({
        placeholder: t("Untitled"),
        showOnlyWhenEditable: false,
      }),
    ],
    editable: false,
    immediatelyRender: false,
  });

  const contentEditor = useEditor({
    extensions: historyExtensions,
    editable: false,
    immediatelyRender: false,
  });

  useEffect(() => {
    if (titleEditor) {
      titleEditor.commands.setContent(diffTitle, false);
    }
  }, [diffTitle, titleEditor]);

  useEffect(() => {
    if (contentEditor) {
      contentEditor.commands.setContent(diffContent, false);
    }
  }, [diffContent, contentEditor]);

  return (
    <Container 
      size={900} 
      className={clsx(classes.editor)}
      style={{ position: 'relative' }}
    >
      {/* Global CSS to ensure Red/Green blocks are always visible */}
      <style dangerouslySetInnerHTML={{ __html: `
        .tiptap span[data-diff-type="add"] {
          background-color: #acf2bd !important;
          color: #1e3a22 !important;
          padding: 2px 0;
          border-radius: 2px;
          text-decoration: none !important;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
        }
        .tiptap span[data-diff-type="remove"] {
          background-color: #fdb8c0 !important;
          color: #4b1113 !important;
          text-decoration: line-through !important;
          padding: 2px 0;
          border-radius: 2px;
          box-decoration-break: clone;
          -webkit-box-decoration-break: clone;
        }
      `}} />

      <div className={classes.titleEditor}>
        <EditorContent editor={titleEditor} />
      </div>

      <div className="editor-container">
        <div>
          <EditorContent editor={contentEditor} />
        </div>
      </div>
      
      {/* Overlay to block interaction */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 100,
        pointerEvents: 'auto',
        userSelect: 'none',
        cursor: 'default'
      }} />
    </Container>
  );
}
