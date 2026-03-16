import { FC, useCallback, useEffect, useRef } from "react";
import { BubbleMenu } from "@tiptap/react/menus";
import type { Editor } from "@tiptap/react";
import { useAtom } from "jotai";
import { isTextSelected } from "@docmost/editor-ext";
import { showLinkMenuAtom } from "@/features/editor/atoms/editor-atoms";
import { LinkEditorPanel } from "@/features/editor/components/link/link-editor-panel";
import { normalizeUrl } from "@/features/editor/components/link/link-view";
import { TextSelection } from "@tiptap/pm/state";

type EditorLinkMenuProps = {
  editor: Editor;
};

export const EditorLinkMenu: FC<EditorLinkMenuProps> = ({ editor }) => {
  const [showLinkMenu, setShowLinkMenu] = useAtom(showLinkMenuAtom);
  const showLinkMenuRef = useRef(showLinkMenu);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    showLinkMenuRef.current = showLinkMenu;
    if (showLinkMenu) {
      editor.commands.focus();
    }
  }, [showLinkMenu, editor]);

  const focusInput = useCallback(() => {
    requestAnimationFrame(() => {
      containerRef.current
        ?.querySelector<HTMLInputElement>("input")
        ?.focus({ preventScroll: true });
    });
  }, []);

  const onSetLink = useCallback(
    (url: string, internal?: boolean) => {
      editor
        .chain()
        .focus()
        .setLink({
          href: internal ? url : normalizeUrl(url),
          internal: !!internal,
        } as any)
        .command(({ tr }) => {
          tr.setSelection(TextSelection.create(tr.doc, tr.selection.to));
          return true;
        })
        .run();
      setShowLinkMenu(false);
    },
    [editor, setShowLinkMenu],
  );

  useEffect(() => {
    if (!showLinkMenu) return;

    const dismiss = () => {
      setShowLinkMenu(false);
      editor.commands.focus();
      editor.commands.setTextSelection(editor.state.selection.to);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        dismiss();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleMouseDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleMouseDown);
    };
  }, [showLinkMenu, setShowLinkMenu]);

  if (!showLinkMenu) return null;

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor, state }) => {
        const { empty } = state.selection;
        return (
          showLinkMenuRef.current &&
          editor.isEditable &&
          !empty &&
          isTextSelected(editor)
        );
      }}
      options={{
        placement: "bottom",
        offset: 8,
        onShow: focusInput,
        onHide: () => {
          setShowLinkMenu(false);
        },
      }}
      style={{ zIndex: 198, position: "relative" }}
    >
      <div
        ref={containerRef}
        style={{
          width: 320,
          padding: "var(--mantine-spacing-sm)",
          boxShadow: "0 4px 12px light-dark(#cfcfcf, #0f0f0f)",
          borderRadius: 6,
          border:
            "1px solid light-dark(var(--mantine-color-gray-3), var(--mantine-color-gray-8))",
          backgroundColor:
            "light-dark(var(--mantine-color-white), var(--mantine-color-dark-6))",
        }}
      >
        <LinkEditorPanel onSetLink={onSetLink} />
      </div>
    </BubbleMenu>
  );
};
