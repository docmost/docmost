import "@/features/editor/styles/index.css";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { EditorProvider } from "@tiptap/react";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { Document } from "@tiptap/extension-document";
import { Heading, generateNodeId, UniqueID } from "@docmost/editor-ext";
import { Text } from "@tiptap/extension-text";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useAtom } from "jotai";
import { readOnlyEditorAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { useEditorScroll } from "./hooks/use-editor-scroll";

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
  const isComponentMounted = useRef(false);
  const editorCreated = useRef(false);

  const canScroll = useCallback(
    () => isComponentMounted.current && editorCreated.current,
    [isComponentMounted, editorCreated],
  );
  const initialScrollTo = window.location.hash
    ? window.location.hash.slice(1)
    : "";
  const { handleScrollTo } = useEditorScroll({ canScroll, initialScrollTo });

  useEffect(() => {
    isComponentMounted.current = true;
  }, []);

  const extensions = useMemo(() => {
    const filteredExtensions = mainExtensions.filter(
      (ext) => ext.name !== "uniqueID",
    );

    return [
      ...filteredExtensions,
      UniqueID.configure({
        types: ["heading", "paragraph"],
        updateDocument: false,
      }),
    ];
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
              // @ts-ignore
              editor.storage.pageId = pageId;
            }
            // @ts-ignore
            setReadOnlyEditor(editor);

            handleScrollTo(editor);
            editorCreated.current = true;
          }
        }}
      ></EditorProvider>
      <div style={{ paddingBottom: "20vh" }}></div>
    </>
  );
}
