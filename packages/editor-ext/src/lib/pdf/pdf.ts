import { ReactNodeViewRenderer } from "@tiptap/react";
import { mergeAttributes, Range, Node } from "@tiptap/core";
import { PdfUploadPlugin } from "./pdf-upload";

export interface PdfOptions {
  view: any;
  HTMLAttributes: Record<string, any>;
}

export interface PdfAttributes {
  src?: string;
  title?: string;
  align?: string;
  attachmentId?: string;
  size?: number;
  width?: number;
  height?: number;
  pageNum?: number;
  pageRange?: string;
  totalPages?: number;
  locked?: boolean;
  scale?: number;
  floating?: boolean;
  browserView?: boolean;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    pdfBlock: {
      setPdf: (attributes: PdfAttributes) => ReturnType;
      setPdfAt: (
        attributes: PdfAttributes & { pos: number | Range },
      ) => ReturnType;
      setPdfAlign: (align: "left" | "center" | "right") => ReturnType;
      setPdfWidth: (width: number) => ReturnType;
      setPdfPage: (pageNum: number) => ReturnType;
      setPdfPageRange: (pageRange: string) => ReturnType;
      setPdfLocked: (locked: boolean) => ReturnType;
      setPdfScale: (scale: number) => ReturnType;
      setPdfFloating: (floating: boolean) => ReturnType;
      setPdfBrowserView: (browserView: boolean) => ReturnType;
      setPdfHeight: (height: string) => ReturnType;
    };
  }
}

export const TiptapPdf = Node.create<PdfOptions>({
  name: "pdf",

  group: "block",
  isolating: true,
  atom: true,
  defining: true,
  draggable: true,

  addOptions() {
    return {
      view: null,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      src: {
        default: "",
        parseHTML: (element) => element.getAttribute("src"),
        renderHTML: (attributes) => ({
          src: attributes.src,
        }),
      },
      attachmentId: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-attachment-id"),
        renderHTML: (attributes: PdfAttributes) => ({
          "data-attachment-id": attributes.attachmentId,
        }),
      },
      title: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-title"),
        renderHTML: (attributes: PdfAttributes) => ({
          "data-title": attributes.title,
        }),
      },
      width: {
        default: "100%",
        parseHTML: (element) => element.getAttribute("width"),
        renderHTML: (attributes: PdfAttributes) => ({
          width: attributes.width,
        }),
      },
      height: {
        default: "600px",
        parseHTML: (element) => element.getAttribute("height"),
        renderHTML: (attributes: PdfAttributes) => ({
          height: attributes.height,
        }),
      },
      size: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-size"),
        renderHTML: (attributes: PdfAttributes) => ({
          "data-size": attributes.size,
        }),
      },
      align: {
        default: "center",
        parseHTML: (element) => element.getAttribute("data-align"),
        renderHTML: (attributes: PdfAttributes) => ({
          "data-align": attributes.align,
        }),
      },
      pageNum: {
        default: 1,
        parseHTML: (element) => parseInt(element.getAttribute("data-page-num") || "1"),
        renderHTML: (attributes: PdfAttributes) => ({
          "data-page-num": attributes.pageNum,
        }),
      },
      pageRange: {
        default: undefined,
        parseHTML: (element) => element.getAttribute("data-page-range"),
        renderHTML: (attributes: PdfAttributes) => ({
          "data-page-range": attributes.pageRange,
        }),
      },
      browserView: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-browser-view") === "true",
        renderHTML: (attributes: PdfAttributes) => ({
          "data-browser-view": attributes.browserView,
        }),
      },
      totalPages: {
        default: undefined,
        parseHTML: (element) => parseInt(element.getAttribute("data-total-pages") || "0"),
        renderHTML: (attributes: PdfAttributes) => ({
          "data-total-pages": attributes.totalPages,
        }),
      },
      locked: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-locked") === "true",
        renderHTML: (attributes: PdfAttributes) => ({
          "data-locked": attributes.locked,
        }),
      },
      scale: {
        default: 1.0,
        parseHTML: (element) => parseFloat(element.getAttribute("data-scale") || "1.0"),
        renderHTML: (attributes: PdfAttributes) => ({
          "data-scale": attributes.scale,
        }),
      },
      floating: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-floating") === "true",
        renderHTML: (attributes: PdfAttributes) => ({
          "data-floating": attributes.floating,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'embed[type="application/pdf"]',
      },
      {
        tag: 'iframe[src*=".pdf"]',
      },
      {
        tag: 'div[data-type="pdf"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-type": "pdf" },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
    ];
  },

  addCommands() {
    return {
      setPdf:
        (attrs: PdfAttributes) =>
        ({ commands }) => {
          return commands.insertContent({
            type: "pdf",
            attrs: attrs,
          });
        },

      setPdfAt:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContentAt(attrs.pos, {
            type: "pdf",
            attrs: attrs,
          });
        },

      setPdfAlign:
        (align) =>
        ({ commands }) =>
          commands.updateAttributes("pdf", { align }),

      setPdfWidth:
        (width) =>
        ({ commands }) =>
          commands.updateAttributes("pdf", {
            width: `${Math.max(0, Math.min(100, width))}%`,
          }),

      setPdfPage:
        (pageNum) =>
        ({ commands }) =>
          commands.updateAttributes("pdf", { pageNum }),

      setPdfPageRange:
        (pageRange) =>
        ({ commands }) =>
          commands.updateAttributes("pdf", { pageRange }),

      setPdfHeight:
        (height) =>
        ({ commands }) =>
          commands.updateAttributes("pdf", { height }),

      setPdfLocked:
        (locked) =>
        ({ commands }) =>
          commands.updateAttributes("pdf", { locked }),

      setPdfScale:
        (scale) =>
        ({ commands }) =>
          commands.updateAttributes("pdf", { scale }),

      setPdfBrowserView:
        (browserView) =>
        ({ commands }) =>
          commands.updateAttributes("pdf", { browserView }),

      setPdfFloating:
        (floating) =>
        ({ commands }) =>
          commands.updateAttributes("pdf", { floating }),
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(this.options.view);
  },

  addProseMirrorPlugins() {
    return [
      PdfUploadPlugin({
        placeholderClass: "pdf-upload",
      }),
    ];
  },
});