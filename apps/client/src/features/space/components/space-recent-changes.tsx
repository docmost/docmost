import { Text, Group, Stack, UnstyledButton, Divider } from "@mantine/core";
import classes from "./space-home.module.css";
import { Link, useParams } from "react-router-dom";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { formattedDate } from "@/lib/time.ts";
import { useRecentChangesQuery } from "@/features/page/queries/page-query.ts";
import { useGetSpaceBySlugQuery } from "@/features/space/queries/space-query.ts";

function SpaceRecentChanges() {
  const { spaceSlug } = useParams();
  const { data: space } = useGetSpaceBySlugQuery(spaceSlug);
  const { data, isLoading, isError } = useRecentChangesQuery(space?.id);

  if (isLoading) {
    return <></>;
  }

  if (isError) {
    return <Text>Failed to fetch recent pages</Text>;
  }

  return (
    data && (
      <div>
        {data.items.map((page) => (
          <div key={page.id}>
            <UnstyledButton
              component={Link}
              to={buildPageUrl(space.slug, page.slugId, page.title)}
              className={classes.page}
              p="xs"
            >
              <Group wrap="nowrap">
                <Stack gap="xs" style={{ flex: 1 }}>
                  <Text fw={500} size="sm" lineClamp={1}>
                    {page.title || "Untitled"}
                  </Text>
                </Stack>

                <Text c="dimmed" size="xs" fw={500}>
                  {formattedDate(page.updatedAt)}
                </Text>
              </Group>
            </UnstyledButton>
            <Divider />
          </div>
        ))}
      </div>
    )
  );
}

export default SpaceRecentChanges;
