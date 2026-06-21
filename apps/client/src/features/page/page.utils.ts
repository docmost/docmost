import slugify from "@sindresorhus/slugify";
import type { TFunction } from "i18next";

/**
 * Display title for a page, with a base-aware empty-title fallback: bases
 * fall back to "Untitled base", normal pages to "Untitled". Single chokepoint
 * so the fallback stays consistent across the UI.
 */
export function getPageTitle(
  title: string | null | undefined,
  isBase: boolean | undefined,
  t: TFunction,
): string {
  return title || (isBase ? t("Untitled base") : t("Untitled"));
}

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
  anchorId?: string,
): string => {
  let url: string;
  if (spaceName === undefined) {
    url = `/p/${buildPageSlug(pageSlugId, pageTitle)}`;
  } else {
    url = `/s/${spaceName}/p/${buildPageSlug(pageSlugId, pageTitle)}`;
  }
  return anchorId ? `${url}#${anchorId}` : url;
};

export const buildSharedPageUrl = (opts: {
  shareId: string;
  pageSlugId: string;
  pageTitle?: string;
  anchorId?: string;
}): string => {
  const { shareId, pageSlugId, pageTitle, anchorId } = opts;
  let url: string;
  if (!shareId) {
    url = `/share/p/${buildPageSlug(pageSlugId, pageTitle)}`;
  } else {
    url = `/share/${shareId}/p/${buildPageSlug(pageSlugId, pageTitle)}`;
  }
  return anchorId ? `${url}#${anchorId}` : url;
};
