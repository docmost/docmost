import { customAlphabet } from "nanoid";

const baseIdSuffix = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 9);

export const generateBaseChoiceId = (): string => `opt${baseIdSuffix()}`;
