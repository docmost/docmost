import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import { useAtom } from "jotai";

export const ASIDE_PANEL_ID = "aside-panel";

const useToggleAside = () => {
  const [asideState, setAsideState] = useAtom(asideStateAtom);

  const toggleAside = (tab: string) => {
    if (asideState.tab === tab) {
      setAsideState({ tab, isAsideOpen: !asideState.isAsideOpen });
    } else {
      setAsideState({ tab, isAsideOpen: true });
    }
  };

  return toggleAside;
};

export const useAsideTriggerProps = (tab: string) => {
  const [asideState, setAsideState] = useAtom(asideStateAtom);

  return {
    onClick: () => {
      if (asideState.tab === tab) {
        setAsideState({ tab, isAsideOpen: !asideState.isAsideOpen });
      } else {
        setAsideState({ tab, isAsideOpen: true });
      }
    },
    "aria-expanded": asideState.isAsideOpen && asideState.tab === tab,
    "aria-controls": ASIDE_PANEL_ID,
  } as const;
};

export default useToggleAside;
