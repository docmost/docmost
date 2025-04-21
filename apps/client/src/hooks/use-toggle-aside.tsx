import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import { useAtom } from "jotai";

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

export default useToggleAside;
