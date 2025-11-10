import { Highlight, type HighlightOptions } from "@tiptap/extension-highlight";
import { mergeAttributes } from "@tiptap/core";

import {
  HIGHLIGHT_LEGACY_COLOR_MAP,
  type HighlightVariant,
} from "@/features/editor/extensions/highlight-variants";

interface DocmostHighlightOptions extends HighlightOptions {
  baseClass: string;
}

const RGB_REGEX =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(\d*(?:\.\d+)?))?\s*\)$/i;

const toHex = (value: string) => {
  const number = parseInt(value, 10);
  if (Number.isNaN(number)) {
    return "00";
  }
  return number.toString(16).padStart(2, "0");
};

const normalizeColor = (color?: string | null) => {
  if (!color) {
    return null;
  }

  const trimmed = color.trim();

  const rgbMatch = trimmed.match(RGB_REGEX);
  if (rgbMatch) {
    const [, r, g, b] = rgbMatch;
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase();
  }

  return trimmed.toLowerCase();
};

const mapLegacyColorToVariant = (color?: string | null) => {
  const normalized = normalizeColor(color);
  if (!normalized) {
    return null;
  }
  return HIGHLIGHT_LEGACY_COLOR_MAP[normalized] ?? null;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    highlight: {
      setHighlight: (attributes?: {
        color?: string;
        variant?: HighlightVariant | null;
      }) => ReturnType;
      toggleHighlight: (attributes?: {
        color?: string;
        variant?: HighlightVariant | null;
      }) => ReturnType;
    };
  }
}

export const DocmostHighlight = Highlight.extend<DocmostHighlightOptions>({
  addOptions() {
    const parent = this.parent?.() as HighlightOptions | undefined;
    return {
      ...parent,
      multicolor: false,
      baseClass: "docmost-highlight",
      HTMLAttributes: parent?.HTMLAttributes ?? {},
    };
  },

  addAttributes() {
    return {
      variant: {
        default: null,
        parseHTML: element => {
          const existingVariant = element.getAttribute("data-highlight-variant");
          if (existingVariant) {
            return existingVariant;
          }

          return (
            mapLegacyColorToVariant(element.getAttribute("data-color")) ??
            mapLegacyColorToVariant(element.style.backgroundColor)
          );
        },
      },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const baseClass = this.options.baseClass ?? "docmost-highlight";
    const {
      variant,
      class: existingClass,
      style: _inlineStyle,
      ["data-color"]: _legacyColor,
      ...rest
    } = HTMLAttributes;

    const classNames = new Set<string>();
    classNames.add(baseClass);

    if (typeof existingClass === "string" && existingClass.length > 0) {
      existingClass
        .split(" ")
        .map(className => className.trim())
        .filter(Boolean)
        .forEach(className => classNames.add(className));
    }

    if (variant) {
      classNames.add(`${baseClass}--${variant}`);
    }

    const highlightAttributes: Record<string, string> = {
      class: Array.from(classNames).join(" "),
    };

    if (variant) {
      highlightAttributes["data-highlight-variant"] = variant;
    }

    return [
      "mark",
      mergeAttributes(this.options.HTMLAttributes, rest, highlightAttributes),
      0,
    ];
  },
});
