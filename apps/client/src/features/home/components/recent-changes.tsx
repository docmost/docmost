import { Text, Group, Stack, UnstyledButton, Divider } from "@mantine/core";
import { format } from "date-fns";
import classes from "./home.module.css";
import { Link } from "react-router-dom";
import PageListSkeleton from "@/features/home/components/page-list-skeleton";
import { useRecentChangesQuery } from "@/features/page/queries/page-query";
import { buildPageSlug } from "@/features/page/page.utils.ts";

function RecentChanges() {
  const { data, isLoading, isError } = useRecentChangesQuery();

  if (isLoading) {
    return <PageListSkeleton />;
  }

  if (isError) {
    return <Text>Failed to fetch recent pages</Text>;
  }

  return (
    <div>
      {data.items.map((page) => (
        <div key={page.id}>
          <UnstyledButton
            component={Link}
            to={buildPageSlug(page.slugId, page.title)}
            className={classes.page}
            p="xs"
          >
            <Group wrap="nowrap">
              <Stack gap="xs" style={{ flex: 1 }}>
                <Text fw={500} size="md" lineClamp={1}>
                  {page.title || "Untitled"}
                </Text>
              </Stack>

              <Text c="dimmed" size="xs" fw={500}>
                {format(new Date(page.updatedAt), "PP")}
              </Text>
            </Group>
          </UnstyledButton>
          <Divider />
        </div>
      ))}
    </div>
  );
}

export default RecentChanges;
