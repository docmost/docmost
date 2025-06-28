import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export function useAnchorScroll(offset = 95, maxRetries = 10, retryDelay = 500) {
  const location = useLocation();
  const lastHash = useRef("");

  useEffect(() => {
    let retries = maxRetries;

    const tryScroll = () => {
      let el = document.getElementById(lastHash.current);
      
      if (!el) {
        const hash = lastHash.current;
        
        if (hash.includes('-')) {
          const parts = hash.split('-');
          const possibleUid = parts[parts.length - 1];
          
          const elements = document.querySelectorAll('[id]');
          for (const element of elements) {
            if (element.id.endsWith(`-${possibleUid}`)) {
              el = element as HTMLElement;
              break;
            }
          }
        }
        
        if (!el) {
          const elements = document.querySelectorAll('[id]');
          for (const element of elements) {
            if (element.id.endsWith(`-${hash}`) || element.id === hash) {
              el = element as HTMLElement;
              break;
            }
          }
        }
      }

      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: y, behavior: "smooth" });
        window.history.replaceState(null, "", `#${el.id}`);
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
