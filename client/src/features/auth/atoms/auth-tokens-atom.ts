import Cookies from "js-cookie";
import { createJSONStorage, atomWithStorage } from "jotai/utils";
import { ITokens } from '../types/auth.types';


const cookieStorage = createJSONStorage<ITokens>(() => {
  return {
    getItem: () => Cookies.get("authTokens"),
    setItem: (key, value) => Cookies.set(key, value),
    removeItem: (key) => Cookies.remove(key),
  };
});

export const authTokensAtom = atomWithStorage<ITokens | null>("authTokens", null, cookieStorage);
