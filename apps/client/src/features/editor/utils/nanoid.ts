import { customAlphabet } from "nanoid";

const slugIdAlphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const generateEditorNodeId = customAlphabet(slugIdAlphabet, 12);
