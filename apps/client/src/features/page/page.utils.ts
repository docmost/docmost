import slugify from "@sindresorhus/slugify";

export const buildPageSlug = (
  pageShortId: string,
  pageTitle?: string,
): string => {
  const titleSlug = slugify(pageTitle?.substring(0, 99) || "untitled", {
    customReplacements: [
      ["♥", ""],
      ["🦄", ""],
    ],
  });

  return `/p/${pageShortId}/${titleSlug}`;
};
