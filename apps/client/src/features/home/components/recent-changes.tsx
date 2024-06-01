import {
  Text,
  Group,
  Stack,
  UnstyledButton,
  Divider,
  Badge,
} from "@mantine/core";
import classes from "./home.module.css";
import { Link } from "react-router-dom";
import PageListSkeleton from "@/components/ui/page-list-skeleton.tsx";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { formattedDate } from "@/lib/time.ts";
import { useRecentChangesQuery } from "@/features/page/queries/page-query.ts";
import { IconFileDescription } from "@tabler/icons-react";
import { getSpaceUrl } from "@/lib/config.ts";

function RecentChanges() {
  const { data, isLoading, isError } = useRecentChangesQuery();

  if (isLoading) {
    return <PageListSkeleton />;
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
              to={buildPageUrl(page?.space.slug, page.slugId, page.title)}
              className={classes.page}
              p="xs"
            >
              <Group wrap="nowrap">
                <Stack gap="xs" style={{ flex: 1 }}>
                  <Group wrap="nowrap">
                    {page.icon || <IconFileDescription size={18} />}

                    <Text fw={500} size="md" lineClamp={1}>
                      {page.title || "Untitled"}
                    </Text>
                  </Group>
                </Stack>

                <Badge
                  color="blue"
                  variant="light"
                  component={Link}
                  to={getSpaceUrl(page.space.slug)}
                >
                  {page.space.name}
                </Badge>

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

export default RecentChanges;
