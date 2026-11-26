import { sanitizeHttpUrl } from "../utils";

export type LinkPreviewAttributes = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  icon: string | null;
};

export type LinkPreviewOptions = {
  HTMLAttributes: Record<string, any>;
  view: any;
};

export const sanitizeLinkPreviewUrl = sanitizeHttpUrl;

const textAttribute = (name: "title" | "description") => ({
  default: null,
  parseHTML: (element: HTMLElement) =>
    element.getAttribute(`data-${name}`) || null,
  renderHTML: (attributes: Partial<LinkPreviewAttributes>) =>
    attributes[name] ? { [`data-${name}`]: attributes[name] } : {},
});

const imageAttribute = (name: "image" | "icon") => ({
  default: null,
  parseHTML: (element: HTMLElement) =>
    sanitizeLinkPreviewUrl(element.getAttribute(`data-${name}`)) || null,
  renderHTML: (attributes: Partial<LinkPreviewAttributes>) => {
    const safe = sanitizeLinkPreviewUrl(attributes[name]);
    return safe ? { [`data-${name}`]: safe } : {};
  },
});

export function linkPreviewAttributes() {
  return {
    url: {
      default: "",
      parseHTML: (element: HTMLElement) =>
        sanitizeLinkPreviewUrl(element.getAttribute("data-url")),
      renderHTML: (attributes: Partial<LinkPreviewAttributes>) => ({
        "data-url": sanitizeLinkPreviewUrl(attributes.url),
      }),
    },
    title: textAttribute("title"),
    description: textAttribute("description"),
    image: imageAttribute("image"),
    icon: imageAttribute("icon"),
  };
}
