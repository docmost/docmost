import "@/features/editor/styles/index.css";
import React, { useMemo } from "react";
import { EditorProvider } from "@tiptap/react";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { Document } from "@tiptap/extension-document";
import { Heading } from "@tiptap/extension-heading";
import { Text } from "@tiptap/extension-text";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useAtom } from "jotai";
import { readOnlyEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";

interface PageEditorProps {
  title: string;
  content: any;
  pageId?: string;
}

export default function ReadonlyPageEditor({
  title,
  content,
  pageId,
}: PageEditorProps) {
  const [, setReadOnlyEditor] = useAtom(readOnlyEditorAtom);

  const extensions = useMemo(() => {
    return [...mainExtensions];
  }, []);

  const titleExtensions = [
    Document.extend({
      content: "heading",
    }),
    Heading,
    Text,
    Placeholder.configure({
      placeholder: "Untitled",
      showOnlyWhenEditable: false,
    }),
  ];

  return (
    <>
      <EditorProvider
        editable={false}
        immediatelyRender={true}
        extensions={titleExtensions}
        content={title}
      ></EditorProvider>

      <EditorProvider
        editable={false}
        immediatelyRender={true}
        extensions={extensions}
        content={content}
        onCreate={({ editor }) => {
          if (editor) {
            if (pageId) {
              editor.storage.pageId = pageId;
            }
            // @ts-ignore
            setReadOnlyEditor(editor);
          }
        }}
      ></EditorProvider>
      <div style={{ paddingBottom: "20vh" }}></div>
    </>
  );
}
