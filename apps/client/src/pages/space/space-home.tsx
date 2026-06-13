import {Container} from "@mantine/core";
import SpaceHomeTabs from "@/features/space/components/space-home-tabs.tsx";
import {useParams} from "react-router-dom";
import {useGetSpaceBySlugQuery} from "@/features/space/queries/space-query.ts";
import {useAppName} from "@/lib/config.ts";
import {Helmet} from "react-helmet-async";

export default function SpaceHome() {
    const {spaceSlug} = useParams();
    const {data: space} = useGetSpaceBySlugQuery(spaceSlug);

    return (
        <>
            <Helmet>
                <title>{space?.name || 'Overview'} - {useAppName()}</title>
            </Helmet>
            <Container size={"900"} pt="xl">
                {space && <SpaceHomeTabs/>}
            </Container>
        </>
    );
}
