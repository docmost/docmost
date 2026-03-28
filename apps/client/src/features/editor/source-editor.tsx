import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { useComputedColorScheme } from "@mantine/core";
import CodeMirror, {
  type ReactCodeMirrorRef,
  type ViewUpdate,
} from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { EditorView } from "@codemirror/view";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import classes from "@/features/editor/styles/source-editor.module.css";

/**
 * Lightweight HTML pretty-printer. Adds newlines and indentation around block
 * elements so the raw HTML from TipTap is human-readable. Does not modify
 * inline content or text nodes.
 */
function formatHtml(raw: string): string {
  const BLOCK_TAGS =
    /^(html|head|body|div|p|ul|ol|li|table|thead|tbody|tfoot|tr|th|td|colgroup|col|blockquote|pre|h[1-6]|details|summary|section|article|nav|header|footer|main|form|fieldset|figure|figcaption|hr|br)$/i;

  let result = "";
  let indent = 0;
  const pad = () => "  ".repeat(indent);

  // Split into tags and text segments.
  const tokens = raw.split(/(<\/?[^>]+>)/g).filter(Boolean);

  for (const token of tokens) {
    // Closing tag
    const closingMatch = token.match(/^<\/(\w+)/);
    if (closingMatch) {
      const tag = closingMatch[1];
      if (BLOCK_TAGS.test(tag)) {
        indent = Math.max(0, indent - 1);
        result += `\n${pad()}${token}`;
        continue;
      }
    }
    // Opening / self-closing / void tag
    else {
      const openingMatch = token.match(/^<(\w+)[^>]*\/?>$/);
      if (openingMatch) {
        const tag = openingMatch[1];
        if (BLOCK_TAGS.test(tag)) {
          result += `\n${pad()}${token}`;
          // Only increase indent if not self-closing / void
          if (!/\/>$/.test(token) && !/^(br|hr|col|img|input|meta|link)$/i.test(tag)) {
            indent++;
          }
          continue;
        }
      }
    }
    // Text node or inline tag — append as-is.
    result += token;
  }

  return result.trim();
}

export default function SourceEditor() {
  const pageEditor = useAtomValue(pageEditorAtom);
  const colorScheme = useComputedColorScheme();
  const cmRef = useRef<ReactCodeMirrorRef>(null);
  const initializedRef = useRef(false);
  const latestContentRef = useRef("");
  const pageEditorRef = useRef(pageEditor);
  pageEditorRef.current = pageEditor;

  // Cache the first non-empty HTML so subsequent pageEditor changes (e.g.
  // editor recreation after Y.js extension loads) don't clobber user edits.
  const [initialValue] = useState(() => {
    if (!pageEditor) return "";
    return formatHtml(pageEditor.getHTML());
  });

  // If Y.js hasn't synced yet, the first read may be empty. Retry when
  // the editor atom updates and push new content via dispatch (not the
  // controlled value prop) so we don't overwrite user edits.
  useEffect(() => {
    if (!pageEditor) return;
    const prevWasEmpty =
      !latestContentRef.current || latestContentRef.current.trim() === "";
    if (!initializedRef.current || prevWasEmpty) {
      initializedRef.current = true;
      const formatted = formatHtml(pageEditor.getHTML());
      latestContentRef.current = formatted;

      if (prevWasEmpty && formatted && cmRef.current?.view) {
        const view = cmRef.current.view;
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: formatted },
        });
      }
    }
  }, [pageEditor]);

  // Apply content back to the TipTap editor on unmount only.
  useEffect(() => {
    return () => {
      const editor = pageEditorRef.current;
      if (!editor || !initializedRef.current || editor.isDestroyed) return;
      editor.chain().clearContent().setContent(latestContentRef.current).run();
    };
  }, []);

  const handleChange = useCallback((value: string, _viewUpdate: ViewUpdate) => {
    latestContentRef.current = value;
  }, []);

  const extensions = useMemo(
    () => [
      html(),
      EditorView.lineWrapping,
      EditorView.theme({
        "&": {
          fontSize: "var(--mantine-font-size-sm)",
        },
        ".cm-content": {
          fontFamily:
            'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace',
          padding: "0 1rem 20vh",
        },
        ".cm-gutters": {
          border: "none",
          background: "transparent",
        },
        ".cm-line": {
          lineHeight: "1.65",
        },
        "&.cm-focused": {
          outline: "none",
        },
      }),
    ],
    [],
  );

  return (
    <div className={classes.sourceEditorWrapper}>
      <CodeMirror
        ref={cmRef}
        value={initialValue}
        onChange={handleChange}
        extensions={extensions}
        theme={colorScheme === "dark" ? "dark" : "light"}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
          indentOnInput: true,
          tabSize: 2,
          searchKeymap: true,
        }}
        autoFocus
      />
    </div>
  );
}
