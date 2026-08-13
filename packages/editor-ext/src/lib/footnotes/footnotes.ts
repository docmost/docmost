//Source MIT - https://github.com/buttondown/tiptap-footnotes
import OrderedList from "@tiptap/extension-ordered-list";
import FootnoteRules from "./rules";

const Footnotes = OrderedList.extend({
  name: "footnotes",
  group: "", // removed the default group of the ordered list extension
  isolating: true,
  defining: true,
  draggable: false,

  content() {
    return "footnote*";
  },
  addAttributes() {
    return {
      class: {
        default: "footnotes",
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "ol.footnotes",
        priority: 1000,
      },
    ];
  },

  addKeyboardShortcuts() {
    return {};
  },
  addCommands() {
    return {};
  },
  addInputRules() {
    return [];
  },

  addExtensions() {
    return [FootnoteRules];
  },
});

export default Footnotes;
