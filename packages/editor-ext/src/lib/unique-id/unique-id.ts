import { generateNodeId } from "../utils";
import { UniqueID as TiptapUniqueID } from "@tiptap/extension-unique-id";

export const UniqueID = TiptapUniqueID.extend({
  addOptions() {
    return {
      ...this.parent?.(),
      generateID: () => generateNodeId(),
    };
  },
});
