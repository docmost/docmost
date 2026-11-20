import { useQuery } from "@tanstack/react-query";
import { importWithPrefetch } from "@/lib/lazy-prefetch";
import { PageLoadError, PageRouteFallback } from "./page-loading";

const loadEditorPage = importWithPrefetch(() => import("./page"), {
  prefetchFirst: true,
});

export function PageRoute() {
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
