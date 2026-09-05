import { ActionIcon, Group, Text, Switch, TextInput } from "@mantine/core";
import { modals } from "@mantine/modals";
import { useAtom } from "jotai";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconExternalLink, IconWorld } from "@tabler/icons-react";
import { workspaceAtom } from "@/features/user/atoms/current-user-atom.ts";
import { ISpace } from "@/features/space/types/space.types.ts";
import { IPublicSpace } from "@/features/public-space/types/public-space.types.ts";
import {
  usePublicSpaceForSpaceQuery,
  usePublishSpaceMutation,
} from "@/features/public-space/queries/public-space-query.ts";
import { getAppUrl } from "@/lib/config.ts";
import CopyTextButton from "@/components/common/copy.tsx";
import AppearanceSettings from "@/features/public-space/components/appearance-settings.tsx";
import { isPublicSpacesAllowed } from "@/features/public-space/utils/public-space-access.ts";

type PublishSpaceSettingsProps = {
  space: ISpace;
};

export default function PublishSpaceSettings({
  space,
}: PublishSpaceSettingsProps) {
  const { t } = useTranslation();
  const [workspace] = useAtom(workspaceAtom);

  const allowPublicSpaces = isPublicSpacesAllowed(workspace);

  const { data: publicSpace } = usePublicSpaceForSpaceQuery(
    allowPublicSpaces ? space?.id : undefined,
  );
  const publishMutation = usePublishSpaceMutation();

  const [published, setPublished] = useState(false);
  const [searchIndexing, setSearchIndexing] = useState(false);
  const [bylineAuthor, setBylineAuthor] = useState(false);
  const [bylineUpdatedAt, setBylineUpdatedAt] = useState(true);
  const [directoryListed, setDirectoryListed] = useState(false);

  const workspaceDirectoryEnabled =
    workspace?.settings?.publicSpaces?.directory === true;

  const syncFromPublicSpace = (state?: IPublicSpace | null) => {
    const byline = state?.settings?.byline;
    setPublished(state?.enabled === true);
    setSearchIndexing(state?.searchIndexing === true);
    setBylineAuthor(byline?.author === true);
    setBylineUpdatedAt(byline?.updatedAt !== false);
    setDirectoryListed(state?.settings?.directory === true);
  };

  useEffect(() => {
    syncFromPublicSpace(publicSpace);
  }, [publicSpace]);

  if (!allowPublicSpaces || !space) {
    return null;
  }

  const publicUrl = `${getAppUrl()}/docs/${space.slug}`;

  const applyPublish = async (enabled: boolean) => {
    try {
      const result = await publishMutation.mutateAsync({
        spaceId: space.id,
        enabled,
      });
      syncFromPublicSpace(result);
    } catch {
      // error handled by mutation
    }
  };

  const handlePublishChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;
    if (!value) {
      applyPublish(false);
      return;
    }

    modals.openConfirmModal({
      title: t("Publish space to the web"),
      children: (
        <Text size="sm">
          {t(
            "Anyone on the internet will be able to read every page in this space, except restricted pages. Are you sure?",
          )}
        </Text>
      ),
      centered: true,
      labels: { confirm: t("Publish"), cancel: t("Cancel") },
      onConfirm: () => applyPublish(true),
    });
  };

  const handleIndexingChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.currentTarget.checked;
    try {
      await publishMutation.mutateAsync({
        spaceId: space.id,
        enabled: true,
        searchIndexing: value,
      });
      setSearchIndexing(value);
    } catch {
      // error handled by mutation
    }
  };

  const handleBylineAuthorChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.currentTarget.checked;
    try {
      await publishMutation.mutateAsync({
        spaceId: space.id,
        enabled: true,
        bylineAuthor: value,
      });
      setBylineAuthor(value);
    } catch {
      // error handled by mutation
    }
  };

  const handleBylineUpdatedAtChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.currentTarget.checked;
    try {
      await publishMutation.mutateAsync({
        spaceId: space.id,
        enabled: true,
        bylineUpdatedAt: value,
      });
      setBylineUpdatedAt(value);
    } catch {
      // error handled by mutation
    }
  };

  const handleDirectoryChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.currentTarget.checked;
    try {
      await publishMutation.mutateAsync({
        spaceId: space.id,
        enabled: true,
        directory: value,
      });
      setDirectoryListed(value);
    } catch {
      // error handled by mutation
    }
  };

  return (
    <div>
      <Group justify="space-between" wrap="nowrap" gap="xl" mt="md">
        <div>
          <Text size="md">{t("Publish space to the web")}</Text>
          <Text size="sm" c="dimmed">
            {t("Make this space publicly readable by anyone on the internet.")}
          </Text>
        </div>
        <Switch
          checked={published}
          onChange={handlePublishChange}
          size={"xs"}
          aria-label={t("Toggle publish space to the web")}
        />
      </Group>

      {published && (
        <>
          <Group justify="space-between" wrap="nowrap" gap="xl" mt="md">
            <div>
              <Text size="md">{t("Allow search engines to index")}</Text>
              <Text size="sm" c="dimmed">
                {t(
                  "Let public pages in this space appear in search engine results.",
                )}
              </Text>
            </div>
            <Switch
              checked={searchIndexing}
              onChange={handleIndexingChange}
              size={"xs"}
              aria-label={t("Toggle search engine indexing")}
            />
          </Group>

          <Group justify="space-between" wrap="nowrap" gap="xl" mt="md">
            <div>
              <Text size="md">{t("Show page author")}</Text>
              <Text size="sm" c="dimmed">
                {t("Display the page creator's name on public pages.")}
              </Text>
            </div>
            <Switch
              checked={bylineAuthor}
              onChange={handleBylineAuthorChange}
              size={"xs"}
              aria-label={t("Toggle show page author")}
            />
          </Group>

          <Group justify="space-between" wrap="nowrap" gap="xl" mt="md">
            <div>
              <Text size="md">{t("Show last updated")}</Text>
              <Text size="sm" c="dimmed">
                {t("Display when each page was last updated.")}
              </Text>
            </div>
            <Switch
              checked={bylineUpdatedAt}
              onChange={handleBylineUpdatedAtChange}
              size={"xs"}
              aria-label={t("Toggle show last updated")}
            />
          </Group>

          {workspaceDirectoryEnabled && (
            <Group justify="space-between" wrap="nowrap" gap="xl" mt="md">
              <div>
                <Text size="md">{t("Show in public directory")}</Text>
                <Text size="sm" c="dimmed">
                  {t("List this space in the public directory at /docs.")}
                </Text>
              </div>
              <Switch
                checked={directoryListed}
                onChange={handleDirectoryChange}
                size={"xs"}
                aria-label={t("Toggle show in public directory")}
              />
            </Group>
          )}

          <Group mt="md" gap={4} wrap="nowrap">
            <TextInput
              value={publicUrl}
              readOnly
              style={{ width: "100%" }}
              leftSection={<IconWorld size={16} />}
              aria-label={t("Public space link")}
              rightSection={
                <CopyTextButton
                  text={publicUrl}
                  label={t("Copy public space link")}
                />
              }
            />
            <ActionIcon
              component="a"
              variant="default"
              size="input-sm"
              target="_blank"
              href={publicUrl}
              aria-label={t("Open public space link")}
            >
              <IconExternalLink size={16} />
            </ActionIcon>
          </Group>

          <Text size="sm" c="dimmed" mt="xs">
            {t("Renaming the space slug will break public links.")}
          </Text>

          <AppearanceSettings
            spaceId={space.id}
            appearance={publicSpace?.settings?.appearance}
          />
        </>
      )}
    </div>
  );
}
