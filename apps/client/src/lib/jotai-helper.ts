import { atom } from "jotai";

export function atomWithWebStorage<Value>(key: string, initialValue: Value, storage = localStorage) {
  const storedValue = localStorage.getItem(key);
  const isString = typeof initialValue === "string";

  const storageValue = storedValue ? isString ? storedValue : storedValue === "true" : undefined;

  const baseAtom = atom(storageValue ?? initialValue);
  return atom(
    get => get(baseAtom) as Value,
    (_get, set, nextValue: Value) => {
      set(baseAtom, nextValue);
      storage.setItem(key, nextValue!.toString());
    },
  );
}
