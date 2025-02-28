// original code: https://github.com/amirhhashemi/tiptap-text-direction/blob/master/src/index.ts
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { EditorView } from "@tiptap/pm/view";

const RTL = "\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC";
const LTR =
  "A-Za-z\u00C0-\u00D6\u00D8-\u00F6" +
  "\u00F8-\u02B8\u0300-\u0590\u0800-\u1FFF\u200E\u2C00-\uFB1C" +
  "\uFE00-\uFE6F\uFEFD-\uFFFF";

const RTL_REGEX = new RegExp(`^[^${LTR}]*[${RTL}]`);
const LTR_REGEX = new RegExp(`^[^${RTL}]*[${LTR}]`);

export function getTextDirection(text: string): "ltr" | "rtl" | null {
  if (!text) {
    return null;
  }
  if (RTL_REGEX.test(text)) {
    return "rtl";
  }
  if (LTR_REGEX.test(text)) {
    return "ltr";
  }
  return null;
}

const validDirections = ["ltr", "rtl", "auto"] as const;
type Direction = (typeof validDirections)[number];

export interface TextDirectionOptions {
  /**
   * Node types for which you want to set the `dir` attribute
   * (e.g. ["paragraph", "heading", "listItem"]).
   */
  types: string[];
  /**
   * If you want a default direction (e.g. "ltr" or "rtl") when
   * no direction can be inferred from the node text.
   */
  defaultDirection: Direction | null;
}

/**
 * A Tiptap extension for automatically detecting and updating
 * the text direction (dir) on specific node types. It also
 * exposes commands for manually setting and unsetting direction.
 */
export const TextDirection = Extension.create<TextDirectionOptions>({
  name: "textDirection",

  addOptions() {
    return {
      types: [],
      defaultDirection: null,
    };
  },

  /**
   * We add a `dir` attribute to the configured node types.
   * By default, `dir` is `null`, so it’s omitted unless we set it.
   */
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          dir: {
            default: null,
            parseHTML: (element) =>
              element.dir || this.options.defaultDirection,
            renderHTML: (attributes) => {
              // If it's the default direction, skip setting `dir`
              if (attributes.dir === this.options.defaultDirection) {
                return {};
              }
              return { dir: attributes.dir };
            },
          },
        },
      },
    ];
  },

  /**
   * Add commands to manually set/unset direction.
   */
  addCommands() {
    return {
      setTextDirection:
        (direction: Direction) =>
        ({ commands }) => {
          if (!validDirections.includes(direction)) {
            return false;
          }
          // Apply `dir` to all relevant node types
          return this.options.types.every((type) =>
            commands.updateAttributes(type, { dir: direction }),
          );
        },

      unsetTextDirection:
        () =>
        ({ commands }) => {
          return this.options.types.every((type) =>
            commands.resetAttributes(type, "dir"),
          );
        },
    };
  },

  /**
   * Example keyboard shortcuts for quick direction switching.
   */
  addKeyboardShortcuts() {
    return {
      "Mod-Alt-l": () => this.editor.commands.setTextDirection("ltr"),
      "Mod-Alt-r": () => this.editor.commands.setTextDirection("rtl"),
    };
  },

  /**
   * The main logic is in the ProseMirror plugin: we track IME composition
   * and update directions only when safe.
   */
  addProseMirrorPlugins() {
    const { types } = this.options;
    const pluginKey = new PluginKey("textDirectionPluginKey");

    return [
      new Plugin({
        key: pluginKey,

        // We store a small plugin state, just a flag for `isComposing`.
        state: {
          init() {
            return { isComposing: false };
          },
          apply(tr, pluginValue) {
            // We keep the same state unless we specifically update it ourselves
            // in the handleDOMEvents below.
            return { ...pluginValue };
          },
        },

        props: {
          // This is how ProseMirror suggests handling composition events.
          // We do NOT rely on global `document.addEventListener(...)`.
          handleDOMEvents: {
            compositionstart: (view: EditorView, event: Event) => {
              const state = pluginKey.getState(view.state);
              state.isComposing = true;
              return false; // allow normal handling
            },
            compositionend: (view: EditorView, event: Event) => {
              const state = pluginKey.getState(view.state);
              state.isComposing = false;

              // Once composition ends, we can safely detect directions
              // for any changed nodes.
              const { tr } = view.state;
              tr.setMeta("addToHistory", false);

              let modified = false;
              view.state.doc.descendants((node, pos) => {
                if (!types.includes(node.type.name)) return;

                // If there's no text, skip
                if (!node.textContent) return;

                const detected = getTextDirection(node.textContent);
                const current = node.attrs.dir;
                // Only update if it’s actually changed
                if (detected !== current) {
                  tr.setNodeAttribute(pos, "dir", detected ?? null);
                  modified = true;
                }
              });

              if (modified) {
                view.dispatch(tr);
              }

              return false; // allow normal handling
            },
          },
        },

        // For non-IME text input (straight typing in English, etc.),
        // we can automatically detect direction in `appendTransaction`.
        appendTransaction: (transactions, oldState, newState) => {
          const pluginState = pluginKey.getState(oldState);
          // If we’re currently composing (IME in progress), skip
          if (pluginState.isComposing) {
            return null;
          }

          // If no actual doc change, do nothing
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged) {
            return null;
          }

          const tr = newState.tr;
          tr.setMeta("addToHistory", false);

          let modified = false;
          newState.doc.descendants((node, pos) => {
            if (!types.includes(node.type.name)) return;

            if (!node.textContent) return;
            const detected = getTextDirection(node.textContent);
            const current = node.attrs.dir;
            if (detected !== current) {
              tr.setNodeAttribute(pos, "dir", detected ?? null);
              modified = true;
            }
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});
