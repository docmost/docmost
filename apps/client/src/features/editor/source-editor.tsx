import React, { useCallback, useEffect, useRef, useState } from "react";
import { useAtomValue } from "jotai";
import { pageEditorAtom } from "@/features/editor/atoms/editor-atoms";
import { htmlToMarkdown, markdownToHtml } from "@docmost/editor-ext";
import classes from "@/features/editor/styles/source-editor.module.css";

export default function SourceEditor() {
  const pageEditor = useAtomValue(pageEditorAtom);
  const [sourceContent, setSourceContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initializedRef = useRef(false);
  // Refs kept up-to-date synchronously so unmount cleanup never closes over
  // stale values without needing them in any dep array.
  const latestContentRef = useRef("");
  const pageEditorRef = useRef(pageEditor);
  // Update synchronously on every render (safe for refs)
  pageEditorRef.current = pageEditor;

  // Initialize source content from the editor's current HTML.
  // Re-initializes if the editor was empty on first read, which happens when
  // Y.js hasn't finished loading content yet (e.g. user opens source mode
  // before the collaborative session has synced).
  useEffect(() => {
    if (!pageEditor) return;
    const prevWasEmpty =
      !latestContentRef.current || latestContentRef.current.trim() === "";
    if (!initializedRef.current || prevWasEmpty) {
      initializedRef.current = true;
      const html = pageEditor.getHTML();
      const markdown = htmlToMarkdown(html);
      setSourceContent(markdown);
      latestContentRef.current = markdown;
    }
  }, [pageEditor]);

  // Keep latestContentRef in sync so the unmount cleanup always sees the
  // most recent value without requiring it in a dep array.
  useEffect(() => {
    latestContentRef.current = sourceContent;
  }, [sourceContent]);

  // Focus textarea when source mode opens.
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Apply content back to the editor on unmount only (empty deps).
  // Using pageEditorRef instead of pageEditor in the dep array ensures this
  // cleanup only runs on real unmount, not whenever the editor reference
  // changes (e.g. editor recreation after Y.js extension loads).
  useEffect(() => {
    return () => {
      const editor = pageEditorRef.current;
      // Guard: no editor, never initialized, or editor already destroyed
      // (can happen during page-navigation teardown).
      if (!editor || !initializedRef.current || editor.isDestroyed) return;

      const result = markdownToHtml(latestContentRef.current);

      const apply = (html: string) => {
        if (editor.isDestroyed) return;
        // chain().clearContent().setContent() is the same pattern used by
        // use-history-restore.tsx and reliably replaces content in a
        // Y.js-backed editor without leaving orphaned CRDT nodes.
        editor.chain().clearContent().setContent(html).run();
      };

      // markdownToHtml returns string | Promise<string>; handle both.
      if (result instanceof Promise) {
        result.then(apply);
      } else {
        apply(result);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Allow Tab key to insert spaces instead of moving focus.
      if (e.key === "Tab") {
        e.preventDefault();
        const target = e.currentTarget;
        const start = target.selectionStart;
        const end = target.selectionEnd;
        const newValue =
          sourceContent.substring(0, start) +
          "  " +
          sourceContent.substring(end);
        setSourceContent(newValue);
        // Restore cursor position after state update.
        requestAnimationFrame(() => {
          target.selectionStart = start + 2;
          target.selectionEnd = start + 2;
        });
      }
    },
    [sourceContent],
  );

  return (
    <div className={classes.sourceEditorWrapper}>
      <textarea
        ref={textareaRef}
        className={classes.sourceTextarea}
        value={sourceContent}
        onChange={(e) => setSourceContent(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
      />
    </div>
  );
}
