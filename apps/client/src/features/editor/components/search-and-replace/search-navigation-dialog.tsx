import { ActionIcon, Dialog, Flex, Text, Tooltip } from "@mantine/core";
import { IconArrowNarrowDown, IconArrowNarrowUp, IconX } from "@tabler/icons-react";
import {  useEditor } from "@tiptap/react";
import { isEditorReady } from "@docmost/editor-ext";
import React, { useEffect, useState } from "react";
import classes from "./search-replace.module.css";
import { useTranslation } from "react-i18next";

interface SearchNavigationDialogProps {
  editor: ReturnType<typeof useEditor>;
}

interface SearchNavigationEvent extends CustomEvent {
  detail: {
    searchTerms: string[];
    wholeWord?: boolean;
  };
}

function SearchNavigationDialog({ editor }: SearchNavigationDialogProps) {
  const {t} = useTranslation()
  const [open, setOpen] = useState(false);
  const [resultState, setResultState] = useState({
    resultIndex: 0,
    resultsLength: 0,
  });

  const goToSelection = () => {
    if (!isEditorReady(editor)) return;

    const { results, resultIndex } = editor.storage.searchAndReplace;
    const position = results[resultIndex];

    setResultState({
      resultsLength: results.length,
      resultIndex,
    });

    if (!position) return;
    requestAnimationFrame(() => {
      document
        .querySelector(".search-result-current")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  };

  const next = () => {
    if (!isEditorReady(editor)) return;
    editor.commands.nextSearchResult();
    goToSelection();
  };

  const previous = () => {
    if (!isEditorReady(editor)) return;
    editor.commands.previousSearchResult();
    goToSelection();
  };

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const { searchTerms: terms, wholeWord = true } = (
        event as SearchNavigationEvent
      ).detail;

      if (!terms?.length || !isEditorReady(editor)) return;

      setOpen(true);
      editor.commands.setSearchTerms(terms);
      editor.commands.setWholeWord(wholeWord);
      editor.commands.resetIndex();

      const { results, resultIndex } = editor.storage.searchAndReplace;
      setResultState({
        resultIndex,
        resultsLength: results.length,
      });

      goToSelection();
    };

    const handleClose = () => {
      setOpen(false);
    };

    document.addEventListener("openSearchNavigationDialog", handleOpen);
    document.addEventListener("openFindDialogFromEditor", handleClose);

    return () => {
      document.removeEventListener("openSearchNavigationDialog", handleOpen);
      document.removeEventListener("openFindDialogFromEditor", handleClose);
    };
  }, [editor]);

  useEffect(() => {
    const handleTransaction = () => {
      if (!open || editor.isDestroyed) return;

      const { results } = editor.storage.searchAndReplace;
      if (results.length === 0) {
        setOpen(false);
      }
    };

    editor.on("transaction", handleTransaction);
    return () => {
      editor.off("transaction", handleTransaction);
    };
  }, [editor, open]);

  const close = () => {
    editor.commands.setSearchTerms([""]);
    setOpen(false);
  };

  return (
    <Dialog
      className={classes.findDialog}
      opened={open}
      size="xs"
      radius="md"
      w="auto"
      position={{ top: 90, right: 50 }}
      withBorder
      aria-label="Search navigation"
    >
      <Flex align="center" gap="xs">
        <Text size="xs" style={{ flex: 1 }}>
          {resultState.resultsLength > 0
            ? `${resultState.resultIndex + 1}/${resultState.resultsLength}`
            : t("Not found")}
        </Text>
        <Tooltip label="Previous match">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={previous}
            aria-label="Previous match"
            disabled={resultState.resultsLength === 0}
          >
            <IconArrowNarrowUp size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Next match">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={next}
            aria-label="Next match"
            disabled={resultState.resultsLength === 0}
          >
            <IconArrowNarrowDown size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Close">
          <ActionIcon
            variant="subtle"
            color="gray"
            onClick={close}
            aria-label="Close"
          >
            <IconX size={16} />
          </ActionIcon>
        </Tooltip>
      </Flex>
    </Dialog>
  );
}

export default SearchNavigationDialog;
