import { useAtom } from "jotai";

export function useToggleToc(tocAtom: any) {
  const [tocState, setTocState] = useAtom(tocAtom);
  return () => {
    setTocState(!tocState);
  }
}
