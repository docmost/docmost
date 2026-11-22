import "@/features/editor/styles/index.css";
import React, { useEffect, useMemo, useState } from "react";
import { Editor, EditorProvider } from "@tiptap/react";
import { mainExtensions } from "@/features/editor/extensions/extensions";
import { Document } from "@tiptap/extension-document";
import { Heading, RecentlyUpdated, UniqueID } from "@docmost/editor-ext";
import { Text } from "@tiptap/extension-text";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useAtom } from "jotai";
import {
  lightboxRequestAtom,
  readOnlyEditorAtom,
} from "@/features/editor/atoms/editor-atoms.ts";
import { useEditorScroll } from "./hooks/use-editor-scroll";
import { TransclusionLookupProvider } from "@/features/editor/components/transclusion/transclusion-lookup-context";
import LightboxView, {
  getLightboxClickRequest,
} from "@/features/editor/components/common/lightbox-view";
import { MicrosoftFullscreenModal } from "@/features/editor/components/microsoft/microsoft-fullscreen-modal.tsx";
import { publicImageLink } from "./components/image/public-image-link";
import { useImageLinkNavigation } from "./components/image/use-image-link-navigation";

interface PageEditorProps {
  title: string;
  content: any;
  pageId?: string;
  printMode?: boolean;
  /**
   * When rendering inside a public share, pass the share's id (or key). Lookups
   * for transclusion content then resolve against the share graph instead of
   * the viewer's personal permissions, so a share never leaks source content
   * that isn't itself shared.
   */
  shareId?: string;
  /**
   * When rendering inside a public space, pass the space slug. Transclusion
   * lookups then resolve against the published space instead of the viewer's
   * personal permissions.
   */
  spaceSlug?: string;
  /** Rendered between the title and the content. */
  byline?: React.ReactNode;
  /** Set false when the consumer renders its own end matter (e.g. prev/next). */
  trailingSpace?: boolean;
  /** Opens media in the lightbox on click outside public views too. */
  withLightbox?: boolean;
}

export default function ReadonlyPageEditor({
  title,
  content,
  pageId,
  printMode = false,
  shareId,
  spaceSlug,
  byline,
  trailingSpace = true,
  withLightbox = false,
}: PageEditorProps) {
  const [, setReadOnlyEditor] = useAtom(readOnlyEditorAtom);
  const [lightboxRequest, setLightboxRequest] = useAtom(lightboxRequestAtom);
  const [contentEditor, setContentEditor] = useState<Editor | null>(null);
  const handleImageLink = useImageLinkNavigation();
  const lightboxEnabled = withLightbox || Boolean(shareId || spaceSlug);
  useEditorScroll(contentEditor);

  useEffect(() => {
    if (!lightboxEnabled) return;
    setLightboxRequest(null);
  }, [pageId, lightboxEnabled]);

  const extensions = useMemo(() => {
    const excludedExtensions = new Set([
      "uniqueID",
      ...(printMode
        ? ["tableHeaderPin", "tableReadonlySort", RecentlyUpdated.name]
        : []),
    ]);
    const filteredExtensions = mainExtensions
      .filter((ext) => !excludedExtensions.has(ext.name))
      .map((ext) =>
        ext.name === "image" && (shareId || spaceSlug)
          ? ext.configure({
              resolveLink: (href: string) => publicImageLink(href, shareId, spaceSlug),
            })
          : ext,
      );

    return [
      ...filteredExtensions,
      ...(printMode ? [RecentlyUpdated] : []),
      UniqueID.configure({
        types: ["heading", "paragraph"],
        updateDocument: false,
      }),
    ];
  }, [printMode, shareId, spaceSlug]);

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
    <TransclusionLookupProvider shareId={shareId} spaceSlug={spaceSlug}>
      <div className="page-title">
        <EditorProvider
          editable={false}
          immediatelyRender={true}
          textDirection="auto"
          extensions={titleExtensions}
          content={title}
        ></EditorProvider>
      </div>

      {byline}

      <EditorProvider
        editable={false}
        immediatelyRender={true}
        textDirection="auto"
        extensions={extensions}
        content={content}
        editorContainerProps={{ onClick: handleImageLink }}
        editorProps={
          lightboxEnabled
            ? {
                handleClickOn: (_view, _pos, node) => {
                  const request = getLightboxClickRequest(node);
                  if (!request) return false;

                  setLightboxRequest(request);
                  return true;
                },
              }
            : {}
        }
        onCreate={({ editor }) => {
          if (editor) {
            if (pageId) {
              // @ts-ignore
              editor.storage.pageId = pageId;
            }
            // @ts-ignore
            setReadOnlyEditor(editor);
            setContentEditor(editor);
          }
        }}
      ></EditorProvider>
      {lightboxEnabled && contentEditor && (
        <LightboxView
          editor={contentEditor}
          open={!!lightboxRequest}
          src={lightboxRequest?.src ?? ""}
          type={lightboxRequest?.type ?? "image"}
          onClose={() => setLightboxRequest(null)}
        />
      )}
      <MicrosoftFullscreenModal />
      {trailingSpace && <div style={{ paddingBottom: "20vh" }}></div>}
    </TransclusionLookupProvider>
  );
}
