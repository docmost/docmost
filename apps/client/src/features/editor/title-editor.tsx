import "@/features/editor/styles/index.css";
import React, { useCallback, useEffect, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import { Document } from "@tiptap/extension-document";
import { Heading } from "@tiptap/extension-heading";
import { Text } from "@tiptap/extension-text";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useAtomValue } from "jotai";
import {
  pageEditorAtom,
  titleEditorAtom,
} from "@/features/editor/atoms/editor-atoms";
import { updatePageData, useUpdateTitlePageMutation } from "@/features/page/queries/page-query";
import { useDebouncedCallback } from "@mantine/hooks";
import { useAtom } from "jotai";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { History } from "@tiptap/extension-history";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import EmojiCommand from "@/features/editor/extensions/emoji-command.ts";
import { UpdateEvent } from "@/features/websocket/types";
import localEmitter from "@/lib/local-emitter.ts";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom.ts";
import { PageEditMode } from "@/features/user/types/user.types.ts";

export interface TitleEditorProps {
  pageId: string;
  slugId: string;
  title: string;
  spaceSlug: string;
  editable: boolean;
}

export function TitleEditor({
  pageId,
  slugId,
  title,
  spaceSlug,
  editable,
}: TitleEditorProps) {
  const { t } = useTranslation();
  const { mutateAsync: updateTitlePageMutationAsync } = useUpdateTitlePageMutation();
  const pageEditor = useAtomValue(pageEditorAtom);
  const [, setTitleEditor] = useAtom(titleEditorAtom);
  const emit = useQueryEmit();
  const navigate = useNavigate();
  const [activePageId, setActivePageId] = useState(pageId);
  const [currentUser] = useAtom(currentUserAtom);
  const userPageEditMode =
    currentUser?.user?.settings?.preferences?.pageEditMode ?? PageEditMode.Edit;
  const userSpellcheckPref = currentUser?.user?.settings?.preferences?.spellcheck ?? true;

  const titleEditor = useEditor({
    extensions: [
      Document.extend({
        content: "heading",
      }),
      Heading.configure({
        levels: [1],
      }),
      Text,
      Placeholder.configure({
        placeholder: t("Untitled"),
        showOnlyWhenEditable: false,
      }),
      History.configure({
        depth: 20,
      }),
      EmojiCommand,
    ],
    onCreate({ editor }) {
      if (editor) {
        // @ts-ignore
        setTitleEditor(editor);
        setActivePageId(pageId);
      }
    },
    onUpdate({ editor }) {
      debounceUpdate();
    },
    editable: editable,
    content: title,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
  });

  useEffect(() => {
    const pageSlug = buildPageUrl(spaceSlug, slugId, title);
    navigate(pageSlug, { replace: true });
  }, [title]);

  const saveTitle = useCallback(() => {
    if (!titleEditor || activePageId !== pageId) return;

    if (
      titleEditor.getText() === title ||
      (titleEditor.getText() === "" && title === null)
    ) {
      return;
    }

    updateTitlePageMutationAsync({
      pageId: pageId,
      title: titleEditor.getText(),
    }).then((page) => {
      const event: UpdateEvent = {
        operation: "updateOne",
        spaceId: page.spaceId,
        entity: ["pages"],
        id: page.id,
        payload: { title: page.title, slugId: page.slugId, parentPageId: page.parentPageId, icon: page.icon },
      };

      if (page.title !== titleEditor.getText()) return;

      updatePageData(page);

      localEmitter.emit("message", event);
      emit(event);
    });
  }, [pageId, title, titleEditor]);

  const debounceUpdate = useDebouncedCallback(saveTitle, 500);

  useEffect(() => {
    if (titleEditor && title !== titleEditor.getText()) {
      titleEditor.commands.setContent(title);
    }
  }, [pageId, title, titleEditor]);

  useEffect(() => {
    setTimeout(() => {
      titleEditor?.commands.focus("end");
    }, 500);
  }, [titleEditor]);

  useEffect(() => {
    return () => {
      // force-save title on navigation
      saveTitle();
    };
  }, [pageId]);

  useEffect(() => {
    // honor user default page edit mode preference
    if (userPageEditMode && titleEditor && editable) {
      if (userPageEditMode === PageEditMode.Edit) {
        titleEditor.setEditable(true);
      } else if (userPageEditMode === PageEditMode.Read) {
        titleEditor.setEditable(false);
      }
    }
  }, [userPageEditMode, titleEditor, editable]);

  function handleTitleKeyDown(event: any) {
    if (!titleEditor || !pageEditor || event.shiftKey) return;
    
    // Prevent focus shift when IME composition is active 
    // `keyCode === 229` is added to support Safari where `isComposing` may not be reliable
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    
    const { key } = event;
    const { $head } = titleEditor.state.selection;

    const shouldFocusEditor =
      key === "Enter" ||
      key === "ArrowDown" ||
      (key === "ArrowRight" && !$head.nodeAfter);

    if (shouldFocusEditor) {
      pageEditor.commands.focus("start");
    }
  }

  return <EditorContent editor={titleEditor} onKeyDown={handleTitleKeyDown} spellCheck={userSpellcheckPref} />;
}
