import slugify from "@sindresorhus/slugify";

const buildPageSlug = (pageSlugId: string, pageTitle?: string): string => {
  const titleSlug = slugify(pageTitle?.substring(0, 70) || "untitled", {
    customReplacements: [
      ["♥", ""],
      ["🦄", ""],
    ],
  });

  return `${titleSlug}-${pageSlugId}`;
};

export const buildPageUrl = (
  spaceName: string,
  pageSlugId: string,
  pageTitle?: string,
): string => {
  if (spaceName === undefined) {
    return `/p/${buildPageSlug(pageSlugId, pageTitle)}`;
  }
  return `/s/${spaceName}/p/${buildPageSlug(pageSlugId, pageTitle)}`;
};

export const buildSharedPageUrl = (opts: {
  shareId: string;
  pageSlugId: string;
  pageTitle?: string;
}): string => {
  const { shareId, pageSlugId, pageTitle } = opts;
  if (!shareId) {
    return `/share/p/${buildPageSlug(pageSlugId, pageTitle)}`;
  }

  return `/share/${shareId}/p/${buildPageSlug(pageSlugId, pageTitle)}`;
};
