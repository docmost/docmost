import {Container} from "@mantine/core";
import {useParams} from "react-router-dom";
import {useGetSpaceBySlugQuery} from "@/features/space/queries/space-query.ts";
import {getAppName} from "@/lib/config.ts";
import {Helmet} from "react-helmet-async";
import Graph from "@/features/space/components/graph";

export default function SpaceGraph() {
  const {spaceSlug} = useParams();
  const {data: space} = useGetSpaceBySlugQuery(spaceSlug);

  return (
    <>
      <Helmet>
        <title>{space?.name || 'Overview'} - {getAppName()}</title>
      </Helmet>
      <Container fluid={true}>
        {space && <Graph space={space}/>}
      </Container>
    </>
  );
}
