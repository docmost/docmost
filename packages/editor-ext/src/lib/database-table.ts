import { Node, mergeAttributes, nodePasteRule } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";
import { sanitizeUrl } from "./utils";

export interface DatabaseTableOptions {
  HTMLAttributes: Record<string, any>;
  view: any;
}

export interface DatabaseTableAttributes {
  src?: string;
  source?: string; // "baserow" | "nocodb" | ""
  title?: string; // optionaler, vom User überschreibbarer Titel
}

/** Erkennt die Datenquelle anhand der eingefügten Public-View-URL. */
export function detectDatabaseSource(url: string): "baserow" | "nocodb" | "" {
  if (!url) return "";
  if (/\/public\/grid\//.test(url)) return "baserow";
  if (/\/nc\/view\//.test(url) || /\/shared-view\//.test(url)) return "nocodb";
  return "";
}

/** Regex für eingefügte Baserow/NocoDB-Public-Links (Paste-Rule). */
export const DATABASE_TABLE_URL_REGEX =
  /https?:\/\/[^\s]+\/(?:public\/grid|nc\/view)\/[^\s]+/g;

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    databaseTable: {
      setDatabaseTable: (attributes?: DatabaseTableAttributes) => ReturnType;
    };
  }
}

export const DatabaseTable = Node.create<DatabaseTableOptions>({
  name: "databaseTable",
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
      src: {
        default: "",
        parseHTML: (element) => sanitizeUrl(element.getAttribute("data-src")),
        renderHTML: (attributes: DatabaseTableAttributes) => ({
          "data-src": sanitizeUrl(attributes.src),
        }),
      },
      source: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-source") || "",
        renderHTML: (attributes: DatabaseTableAttributes) => ({
          "data-source": attributes.source || "",
        }),
      },
      title: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-title") || "",
        renderHTML: (attributes: any) => ({
          "data-title": attributes.title || "",
        }),
      },
      widthMode: {
        // "min" = minimal (Default) · "equal" = gleiche Breite (voll) · "auto" = angepasst (voll)
        default: "min",
        parseHTML: (element) => element.getAttribute("data-width-mode") || "min",
        renderHTML: (attributes: any) => ({
          "data-width-mode": attributes.widthMode || "min",
        }),
      },
      headerRow: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-header-row") !== "false",
        renderHTML: (attributes: any) => ({
          "data-header-row": attributes.headerRow ? "true" : "false",
        }),
      },
      headerColumn: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-header-column") === "true",
        renderHTML: (attributes: any) => ({
          "data-header-column": attributes.headerColumn ? "true" : "false",
        }),
      },
      rowNumbers: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-row-numbers") === "true",
        renderHTML: (attributes: any) => ({
          "data-row-numbers": attributes.rowNumbers ? "true" : "false",
        }),
      },
      showTitle: {
        default: true,
        parseHTML: (element) => element.getAttribute("data-show-title") !== "false",
        renderHTML: (attributes: any) => ({
          "data-show-title": attributes.showTitle ? "true" : "false",
        }),
      },
      bgMode: {
        // "striped" (Default, gestreift) · "plain" (einfarbig) · "noheader" (Header ohne Hintergrund)
        default: "striped",
        parseHTML: (element) => element.getAttribute("data-bg-mode") || "striped",
        renderHTML: (attributes: any) => ({
          "data-bg-mode": attributes.bgMode || "striped",
        }),
      },
      borderMode: {
        // "all" (Default) · "h" (nur horizontale Linien) · "none"
        default: "all",
        parseHTML: (element) => element.getAttribute("data-border-mode") || "all",
        renderHTML: (attributes: any) => ({
          "data-border-mode": attributes.borderMode || "all",
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: `div[data-type="${this.name}"]` }];
  },

  renderHTML({ HTMLAttributes }) {
    const src = HTMLAttributes["data-src"];
    const safeHref = sanitizeUrl(src);
    // Export/Fallback: Link auf die Live-View (statische Tabelle wird im Editor gerendert).
    return [
      "div",
      mergeAttributes(
        { "data-type": this.name },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      [
        "a",
        { href: safeHref, target: "_blank" },
        safeHref || "Datenbank-Tabelle",
      ],
    ];
  },

  addCommands() {
    return {
      setDatabaseTable:
        (attrs: DatabaseTableAttributes = {}) =>
        ({ commands }) => {
          const src = sanitizeUrl(attrs.src || "");
          return commands.insertContent({
            type: this.name,
            attrs: { src, source: attrs.source || detectDatabaseSource(src) },
          });
        },
    };
  },

  addPasteRules() {
    // Eingefügter Baserow/NocoDB-Public-Link -> wird automatisch zum databaseTable-Node.
    return [
      nodePasteRule({
        find: DATABASE_TABLE_URL_REGEX,
        type: this.type,
        getAttributes: (match) => {
          const url = sanitizeUrl(match[0]);
          return { src: url, source: detectDatabaseSource(url) };
        },
      }),
    ];
  },

  addNodeView() {
    // wie beim Embed-Node: React-View wird vom Client per options.view geliefert.
    this.editor.isInitialized = true;
    return ReactNodeViewRenderer(this.options.view);
  },
});
