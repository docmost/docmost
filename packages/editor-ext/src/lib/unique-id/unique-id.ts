import { generateNodeId } from "../utils.js";
import { UniqueID as TiptapUniqueID } from "@tiptap/extension-unique-id";

export const UniqueID = TiptapUniqueID.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      generateID: () => generateNodeId(),
    };
  },
});
