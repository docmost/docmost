import { UserProvider } from "@/features/user/user-provider.tsx";
import { Outlet, useParams } from "react-router-dom";
import GlobalAppShell from "@/components/layouts/global/global-app-shell.tsx";
import { PosthogUser } from "@/ee/components/posthog-user.tsx";
import { isCloud } from "@/lib/config.ts";
import { SearchSpotlight } from "@/features/search/components/search-spotlight.tsx";
import React from "react";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";
import { AppErrorBoundary } from "@/components/ui/app-error-boundary.tsx";
import { PageLoading } from "@/pages/page/page-loading";

export default function Layout() {
  const { spaceSlug, pageSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);

  return (
    <UserProvider
      pending={
        <GlobalAppShell sessionPending>
          {pageSlug && <PageLoading />}
        </GlobalAppShell>
      }
    >
      <GlobalAppShell>
        <AppErrorBoundary>
          <React.Suspense fallback={null}>
            <Outlet />
          </React.Suspense>
        </AppErrorBoundary>
      </GlobalAppShell>
      {isCloud() && <PosthogUser />}
      <SearchSpotlight spaceId={space?.id} />
    </UserProvider>
  );
}
