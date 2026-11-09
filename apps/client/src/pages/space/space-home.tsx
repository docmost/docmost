import React, {Suspense} from "react";
import {Container} from "@mantine/core";
import SpaceHomeTabs from "@/features/space/components/space-home-tabs.tsx";
import SpacePublicNotice from "@/features/public-space/components/space-public-notice.tsx";
import SpaceArchivedNotice from "@/features/space/components/space-archived-notice.tsx";
import {useParams} from "react-router-dom";
import {useGetSpaceBySlugQuery} from "@/features/space/queries/space-query.ts";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import { ISpace } from "@/features/space/types/space.types.ts";
import SpaceHomePageSkeleton from "@/features/space/components/space-home-page-skeleton.tsx";

const SpaceHomePageView = React.lazy(
    () => import("@/features/space/components/space-home-page-view.tsx"),
);

export default function SpaceHome() {
    const {spaceSlug} = useParams();
    const {data: space, isFetchedAfterMount} = useGetSpaceBySlugQuery(spaceSlug, {staleTime: 0, refetchOnMount: true});

    if (space?.homePage) {
        if (!isFetchedAfterMount) return <SpaceHomePageSkeleton />;
        return (
            <Suspense fallback={<SpaceHomePageSkeleton />}>
                <SpaceHomePageView
                    key={space.homePage.id}
                    space={space}
                    homePage={space.homePage}
                    fallback={<SpaceOverview space={space} />}
                />
            </Suspense>
        );
    }

    return <SpaceOverview space={space} />;
}

function SpaceOverview({space}: {space?: ISpace}) {
    return (
        <>
            <DocumentTitle title={space?.name || 'Overview'} />
            <Container size={"900"} pt="xl">
                {space && <SpaceArchivedNotice space={space} />}
                {space && <SpacePublicNotice space={space} />}
                {space && <SpaceHomeTabs/>}
            </Container>
        </>
    );
}
