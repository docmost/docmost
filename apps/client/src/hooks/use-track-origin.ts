import { settingsOriginAtom } from "@/components/settings/atoms/settings-origin-atom";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function useTrackOrigin() {
  const location = useLocation();
  const setOrigin = useSetAtom(settingsOriginAtom);

  useEffect(() => {
    const isInSettings = location.pathname.startsWith("/settings");
    if (!isInSettings) {
      setOrigin(location.pathname);
    }
  }, [location.pathname, setOrigin]);
}