import type { MouseEvent } from "react";
import { matchPath, useNavigate } from "react-router-dom";
import { scrollToPageAnchor } from "../../utils/scroll-to-page-anchor";

const pagePaths = [
  "/s/:spaceSlug/p/:pageSlug",
  "/s/:spaceSlug",
  "/p/:pageSlug",
  "/share/:shareId?/p/:pageSlug",
  "/share/:shareId",
  "/docs/:spaceSlug/:pageSlug?",
];

export function useImageLinkNavigation() {
  const navigate = useNavigate();

  return (event: MouseEvent<HTMLElement>) => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      !(event.target instanceof Element)
    )
      return;

    const link = event.target.closest<HTMLAnchorElement>("a[href]");
    // Content clicks bubble from an image, while the toolbar handles its own anchor.
    if (
      !link ||
      (link !== event.currentTarget &&
        !(link.firstElementChild instanceof HTMLImageElement)) ||
      link.hasAttribute("download") ||
      (link.target && link.target.toLowerCase() !== "_self") ||
      link.origin !== window.location.origin ||
      !pagePaths.some((path) => matchPath(path, link.pathname))
    )
      return;

    event.preventDefault();
    if (link.hash && link.href === window.location.href) {
      scrollToPageAnchor(document, link.hash.slice(1));
      return;
    }
    navigate({ pathname: link.pathname, search: link.search, hash: link.hash });
  };
}
