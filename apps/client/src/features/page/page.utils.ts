import { Location } from "react-router-dom"
import slugify from "@sindresorhus/slugify";

const buildPageSlug = (pageSlugId: string, pageTitle?: string): string => {
  const titleSlug = slugify(pageTitle?.substring(0, 70) || "untitled", {
    customReplacements: [
      ["♥", ""],
      ["🦄", ""],
    ],
  });

  return `p/${titleSlug}-${pageSlugId}`;
};

export const buildPageUrl = (
  spaceName: string,
  pageSlugId: string,
  pageTitle?: string,
  share?: boolean
): string => {
  const isSharedPrefixed = window.location.pathname.startsWith("/share") || share
  const sharedPrefix = isSharedPrefixed ? "/share" : ""
  const spacePrefix = spaceName === undefined ? "" : `/s/${spaceName}`
  const pagePath = `${buildPageSlug(pageSlugId, pageTitle)}`
  return `${sharedPrefix}${spacePrefix}/${pagePath}`;
};
