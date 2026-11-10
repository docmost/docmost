// opens the hidden tab around an element the way find in page does, so it can be scrolled to
export function showTabAtElement(element: Element) {
  element
    .closest(".dm-tab-hidden")
    ?.dispatchEvent(new Event("beforematch", { bubbles: true }));
}
