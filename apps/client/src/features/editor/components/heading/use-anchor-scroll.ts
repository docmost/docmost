import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export function useAnchorScroll(offset = 95) {
  const location = useLocation();
  const lastHash = useRef("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const observerRef = useRef<MutationObserver | null>(null);

  useEffect(() => {
    const scrollToElement = (elementId: string) => {
      const el = document.getElementById(elementId);
      if (el) {
        const y = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top: y, behavior: "smooth" });
        window.history.replaceState(null, "", `#${elementId}`);
        return true;
      }
      return false;
    };

    const cleanup = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };

    const handleAnchorScroll = () => {
      if (!location.hash) return;
      
      const elementId = location.hash.slice(1);
      lastHash.current = elementId;

      if (scrollToElement(elementId)) {
        return;
      }

      observerRef.current = new MutationObserver(() => {
        if (scrollToElement(elementId)) {
          cleanup();
        }
      });

      observerRef.current.observe(document.body, {
        childList: true,
        subtree: true
      });

      timeoutRef.current = setTimeout(() => {
        cleanup();
      }, 10000);
    };

    handleAnchorScroll();

    return cleanup;
  }, [location.hash, offset]);
}
