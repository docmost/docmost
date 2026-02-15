import { Editor } from "@tiptap/react";
import { ActionIcon, TextInput, Tooltip } from "@mantine/core";
import { useDebouncedCallback, useMediaQuery } from "@mantine/hooks";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAtom } from "jotai";
import { IconArrowUp } from "@tabler/icons-react";
import { showAiMenuAtom } from "@/features/editor/atoms/editor-atoms.ts";
import { useAiGenerateStreamMutation } from "@/ee/ai/queries/ai-query.ts";
import { AiAction } from "@/ee/ai/types/ai.types.ts";
import { CommandItem, commandItems, CommandSet } from "./command-items.ts";
import { CommandSelector } from "./command-selector.tsx";
import { ResultPreview } from "./result-preview.tsx";
import classes from "./ai-menu.module.css";
import { marked } from "marked";
import { DOMSerializer } from "@tiptap/pm/model";
import { htmlToMarkdown } from "@docmost/editor-ext";
import { useLocation } from "react-router-dom";

interface EditorAiMenuProps {
  editor: Editor | null;
}

const EditorAiMenu = ({ editor }: EditorAiMenuProps): JSX.Element | null => {
  const aiGenerateStreamMutation = useAiGenerateStreamMutation();
  const location = useLocation();
  const isSmBreakpoint = useMediaQuery("(max-width: 48em)");
  const [showAiMenu, setShowAiMenu] = useAtom(showAiMenuAtom);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [activeCommandSet, setActiveCommandSet] = useState<CommandSet>("main");
  const [lastAction, setLastAction] = useState<CommandItem | null>(null);
  const [menuPlacement, setMenuPlacement] = useState<{
    top: number;
    left: number;
    width: number;
  }>({
    top: 0,
    left: 0,
    width: 0,
  });
  const currentItems = useMemo(() => {
    return commandItems[activeCommandSet].filter((item) => {
      return item.name.toLowerCase().includes(prompt.toLowerCase());
    });
  }, [prompt, output, activeCommandSet]);
  const updateMenuPlacement = useCallback(() => {
    if (!editor || !showAiMenu) return;

    const { view } = editor;
    const { to } = editor.state.selection;
    const editorRect = view.dom.getBoundingClientRect();
    const cursorCoords = view.coordsAtPos(to);
    const topOffset = 8;
    const editorPadding = isSmBreakpoint ? 16 : 48;

    setMenuPlacement({
      top: cursorCoords.bottom + topOffset + window.scrollY,
      left: editorRect.left + editorPadding + window.scrollX,
      width: editorRect.width - editorPadding * 2,
    });
  }, [editor, showAiMenu, isSmBreakpoint]);
  const resetMenu = useCallback(() => {
    setPrompt("");
    setOutput("");
    setActiveCommandSet("main");
    setLastAction(null);
    aiGenerateStreamMutation.reset();
  }, [aiGenerateStreamMutation.reset]);
  const debouncedUpdateMenuPlacement = useDebouncedCallback(
    updateMenuPlacement,
    60,
  );
  const handleGenerate = useCallback(
    (item?: CommandItem) => {
      if (!editor || isLoading) return;

      let command: CommandItem | null = item || null;

      if (!command) {
        if (!prompt) return;

        command = {
          id: "custom",
          name: "Custom",
          action: AiAction.CUSTOM,
          prompt,
        };
      }

      const { from, to } = editor.state.selection;
      const slice = editor.state.doc.slice(from, to);
      const serializer = DOMSerializer.fromSchema(editor.schema);
      const fragment = serializer.serializeFragment(slice.content);
      const wrapper = document.createElement("div");
      wrapper.appendChild(fragment);
      const content = htmlToMarkdown(wrapper.innerHTML);

      setOutput("");
      setIsLoading(true);
      aiGenerateStreamMutation.mutate({
        action: command.action,
        prompt: command.prompt,
        content,
        onChunk: (chunk) => {
          setOutput((output) => output + chunk.content);
        },
        onComplete: () => {
          setIsLoading(false);
          setActiveCommandSet("result");
        },
        onError: () => {
          setIsLoading(false);
          resetMenu();
        },
      });
      setLastAction(command);
    },
    [
      editor,
      prompt,
      isLoading,
      aiGenerateStreamMutation.mutateAsync,
      resetMenu,
    ],
  );
  const handleCommand = useCallback(
    (item?: CommandItem) => {
      setPrompt("");

      if (!item) {
        return handleGenerate();
      }
      if (item.id === "back") {
        return setActiveCommandSet("main");
      }
      if (item.id === "result-replace") {
        const chain = editor.chain().focus();

        if (lastAction.action === AiAction.CONTINUE_WRITING) {
          chain.setTextSelection(editor.state.selection.to);
        }

        const html = (marked.parse(output) as string).trim();
        // Strip <p> wrapper for single-paragraph output to preserve inline context
        const content =
          html.startsWith("<p>") &&
          html.endsWith("</p>") &&
          html.lastIndexOf("<p>") === 0
            ? html.slice(3, -4)
            : html;

        chain.insertContent(content).run();

        return setShowAiMenu(false);
      }
      if (item.id === "result-insert-below") {
        editor
          .chain()
          .focus()
          .setTextSelection(editor.state.selection.to)
          .insertContent(marked.parse(output))
          .run();

        return setShowAiMenu(false);
      }
      if (item.id === "result-copy") {
        navigator.clipboard.writeText(output);

        return setShowAiMenu(false);
      }
      if (item.id === "result-discard") {
        setOutput("");

        return resetMenu();
      }
      if (item.id === "result-try-again" && lastAction) {
        return handleGenerate(lastAction);
      }
      if (item.subCommandSet) {
        return setActiveCommandSet(item.subCommandSet);
      }

      return handleGenerate(item);
    },
    [editor, output, lastAction, handleGenerate, resetMenu],
  );
  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const totalItems = currentItems.length;
      const cycleSize = totalItems + 1;

      if (event.key === "Escape") {
        return setShowAiMenu(false);
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();

        return setSelectedIndex((selectedIndex) => {
          const direction = event.key === "ArrowDown" ? 1 : -1;
          const newIndex = selectedIndex + direction;

          if (newIndex < -1) return cycleSize - 1;
          if (newIndex >= cycleSize) return 0;

          return newIndex;
        });
      }

      if (event.key === "Enter") {
        event.preventDefault();

        return handleCommand(currentItems[selectedIndex]);
      }
    },
    [currentItems, selectedIndex],
  );

  useEffect(() => {
    if (!editor) return;

    const handleClose = () => setShowAiMenu(false);
    const observer = new ResizeObserver(() => {
      debouncedUpdateMenuPlacement();
    });

    updateMenuPlacement();
    editor.on("focus", handleClose);
    editor.on("blur", handleClose);
    window.addEventListener("resize", debouncedUpdateMenuPlacement);
    window.addEventListener("scroll", debouncedUpdateMenuPlacement, true);
    observer.observe(editor.view.dom);

    return () => {
      editor.off("focus", handleClose);
      editor.off("blur", handleClose);
      window.removeEventListener("resize", debouncedUpdateMenuPlacement);
      window.removeEventListener("scroll", debouncedUpdateMenuPlacement, true);
      observer.disconnect();
    };
  }, [editor, updateMenuPlacement, debouncedUpdateMenuPlacement]);

  useEffect(() => {
    setShowAiMenu(false);
  }, [location]);
  useEffect(() => {
    if (showAiMenu) {
      resetMenu();
    }
  }, [showAiMenu, resetMenu]);
  useEffect(() => {
    // Focus input when menu opens or command set changes
    requestAnimationFrame(() => {
      inputRef.current?.focus({ preventScroll: true });
    });
  }, [showAiMenu, isLoading, currentItems]);
  useEffect(() => {
    if (!currentItems.length) {
      setSelectedIndex(-1);
    }
    setSelectedIndex(prompt || activeCommandSet !== "main" ? 0 : -1);
  }, [prompt, activeCommandSet, currentItems]);

  if (!showAiMenu) return null;

  return createPortal(
    <div
      style={{
        zIndex: 200,
        position: "absolute",
        top: menuPlacement.top,
        left: menuPlacement.left,
        width: menuPlacement.width,
        pointerEvents: "none",
      }}
    >
      <div
        className={classes.aiMenu}
        style={{ pointerEvents: "auto" }}
        tabIndex={0}
        ref={containerRef}
      >
        <ResultPreview output={output} isLoading={isLoading} />
        <CommandSelector
          selectedIndex={selectedIndex}
          isLoading={isLoading}
          output={output}
          currentItems={currentItems}
          handleCommand={handleCommand}
        >
          <TextInput
            ref={inputRef}
            className={classes.aiInput}
            placeholder="Ask AI..."
            data-autofocus
            value={prompt}
            disabled={isLoading}
            onChange={(e) => setPrompt(e.currentTarget.value)}
            rightSection={
              <ActionIcon
                disabled={!prompt || isLoading}
                variant="filled"
                color="blue"
                radius="xl"
                size="sm"
                onClick={() => handleGenerate()}
              >
                <IconArrowUp size={14} stroke={2.5} />
              </ActionIcon>
            }
            onKeyDown={handleKeyDown}
          />
        </CommandSelector>
      </div>
    </div>,
    document.body,
  );
};

export { EditorAiMenu };
