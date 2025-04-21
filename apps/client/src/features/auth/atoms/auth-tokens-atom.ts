import Cookies from "js-cookie";
import { createJSONStorage, atomWithStorage } from "jotai/utils";

const cookieStorage = createJSONStorage<any>(() => {
  return {
    getItem: () => Cookies.get("authTokens"),
    setItem: (key, value) => Cookies.set(key, value, { expires: 30 }),
    removeItem: (key) => Cookies.remove(key),
  };
});

export const authTokensAtom = atomWithStorage<any | null>(
  "authTokens",
  null,
  cookieStorage,
);
