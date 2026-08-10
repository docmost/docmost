import {Container} from "@mantine/core";
import SpaceHomeTabs from "@/features/space/components/space-home-tabs.tsx";
import {useParams} from "react-router-dom";
import {useGetSpaceBySlugQuery} from "@/features/space/queries/space-query.ts";
import { DocumentTitle } from "@/components/ui/document-title.tsx";

export default function SpaceHome() {
    const {spaceSlug} = useParams();
    const {data: space} = useGetSpaceBySlugQuery(spaceSlug);

    return (
        <>
            <DocumentTitle title={space?.name || 'Overview'} />
            <Container size={"900"} pt="xl">
                {space && <SpaceHomeTabs/>}
            </Container>
        </>
    );
}
