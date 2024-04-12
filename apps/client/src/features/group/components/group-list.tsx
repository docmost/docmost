import { Table, Group, Text, Anchor } from "@mantine/core";
import { useGetGroupsQuery } from "@/features/group/queries/group-query";
import React from "react";
import { Link } from "react-router-dom";
import { IconGroupCircle } from "@/components/icons/icon-people-circle.tsx";

export default function GroupList() {
  const { data, isLoading } = useGetGroupsQuery();

  return (
    <>
      {data && (
        <Table highlightOnHover verticalSpacing="sm">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Group</Table.Th>
              <Table.Th>Members</Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {data?.items.map((group, index) => (
              <Table.Tr key={index}>
                <Table.Td>
                  <Anchor
                    size="sm"
                    underline="never"
                    style={{
                      cursor: "pointer",
                      color: "var(--mantine-color-text)",
                    }}
                    component={Link}
                    to={`/settings/groups/${group.id}`}
                  >
                    <Group gap="sm">
                      <IconGroupCircle />
                      <div>
                        <Text fz="sm" fw={500}>
                          {group.name}
                        </Text>
                        <Text fz="xs" c="dimmed">
                          {group.description}
                        </Text>
                      </div>
                    </Group>
                  </Anchor>
                </Table.Td>

                <Table.Td>
                  <Anchor
                    size="sm"
                    underline="never"
                    style={{
                      cursor: "pointer",
                      color: "var(--mantine-color-text)",
                    }}
                    component={Link}
                    to={`/settings/groups/${group.id}`}
                  >
                    {group.memberCount} members
                  </Anchor>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </>
  );
}
