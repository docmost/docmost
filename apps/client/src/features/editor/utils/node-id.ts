import { customAlphabet } from "nanoid";

const slugIdAlphabet =
  "0123456789abcdefghijklmnopqrstuvwxyz";
export const generateEditorNodeId = customAlphabet(slugIdAlphabet, 12);
