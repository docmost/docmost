import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import { Paper, Portal, TextInput } from "@mantine/core";
import { useClickOutside } from "@mantine/hooks";
import { posToDOMRect, type Editor, type EditorEvents } from "@tiptap/core";
import { closeHistory } from "@tiptap/pm/history";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { useTranslation } from "react-i18next";

interface Props {
  editor: Editor;
  onClose: () => void;
  // Lets the page save typed text when it unloads or unmounts first.
  saveRef?: RefObject<(() => void) | null>;
}

export function TemplatePlaceholderPopover({ editor, onClose, saveRef }: Props) {
  const { t } = useTranslation();
  const type = editor.schema.nodes.templatePlaceholder;
  const [selection] = useState(() => editor.state.selection);
  const existing =
    selection instanceof NodeSelection && selection.node.type === type;
  const initialHint = existing ? selection.node.attrs.hint : "";
  const target = useRef(selection);
  const input = useRef<HTMLInputElement>(null);
  const value = useRef<string>(initialHint);
  const finished = useRef(false);

  useLayoutEffect(() => {
    if (saveRef) saveRef.current = () => close("save");
  });

  const {
    refs: { setFloating, setPositionReference },
    elements,
    floatingStyles,
    isPositioned,
    update,
  } = useFloating({
    open: true,
    placement: "bottom-start",
    strategy: "fixed",
    middleware: [offset(5), flip({ padding: 8 }), shift({ padding: 8 })],
    whileElementsMounted: autoUpdate,
  });

  useLayoutEffect(() => {
    const { view } = editor;
    const { node } = view.domAtPos(target.current.from);
    setPositionReference({
      contextElement: node instanceof Element ? node : node.parentElement,
      getBoundingClientRect: () => {
        const { from } = target.current;
        const anchor = existing && view.nodeDOM(from);
        return anchor instanceof Element
          ? anchor.getBoundingClientRect()
          : posToDOMRect(view, from, from);
      },
    });

    // Edits elsewhere (for example, a finishing upload) can move the target.
    const onTransaction = ({
      transaction,
      appendedTransactions,
    }: EditorEvents["transaction"]) => {
      const previous = target.current;
      for (const tr of [transaction, ...appendedTransactions]) {
        if (tr.docChanged) {
          target.current = target.current.map(tr.doc, tr.mapping);
        }
      }
      if (target.current !== previous) update();
    };
    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
  }, [editor, existing, setPositionReference, update]);

  useLayoutEffect(() => {
    const field = input.current;
    if (!isPositioned || !field) return;
    field.focus({ preventScroll: true });
    field.setSelectionRange(field.value.length, field.value.length);
    field.scrollLeft =
      getComputedStyle(field).direction === "rtl"
        ? -field.scrollWidth
        : field.scrollWidth;
  }, [isPositioned]);

  function close(action: "save" | "cancel", focusEditor = false) {
    if (finished.current) return;
    finished.current = true;
    if (action === "save" && !editor.isDestroyed && editor.isEditable) {
      const hint = value.current.trim();
      const { from, to } = target.current;
      const tr = editor.state.tr;
      if (existing) {
        const node = tr.doc.nodeAt(from);
        if (target.current instanceof NodeSelection && node?.type === type) {
          if (!hint) {
            tr.delete(from, to);
          } else if (hint !== node.attrs.hint) {
            tr.setNodeMarkup(from, type, { hint });
          }
          if (focusEditor) {
            tr.setSelection(TextSelection.create(tr.doc, hint ? to : from));
          }
        }
      } else if (hint && target.current.empty) {
        tr.setSelection(target.current);
        tr.replaceSelectionWith(type.create({ hint }));
      }
      if (tr.docChanged) closeHistory(tr);
      if (tr.docChanged || tr.selectionSet) editor.view.dispatch(tr);
    }
    onClose();
    if (focusEditor && !editor.isDestroyed) {
      editor.commands.focus(undefined, { scrollIntoView: false });
    }
  }

  useClickOutside(
    () => close("save"),
    ["pointerdown"],
    [elements.floating],
    true,
    true,
  );

  return (
    <Portal>
      <Paper
        ref={setFloating}
        className="print-hide"
        bd="2px solid light-dark(var(--mantine-primary-color-6), var(--mantine-primary-color-4))"
        shadow="sm"
        radius="md"
        px="xs"
        w="min(17rem, calc(100vw - 1rem))"
        style={{
          ...floatingStyles,
          zIndex: 200,
          visibility: isPositioned ? "visible" : "hidden",
        }}
      >
        <TextInput
          ref={input}
          variant="unstyled"
          attributes={{ input: { dir: "auto" } }}
          aria-label={t("Placeholder text")}
          placeholder={t("Write an instruction")}
          defaultValue={initialHint}
          enterKeyHint="done"
          onChange={(event) => {
            value.current = event.currentTarget.value;
          }}
          onBlur={() => {
            // The field gets focus back when the window does.
            if (document.hasFocus()) close("save");
          }}
          onKeyDown={(event) => {
            if (
              event.nativeEvent.isComposing ||
              event.nativeEvent.keyCode === 229
            ) {
              return;
            }
            if (event.key !== "Enter" && event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            close(event.key === "Enter" ? "save" : "cancel", true);
          }}
        />
      </Paper>
    </Portal>
  );
}
