import { atom } from "jotai";

export function atomWithWebStorage<Value>(key: string, initialValue: Value, storage = localStorage) {
  const storedValue = storage.getItem(key);

  let parsedValue: Value | undefined;

  try {
    if (storedValue !== null) {
      parsedValue = JSON.parse(storedValue);
    }
  } catch {
    parsedValue = undefined;
  }

  const baseAtom = atom<Value>(parsedValue ?? initialValue);

  return atom(
    get => get(baseAtom) as Value,
    (_get, set, nextValue: Value) => {
      set(baseAtom, nextValue);

      try {
        const stringified = JSON.stringify(nextValue);
        storage.setItem(key, stringified);
      } catch {
        console.error("Unable to stringify value for storage");
      }
    },
  );
}
