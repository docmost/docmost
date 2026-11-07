import {Container} from "@mantine/core";
import SpaceHomeTabs from "@/features/space/components/space-home-tabs.tsx";
import SpacePublicNotice from "@/features/public-space/components/space-public-notice.tsx";
import {Navigate, useParams} from "react-router-dom";
import {useGetSpaceBySlugQuery} from "@/features/space/queries/space-query.ts";
import { DocumentTitle } from "@/components/ui/document-title.tsx";
import { buildPageUrl } from "@/features/page/page.utils.ts";

export default function SpaceHome() {
    const {spaceSlug} = useParams();
    const {data: space, isFetchedAfterMount} = useGetSpaceBySlugQuery(spaceSlug, {staleTime: 0, refetchOnMount: true});

    if (space?.homePage) {
        if (!isFetchedAfterMount) return null;
        return (
            <Navigate
                replace
                to={buildPageUrl(space.slug, space.homePage.slugId, space.homePage.title)}
            />
        );
    }

    return (
        <>
            <DocumentTitle title={space?.name || 'Overview'} />
            <Container size={"900"} pt="xl">
                {space && <SpacePublicNotice space={space} />}
                {space && <SpaceHomeTabs/>}
            </Container>
        </>
    );
}
