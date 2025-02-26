import "@/features/editor/styles/index.css";
import React, { useEffect, useState } from "react";
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
import { useUpdatePageMutation } from "@/features/page/queries/page-query";
import { useDebouncedValue } from "@mantine/hooks";
import { useAtom } from "jotai";
import { treeDataAtom } from "@/features/page/tree/atoms/tree-data-atom";
import { updateTreeNodeName } from "@/features/page/tree/utils";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { History } from "@tiptap/extension-history";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  const [debouncedTitleState, setDebouncedTitleState] = useState(null);
  const [debouncedTitle] = useDebouncedValue(debouncedTitleState, 500);
  const {
    data: updatedPageData,
    mutate: updatePageMutation,
    status,
  } = useUpdatePageMutation();
  const pageEditor = useAtomValue(pageEditorAtom);
  const [, setTitleEditor] = useAtom(titleEditorAtom);
  const [treeData, setTreeData] = useAtom(treeDataAtom);
  const emit = useQueryEmit();
  const navigate = useNavigate();
  const [activePageId, setActivePageId] = useState(pageId);
  const [currentUser] = useAtom(currentUserAtom);
  const userPageEditMode =
    currentUser?.user?.settings?.preferences?.pageEditMode ?? PageEditMode.Edit;

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
    ],
    onCreate({ editor }) {
      if (editor) {
        // @ts-ignore
        setTitleEditor(editor);
      }
    },
    onUpdate({ editor }) {
      setActivePageId(pageId);
      const currentTitle = editor.getText();
      if (currentTitle === debouncedTitle) {
        return;
      }
      setDebouncedTitleState(currentTitle);
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

  useEffect(() => {
    if (debouncedTitle === title) return;

    if (debouncedTitle !== null && activePageId === pageId) {
      updatePageMutation({
        pageId: pageId,
        title: debouncedTitle,
      });
    }
  }, [debouncedTitle]);

  useEffect(() => {
    if (status === "success" && updatedPageData) {
      const newTreeData = updateTreeNodeName(treeData, pageId, debouncedTitle);
      setTreeData(newTreeData);

      setTimeout(() => {
        emit({
          operation: "updateOne",
          spaceId: updatedPageData.spaceId,
          entity: ["pages"],
          id: pageId,
          payload: { title: debouncedTitle, slugId: slugId },
        });
      }, 50);
    }
  }, [updatedPageData, status]);

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

  return <EditorContent editor={titleEditor} onKeyDown={handleTitleKeyDown} />;
}
