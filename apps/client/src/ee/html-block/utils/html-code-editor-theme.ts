import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { tags } from "@lezer/highlight";

type ColorScheme = "light" | "dark";

const themes: Partial<Record<ColorScheme, Extension>> = {};

export function htmlCodeEditorTheme(colorScheme: ColorScheme): Extension {
  return (themes[colorScheme] ??= createHtmlCodeEditorTheme(colorScheme));
}

function createHtmlCodeEditorTheme(colorScheme: ColorScheme): Extension {
  const isDark = colorScheme === "dark";
  const color = (light: string, dark: string) =>
    `var(--mantine-color-${isDark ? dark : light})`;

  const background = color("gray-0", "dark-8");
  const text = color("gray-9", "dark-1");
  const activeLine = color("gray-1", "dark-7");
  const border = "1px solid var(--mantine-color-default-border)";

  const editorTheme = EditorView.theme(
    {
      "&": {
        height: "100%",
        color: text,
        backgroundColor: background,
        fontSize: "var(--mantine-font-size-sm)",
      },
      "&.cm-focused": { outline: "none" },
      ".cm-scroller": {
        fontFamily: '"JetBrainsMono", var(--mantine-font-family-monospace)',
        lineHeight: "var(--mantine-line-height)",
      },
      ".cm-content": {
        padding: "var(--mantine-spacing-xs) 0",
        caretColor: text,
        "& ::selection, &::selection": {
          backgroundColor: isDark
            ? "var(--mantine-color-gray-7)"
            : "var(--mantine-primary-color-1)",
        },
      },
      ".cm-line": {
        padding: "0 var(--mantine-spacing-md) 0 var(--mantine-spacing-xs)",
      },
      ".cm-activeLine": { backgroundColor: activeLine },
      ".cm-gutters": {
        color: "var(--mantine-color-dimmed)",
        backgroundColor: background,
        border: "none",
      },
      ".cm-activeLineGutter": { color: text, backgroundColor: activeLine },
      ".cm-lineNumbers .cm-gutterElement": {
        paddingLeft: "var(--mantine-spacing-sm)",
      },
      ".cm-foldPlaceholder": {
        color: "var(--mantine-color-dimmed)",
        backgroundColor: color("gray-1", "dark-6"),
        border,
        borderRadius: "var(--mantine-radius-xs)",
        padding: "0 4px",
      },
      ".cm-placeholder": { color: "var(--mantine-color-placeholder)" },
      "&.cm-focused .cm-matchingBracket": {
        backgroundColor: color("gray-2", "dark-5"),
      },
      "&.cm-focused .cm-nonmatchingBracket": {
        backgroundColor: "var(--mantine-color-red-light)",
      },
      ".cm-selectionMatch": {
        backgroundColor: "var(--mantine-primary-color-light)",
      },
      // the same find colors as the page editor, with dark text in both schemes
      ".cm-searchMatch, .cm-searchMatch *": {
        color: "var(--mantine-color-gray-9)",
      },
      ".cm-searchMatch": { backgroundColor: "var(--mantine-color-yellow-3)" },
      ".cm-searchMatch.cm-searchMatch-selected": {
        backgroundColor: "var(--mantine-color-orange-3)",
      },
      ".cm-panels": {
        color: "var(--mantine-color-text)",
        backgroundColor: "var(--mantine-color-body)",
      },
      ".cm-panels.cm-panels-top": { borderBottom: border },
      ".cm-panels.cm-panels-bottom": { borderTop: border },
      ".cm-panel.cm-search": {
        padding: "6px var(--mantine-spacing-sm)",
        fontSize: "var(--mantine-font-size-xs)",
        "& label": { fontSize: "var(--mantine-font-size-xs)" },
        "& [name=close]": {
          top: "4px",
          right: "var(--mantine-spacing-xs)",
          color: "var(--mantine-color-dimmed)",
          fontSize: "var(--mantine-font-size-lg)",
          cursor: "pointer",
        },
      },
      ".cm-textfield": {
        color: "var(--mantine-color-text)",
        backgroundColor: "var(--mantine-color-body)",
        border,
        borderRadius: "var(--mantine-radius-sm)",
        padding: "3px 8px",
        fontSize: "var(--mantine-font-size-xs)",
        outline: "none",
        "&:focus": { borderColor: "var(--mantine-primary-color-filled)" },
      },
      ".cm-button": {
        color: "var(--mantine-color-default-color)",
        backgroundColor: "var(--mantine-color-default)",
        backgroundImage: "none",
        border,
        borderRadius: "var(--mantine-radius-sm)",
        padding: "3px 10px",
        fontSize: "var(--mantine-font-size-xs)",
        cursor: "pointer",
        "&:hover": { backgroundColor: "var(--mantine-color-default-hover)" },
        "&:active": { backgroundImage: "none" },
      },
    },
    { dark: isDark },
  );

  const highlightStyle = HighlightStyle.define([
    { tag: tags.comment, color: color("gray-6", "dark-2") },
    {
      tag: [tags.keyword, tags.modifier, tags.self],
      color: color("violet-7", "violet-3"),
    },
    {
      tag: [
        tags.tagName,
        tags.angleBracket,
        tags.attributeName,
        tags.attributeValue,
        tags.string,
        tags.character,
        tags.regexp,
        tags.propertyName,
        tags.className,
        tags.labelName,
      ],
      color: color("red-7", "red-5"),
    },
    {
      tag: [
        tags.number,
        tags.bool,
        tags.null,
        tags.atom,
        tags.unit,
        tags.color,
        tags.typeName,
        tags.meta,
        tags.documentMeta,
        tags.processingInstruction,
      ],
      color: color("blue-7", "cyan-5"),
    },
    {
      tag: [
        tags.function(tags.variableName),
        tags.function(tags.propertyName),
        tags.definition(tags.className),
        tags.heading,
      ],
      color: color("pink-7", "yellow-5"),
    },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strong, fontWeight: "700" },
  ]);

  return [editorTheme, syntaxHighlighting(highlightStyle)];
}
