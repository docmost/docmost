import { UserProvider } from "@/features/user/user-provider.tsx";
import { Outlet, useParams } from "react-router-dom";
import GlobalAppShell from "@/components/layouts/global/global-app-shell.tsx";
import { PosthogUser } from "@/ee/components/posthog-user.tsx";
import { isCloud } from "@/lib/config.ts";
import { SearchSpotlight } from "@/features/search/components/search-spotlight.tsx";
import React from "react";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";

export default function Layout() {
  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);

  return (
    <UserProvider>
      <GlobalAppShell>
        <Outlet />
      </GlobalAppShell>
      {isCloud() && <PosthogUser />}
      <SearchSpotlight spaceId={space?.id} />
    </UserProvider>
  );
}
