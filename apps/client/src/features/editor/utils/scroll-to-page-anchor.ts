import { showTabAtElement } from "./show-tab-at-element";

export function scrollToPageAnchor(root: ParentNode, fragment: string): boolean {
  const id = CSS.escape(fragment);
  const target = root.querySelector(`[id="${id}"], [data-id="${id}"]`);
  if (!target?.isConnected) return false;
  const destination = target.matches('[data-type="section-anchor"]')
    ? target.closest("h1,h2,h3,h4,h5,h6") ?? target
    : target;
  showTabAtElement(destination);
  destination.scrollIntoView({ behavior: "smooth", block: "start" });
  return true;
}
