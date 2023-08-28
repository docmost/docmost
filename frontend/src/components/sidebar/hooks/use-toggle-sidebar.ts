import { useAtom } from "jotai";

export function useToggleSidebar(sidebarAtom) {
  const [sidebarState, setSidebarState] = useAtom(sidebarAtom);
  return () => {
    setSidebarState(!sidebarState);
  }
}
