import { atom } from "jotai";

export function atomWithWebStorage<Value>(key: string, initialValue: Value, storage = localStorage) {
  const storedValue = localStorage.getItem(key);
  const isStringOrInt = typeof initialValue === "string" || typeof initialValue === "number";

  const storageValue = storedValue ? isStringOrInt ? storedValue : storedValue === "true" : undefined;

  const baseAtom = atom(storageValue ?? initialValue);
  return atom(
    get => get(baseAtom) as Value,
    (_get, set, nextValue: Value) => {
      set(baseAtom, nextValue);
      storage.setItem(key, nextValue!.toString());
    },
  );
}
