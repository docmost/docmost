import { Text, Group, UnstyledButton, Badge, Table } from "@mantine/core";
import { Link } from "react-router-dom";
import PageListSkeleton from "@/components/ui/page-list-skeleton.tsx";
import { buildPageUrl } from "@/features/page/page.utils.ts";
import { formattedDate } from "@/lib/time.ts";
import { useRecentChangesQuery } from "@/features/page/queries/page-query.ts";
import { IconFileDescription } from "@tabler/icons-react";
import { getSpaceUrl } from "@/lib/config.ts";

interface Props {
  spaceId?: string;
}
export default function RecentChanges({ spaceId }: Props) {
  const { data: pages, isLoading, isError } = useRecentChangesQuery(spaceId);

  if (isLoading) {
    return <PageListSkeleton />;
  }

  if (isError) {
    return <Text>Failed to fetch recent pages</Text>;
  }

  return pages && pages.items.length > 0 ? (
    <Table highlightOnHover verticalSpacing="sm">
      <Table.Tbody>
        {pages.items.map((page) => (
          <Table.Tr key={page.id}>
            <Table.Td>
              <UnstyledButton
                component={Link}
                to={buildPageUrl(page?.space.slug, page.slugId, page.title)}
              >
                <Group wrap="nowrap">
                  {page.icon || <IconFileDescription size={18} />}

                  <Text fw={500} size="md" lineClamp={1}>
                    {page.title || "Untitled"}
                  </Text>
                </Group>
              </UnstyledButton>
            </Table.Td>
            {!spaceId && (
              <Table.Td>
                <Badge
                  color="blue"
                  variant="light"
                  component={Link}
                  to={getSpaceUrl(page?.space.slug)}
                  style={{ cursor: "pointer" }}
                >
                  {page?.space.name}
                </Badge>
              </Table.Td>
            )}
            <Table.Td>
              <Text c="dimmed" size="xs" fw={500}>
                {formattedDate(page.updatedAt)}
              </Text>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  ) : (
    <Text size="md" ta="center">
      No pages yet
    </Text>
  );
}
