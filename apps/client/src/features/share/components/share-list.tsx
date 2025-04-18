import { Table, Group, Text, Anchor } from "@mantine/core";
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Paginate from "@/components/common/paginate.tsx";
import { useGetSharesQuery } from "@/features/share/queries/share-query.ts";
import { ISharedItem } from "@/features/share/types/share.types.ts";
import { format } from "date-fns";
import ShareActionMenu from "@/features/share/components/share-action-menu.tsx";
import { buildSharedPageUrl } from "@/features/page/page.utils.ts";
import { getPageIcon } from "@/lib";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import classes from "./share.module.css";

export default function ShareList() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const { data, isLoading } = useGetSharesQuery({ page });

  return (
    <>
      <Table.ScrollContainer minWidth={500}>
        <Table verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{t("Page")}</Table.Th>
              <Table.Th>{t("Shared by")}</Table.Th>
              <Table.Th>{t("Shared at")}</Table.Th>
            </Table.Tr>
          </Table.Thead>

          <Table.Tbody>
            {data?.items.map((share: ISharedItem, index: number) => (
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
                    target="_blank"
                    to={buildSharedPageUrl({
                      shareId: share.key,
                      pageTitle: share.page.title,
                      pageSlugId: share.page.slugId,
                    })}
                  >
                    <Group gap="4" wrap="nowrap">
                      {getPageIcon(share.page.icon)}
                      <div className={classes.shareLinkText}>
                        <Text fz="sm" fw={500} lineClamp={1}>
                          {share.page.title || t("untitled")}
                        </Text>
                      </div>
                    </Group>
                  </Anchor>
                </Table.Td>
                <Table.Td>
                  <Group gap="4" wrap="nowrap">
                    <CustomAvatar
                      avatarUrl={share.creator?.avatarUrl}
                      name={share.creator.name}
                      size="sm"
                    />
                    <Text fz="sm" lineClamp={1}>
                      {share.creator.name}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text fz="sm" style={{ whiteSpace: "nowrap" }}>
                    {format(new Date(share.createdAt), "MMM dd, yyyy")}
                  </Text>
                </Table.Td>
                <Table.Td>
                  <ShareActionMenu share={share} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>

      {data?.items.length > 0 && (
        <Paginate
          currentPage={page}
          hasPrevPage={data?.meta.hasPrevPage}
          hasNextPage={data?.meta.hasNextPage}
          onPageChange={setPage}
        />
      )}
    </>
  );
}
