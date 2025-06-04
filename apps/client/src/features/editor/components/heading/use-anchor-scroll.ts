import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export function useAnchorScroll(offset = 95, maxRetries = 10, retryDelay = 500) {
  const location = useLocation();
  const lastHash = useRef("");

  useEffect(() => {
    let retries = maxRetries;

    const tryScroll = () => {
      const el = document.getElementById(lastHash.current);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: y, behavior: "smooth" });
        window.history.replaceState(null, "", `#${lastHash.current}`);
      } else if (retries > 0) {
        retries--;
        setTimeout(tryScroll, retryDelay);
      }
    };

    if (location.hash) {
      lastHash.current = location.hash.slice(1);
      tryScroll();
    }
  }, [location, offset, maxRetries, retryDelay]);
}
