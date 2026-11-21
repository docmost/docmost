export function publicImageLink(
  href: string,
  shareId?: string,
  spaceSlug?: string,
): string {
  const origin = window.location.origin;
  const local = href.startsWith(origin + "/")
    ? href.slice(origin.length)
    : href;
  const page = /^\/(?:s\/([^/?#]+)\/)?p\/([^/?#]+)\/?([?#].*)?$/.exec(local);
  if (!page) return href;
  const [, targetSpace, pageSlug, fragment = ""] = page;
  const suffix = pageSlug + fragment;
  if (shareId) return `/share/${shareId}/p/${suffix}`;
  if (spaceSlug && (!targetSpace || targetSpace === spaceSlug)) {
    return `/docs/${spaceSlug}/${suffix}`;
  }
  return href;
}
