import {Container} from "@mantine/core";
import SharedSpaceHomeTabs from "@/features/space/components/shared-space-home-tabs.tsx";
import {useParams} from "react-router-dom";
import {useGetSharedSpaceBySlugQuery} from "@/features/space/queries/shared-space-query.ts";
import {getAppName} from "@/lib/config.ts";
import {Helmet} from "react-helmet-async";

export default function SpaceHome() {
    const {spaceSlug} = useParams();
    const {data: space} = useGetSharedSpaceBySlugQuery(spaceSlug);

    return (
        <>
            <Helmet>
                <title>{space?.name || 'Overview'} - {getAppName()}</title>
            </Helmet>
            <Container size={"800"} pt="xl">
                {space && <SharedSpaceHomeTabs/>}
            </Container>
        </>
    );
}
