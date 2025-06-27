import { customAlphabet } from "nanoid";

const slugIdAlphabet =
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const generateSlugId = customAlphabet(slugIdAlphabet, 10);
