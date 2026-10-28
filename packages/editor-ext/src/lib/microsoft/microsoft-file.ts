import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { sanitizeUrl } from "../utils";

export type MicrosoftFileItem = {
  driveId: string;
  itemId: string;
  webUrl: string;
  name: string;
};

export type MicrosoftFileDisplay = "embed" | "link";

export type MicrosoftFileAttributes = {
  items: MicrosoftFileItem[];
  display: MicrosoftFileDisplay;
  width: number;
  height: number;
  align: "left" | "center" | "right";
  pendingKey: string | null;
};

export type MicrosoftFileOptions = {
  HTMLAttributes: Record<string, any>;
  view: any;
};

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    microsoftFile: {
      setMicrosoftFile: (attributes: Partial<MicrosoftFileAttributes>) => ReturnType;
    };
  }
}

export function sanitizeMicrosoftFileItems(value: unknown): MicrosoftFileItem[] {
  if (!Array.isArray(value)) return [];
  const items: MicrosoftFileItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const { driveId, itemId, webUrl, name } = raw as Record<string, unknown>;
    if (typeof driveId !== "string" || typeof itemId !== "string" || typeof webUrl !== "string") {
      continue;
    }
    const safeUrl = sanitizeUrl(webUrl);
    if (!safeUrl.startsWith("https://")) continue;
    items.push({
      driveId,
      itemId,
      webUrl: safeUrl,
      name: typeof name === "string" ? name : "",
    });
  }
  return items;
}

function parseItems(element: HTMLElement): MicrosoftFileItem[] {
  try {
    return sanitizeMicrosoftFileItems(JSON.parse(element.getAttribute("data-items") ?? "[]"));
  } catch {
    return [];
  }
}

function parseNumber(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const parsed = parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const MicrosoftFile = Node.create<MicrosoftFileOptions>({
  name: "microsoftFile",
  inline: false,
  group: "block",
  isolating: true,
  atom: true,
  defining: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      view: null,
    };
  },

  addAttributes() {
    return {
      items: {
        default: [],
        parseHTML: parseItems,
        renderHTML: (attributes: MicrosoftFileAttributes) => ({
          "data-items": JSON.stringify(sanitizeMicrosoftFileItems(attributes.items)),
        }),
      },
      display: {
        default: "embed",
        parseHTML: (element: HTMLElement) =>
          element.getAttribute("data-display") === "link" ? "link" : "embed",
        renderHTML: (attributes: MicrosoftFileAttributes) => ({
          "data-display": attributes.display === "link" ? "link" : "embed",
        }),
      },
      width: {
        default: 800,
        parseHTML: (element: HTMLElement) => parseNumber(element.getAttribute("width"), 800),
        renderHTML: (attributes: MicrosoftFileAttributes) => ({ width: attributes.width }),
      },
      height: {
        default: 600,
        parseHTML: (element: HTMLElement) => parseNumber(element.getAttribute("height"), 600),
        renderHTML: (attributes: MicrosoftFileAttributes) => ({ height: attributes.height }),
      },
      align: {
        default: "center",
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute("data-align");
          return value === "left" || value === "right" ? value : "center";
        },
        renderHTML: (attributes: MicrosoftFileAttributes) => ({ "data-align": attributes.align }),
      },
      pendingKey: {
        default: null,
        rendered: false,
      },
    };
  },

  parseHTML() {
    return [{ tag: `div[data-type="${this.name}"]` }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const items = sanitizeMicrosoftFileItems(node.attrs.items);
    return [
      "div",
      mergeAttributes({ "data-type": this.name }, this.options.HTMLAttributes, HTMLAttributes),
      ...items.map((item) => [
        "a",
        { href: item.webUrl, target: "_blank", rel: "noopener" },
        item.name || item.webUrl,
      ]),
    ];
  },

  addCommands() {
    return {
      setMicrosoftFile:
        (attrs) =>
        ({ commands }) =>
          commands.insertContent({
            type: this.name,
            attrs: { ...attrs, items: sanitizeMicrosoftFileItems(attrs.items) },
          }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(this.options.view);
  },
});
