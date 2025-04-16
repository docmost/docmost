import {
  Button,
  Group,
  Popover,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { IconWorld } from "@tabler/icons-react";
import React, { useEffect, useState } from "react";
import {
  useCreateShareMutation,
  useShareForPageQuery,
  useUpdateShareMutation,
} from "@/features/share/queries/share-query.ts";
import { useParams } from "react-router-dom";
import { extractPageSlugId } from "@/lib";
import { useTranslation } from "react-i18next";
import CopyTextButton from "@/components/common/copy.tsx";
import { getAppUrl } from "@/lib/config.ts";

export default function ShareModal() {
  const { t } = useTranslation();
  const { pageSlug } = useParams();
  const pageId = extractPageSlugId(pageSlug);
  const { data: share } = useShareForPageQuery(pageId);
  const createShareMutation = useCreateShareMutation();
  const updateShareMutation = useUpdateShareMutation();
  // pageIsShared means that the share exists and its level equals zero.
  const pageIsShared = share && share.level === 0;
  // if level is greater than zero, then it is a descendant page from a shared page
  const isDescendantShared = share && share.level > 0;

  const publicLink = `${getAppUrl()}/share/${share?.key}/${pageSlug}`;


  // TODO: think of permissions
  // controls should be read only for non space editors.


  // we could use the same shared content but have it have a share status
  // when you unshare, we hide the rest menu

  // todo, is public only if this is the shared page
  // if this is not the shared page and include chdilren == false, then set it to false
  const [isPagePublic, setIsPagePublic] = useState<boolean>(false);
  useEffect(() => {
    if (share) {
      setIsPagePublic(true);
    } else {
      setIsPagePublic(false);
    }
  }, [share, pageId]);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    createShareMutation.mutateAsync({ pageId: pageId });
    setIsPagePublic(value);
    // on create refetch share
  };

  const handleSubPagesChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.currentTarget.checked;
    updateShareMutation.mutateAsync({
      shareId: share.id,
      includeSubPages: value,
    });
  };

  const handleIndexSearchChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.currentTarget.checked;
    updateShareMutation.mutateAsync({
      shareId: share.id,
      searchIndexing: value,
    });
  };

  return (
    <Popover width={350} position="bottom" withArrow shadow="md">
      <Popover.Target>
        <Button
          variant="default"
          style={{ border: "none" }}
          leftSection={<IconWorld size={20} stroke={1.5} />}
        >
          Share
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        {isDescendantShared ? (
          <Text>
            {t("This page was shared via")} {share.sharedPage.title}
          </Text>
        ) : (
          <>
            <Group justify="space-between" wrap="nowrap" gap="xl">
              <div>
                <Text>Share page</Text>
                <Text size="xs" c="dimmed">
                  Make it public to the internet
                </Text>
              </div>
              <Switch
                onChange={handleChange}
                defaultChecked={isPagePublic}
                size="sm"
              />
            </Group>

            {pageIsShared && (
              <>
                <Group my="sm" grow>
                  <TextInput
                    variant="filled"
                    value={publicLink}
                    readOnly
                    rightSection={<CopyTextButton text={publicLink} />}
                  />
                </Group>

                <Group justify="space-between" wrap="nowrap" gap="xl">
                  <div>
                    <Text>{t("Include sub pages")}</Text>
                    <Text size="xs" c="dimmed">
                      Include children of this page
                    </Text>
                  </div>
                  <Switch
                    onChange={handleSubPagesChange}
                    checked={share.includeSubPages}
                    size="xs"
                  />
                </Group>

                <Group justify="space-between" wrap="nowrap" gap="xl" mt="sm">
                  <div>
                    <Text>{t("Enable search indexing")}</Text>
                    <Text size="xs" c="dimmed">
                      Allow search engine indexing
                    </Text>
                  </div>
                  <Switch
                    onChange={handleIndexSearchChange}
                    checked={share.searchIndexing}
                    size="xs"
                  />
                </Group>
              </>
            )}
          </>
        )}
      </Popover.Dropdown>
    </Popover>
  );
}
