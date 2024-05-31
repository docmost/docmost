import { useAtom } from "jotai";

export function useToggleSidebar(sidebarAtom: any) {
  const [sidebarState, setSidebarState] = useAtom(sidebarAtom);
  return () => {
    setSidebarState(!sidebarState);
  }
}
