import "@/features/editor/styles/index.css";
import React, { useEffect, useLayoutEffect } from "react";
import { type Editor, EditorContent, useEditor } from "@tiptap/react";
import { Document } from "@tiptap/extension-document";
import { Heading } from "@tiptap/extension-heading";
import { Text } from "@tiptap/extension-text";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useAtomValue } from "jotai";
import {
  pageEditorAtom,
  titleEditorAtom,
} from "@/features/editor/atoms/editor-atoms";
import {
  updatePageData,
  useUpdateTitlePageMutation,
} from "@/features/page/queries/page-query";
import { useDebouncedCallback, getHotkeyHandler } from "@mantine/hooks";
import { notifications } from "@mantine/notifications";
import { useAtom } from "jotai";
import { useQueryEmit } from "@/features/websocket/use-query-emit.ts";
import { History } from "@tiptap/extension-history";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import EmojiCommand from "@/features/editor/extensions/emoji-command.ts";
import { UpdateEvent } from "@/features/websocket/types";
import localEmitter from "@/lib/local-emitter.ts";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { searchSpotlight } from "@/features/search/constants.ts";
import { platformModifierKey } from "@/lib";
import { usePageEditMode } from "@/ee/page-verification/hooks/use-page-edit-mode";
import { splitTitleIntoPage } from "@/features/editor/title-editor.utils";

export interface TitleEditorProps {
  pageId: string;
  slugId: string;
  title: string;
  spaceSlug: string;
  editable: boolean;
  isBase?: boolean;
}

export function TitleEditor({
  pageId,
  slugId,
  title,
  spaceSlug,
  editable,
  isBase,
}: TitleEditorProps) {
  const { t } = useTranslation();
  const { mutateAsync: updateTitlePageMutationAsync } =
    useUpdateTitlePageMutation(pageId);
  const pageEditor = useAtomValue(pageEditorAtom);
  const [, setTitleEditor] = useAtom(titleEditorAtom);
  const emit = useQueryEmit();
  const navigate = useNavigate();
  // bases have no edit mode toggle, so a verification must not lock their title
  const { editMode, isCheckingLock } = usePageEditMode(isBase ? undefined : pageId);
  const canEditTitle = editable && !isCheckingLock && editMode === PageEditMode.Edit;

  const saveTitle = useDebouncedCallback(async (editor: Editor, value: string) => {
    try {
      const page = await updateTitlePageMutationAsync({ pageId, title: value });
      if (!editor.isDestroyed && page.title !== editor.getText()) return;
      updatePageData(page);
      const event: UpdateEvent = {
        operation: "updateOne",
        spaceId: page.spaceId,
        entity: ["pages"],
        id: page.id,
        payload: {
          title: page.title,
          slugId: page.slugId,
          parentPageId: page.parentPageId,
          icon: page.icon,
        },
      };
      localEmitter.emit("message", event);
      emit(event);
    } catch {
      notifications.show({ color: "red", message: t("Failed to save page title") });
    }
  }, { delay: 500, flushOnUnmount: true });

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
        placeholder: isBase ? t("Untitled base") : t("Untitled"),
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
      }
    },
    onUpdate({ editor }) {
      saveTitle(editor, editor.getText());
    },
    editable: canEditTitle,
    content: title,
    textDirection: "auto",
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: {
      attributes: {
        "aria-label": t("Page title"),
      },
      handleDOMEvents: {
        keydown: (_view, event) => {
          if (platformModifierKey(event) && event.code === "KeyS") {
            event.preventDefault();
            return true;
          }
          if (platformModifierKey(event) && event.code === "KeyK") {
            searchSpotlight.open();
            return true;
          }
        },
      },
    },
  });

  useEffect(() => {
    // Canonicalize only the path slug; keep query params (?row=, ?view=
    // deep links) and the hash anchor intact.
    const pageSlug = buildPageUrl(spaceSlug, slugId, title);
    navigate(
      {
        pathname: pageSlug,
        search: window.location.search,
        hash: window.location.hash,
      },
      { replace: true },
    );
  }, [title]);

  useEffect(() => {
    if (
      titleEditor &&
      !titleEditor.isDestroyed &&
      title !== titleEditor.getText()
    ) {
      titleEditor.commands.setContent(title, { emitUpdate: false });
    }
  }, [pageId, title, titleEditor]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!titleEditor?.isInitialized || !titleEditor.isEditable || location.hash)
        return;
      // Someone can already be typing in the body or using a toolbar control.
      const active = document.activeElement;
      if (
        active !== document.body &&
        !active?.matches('[role="treeitem"][aria-current="page"]')
      ) return;
      titleEditor.commands.focus("end", { scrollIntoView: false });
    }, 300);
    return () => clearTimeout(timer);
  }, [titleEditor]);

  useLayoutEffect(() => {
    if (titleEditor && !titleEditor.isDestroyed && titleEditor.isEditable !== canEditTitle) {
      titleEditor.setEditable(canEditTitle, false);
    }
  }, [titleEditor, canEditTitle]);

  const openSearchDialog = () => {
    const event = new CustomEvent("openFindDialogFromEditor", {});
    document.dispatchEvent(event);
  };

  function handleTitleKeyDown(event: any) {
    if (!titleEditor || !pageEditor || event.shiftKey) return;

    // Prevent focus shift when IME composition is active
    // `keyCode === 229` is added to support Safari where `isComposing` may not be reliable
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229)
      return;

    const { key } = event;
    const { $head } = titleEditor.state.selection;

    if (key === "Enter") {
      event.preventDefault();
      if (!titleEditor.isEditable || !pageEditor.isEditable) return;
      splitTitleIntoPage(titleEditor, pageEditor);
      return;
    }

    const shouldFocusEditor =
      key === "ArrowDown" || (key === "ArrowRight" && !$head.nodeAfter);

    if (shouldFocusEditor) {
      pageEditor.commands.focus("start");
    }
  }

  return (
    <div className="page-title">
      <EditorContent
        editor={titleEditor}
        onKeyDown={(event) => {
          // First handle the search hotkey
          getHotkeyHandler([["mod+F", openSearchDialog]])(event);

          // Then handle other key events
          handleTitleKeyDown(event);
        }}
      />
    </div>
  );
}
