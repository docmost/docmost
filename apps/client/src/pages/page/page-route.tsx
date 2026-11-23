import { useQuery } from "@tanstack/react-query";
import { useEffectEvent, useLayoutEffect } from "react";
import { useLocation, useNavigationType, useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";
import { importWithPrefetch } from "@/lib/lazy-prefetch";
import { PageLoadError, PageRouteFallback } from "./page-loading";

const loadEditorPage = importWithPrefetch(() => import("./page"), {
  prefetchFirst: true,
});

export function PageRoute() {
  const { pageSlug } = useParams();
  const pageId = extractPageSlugId(pageSlug);
  const { hash } = useLocation();
  const navigationType = useNavigationType();
  const scrollToPageStart = useEffectEvent(() => {
    if (navigationType === "PUSH" && !hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  });

  // A title edit can rewrite the URL while the reader is still on the same page.
  useLayoutEffect(() => {
    scrollToPageStart();
  }, [pageId]);

  // Mount the editor as soon as its module resolves, including on the first
  // navigation from another screen where a Suspense fallback can linger.
  const { data, error, refetch } = useQuery({
    queryKey: ["editor-page-module"],
    queryFn: loadEditorPage,
    staleTime: Infinity,
    gcTime: Infinity,
    networkMode: "always",
  });
  if (error) return <PageLoadError error={error} onRetry={refetch} />;
  const Page = data?.default;
  return Page ? <Page /> : <PageRouteFallback />;
}
