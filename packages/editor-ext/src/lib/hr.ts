import { HorizontalRule as TiptapHorizontalRule } from "@tiptap/extension-horizontal-rule";

export type HorizontalRuleType = "pageBreak";

export const HorizontalRule = TiptapHorizontalRule.extend({
  addAttributes() {
    return {
      type: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-type"),
        renderHTML: (attributes) => {
          if (attributes.type) {
            return {
              "data-type": attributes.type,
            };
          }
        },
      },
    };
  },
});
