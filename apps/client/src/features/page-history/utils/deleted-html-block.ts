// MIT - https://github.com/tabler/tabler-icons/blob/main/icons/outline/brand-html5.svg
const html5Icon = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 4l-2 14.5l-6 2l-6 -2l-2 -14.5l16 0"/><path d="M15.5 8h-7l.5 4h6l-.5 3.5l-2.5 .75l-2.5 -.75l-.1 -.5"/></svg>`;

// A deleted HTML block serializes to an empty div, so it is drawn as a labelled placeholder instead.
export function deletedHtmlBlockDOM(label: string): HTMLElement {
  const placeholder = document.createElement("div");
  placeholder.className = "history-diff-html-block";
  placeholder.innerHTML = html5Icon;

  const text = document.createElement("span");
  text.textContent = label;
  placeholder.appendChild(text);

  return placeholder;
}
