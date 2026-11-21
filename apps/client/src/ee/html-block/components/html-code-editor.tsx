import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import { html } from "@codemirror/lang-html";
import {
  bracketMatching,
  foldGutter,
  foldKeymap,
  indentOnInput,
} from "@codemirror/language";
import {
  highlightSelectionMatches,
  search,
  searchKeymap,
} from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  keymap,
  lineNumbers,
  placeholder as placeholderText,
} from "@codemirror/view";
import { htmlCodeEditorTheme } from "@/ee/html-block/utils/html-code-editor-theme";

type HtmlCodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  colorScheme: "light" | "dark";
  placeholder?: string;
};

export default function HtmlCodeEditor({
  value,
  onChange,
  colorScheme,
  placeholder,
}: HtmlCodeEditorProps) {
  const { t } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const editorTextRef = useRef(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [themeCompartment] = useState(() => new Compartment());

  useEffect(() => {
    const view = new EditorView({
      parent: parentRef.current,
      state: EditorState.create({
        doc: editorTextRef.current,
        extensions: [
          lineNumbers(),
          foldGutter(),
          highlightActiveLineGutter(),
          history(),
          indentOnInput(),
          bracketMatching(),
          highlightActiveLine(),
          highlightSelectionMatches(),
          search({ top: true }),
          keymap.of([
            ...defaultKeymap,
            ...historyKeymap,
            ...searchKeymap,
            ...foldKeymap,
            indentWithTab,
          ]),
          html(),
          placeholder ? placeholderText(placeholder) : [],
          EditorState.phrases.of({
            Find: t("Find"),
            Replace: t("Replace"),
            next: t("next"),
            previous: t("previous"),
            all: t("all"),
            "match case": t("match case"),
            regexp: t("regexp"),
            "by word": t("by word"),
            replace: t("replace"),
            "replace all": t("replace all"),
            close: t("close"),
            "Go to line": t("Go to line"),
            go: t("go"),
          }),
          EditorView.lineWrapping,
          // data-autofocus lets the dialog's focus trap pick the editor over the close button
          EditorView.contentAttributes.of({
            "aria-label": t("HTML code"),
            "data-autofocus": "true",
          }),
          themeCompartment.of(htmlCodeEditorTheme(colorScheme)),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged) return;
            editorTextRef.current = update.state.doc.toString();
            onChangeRef.current(editorTextRef.current);
          }),
        ],
      }),
    });
    viewRef.current = view;
    view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || value === editorTextRef.current) return;

    editorTextRef.current = value;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    const theme = htmlCodeEditorTheme(colorScheme);
    if (!view || themeCompartment.get(view.state) === theme) return;

    view.dispatch({ effects: themeCompartment.reconfigure(theme) });
  }, [colorScheme, themeCompartment]);

  return <div ref={parentRef} style={{ height: "100%" }} />;
}
