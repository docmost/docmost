import {
  ActionIcon,
  Alert,
  Group,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { IconExternalLink, IconInfoCircle } from "@tabler/icons-react";
import React, { useEffect, useState } from "react";
import {
  useCreateSpaceShareMutation,
  useDeleteSpaceShareMutation,
  useSpaceShareQuery,
  useUpdateSpaceShareMutation,
} from "@/features/share/queries/share-query.ts";
import { useTranslation } from "react-i18next";
import CopyTextButton from "@/components/common/copy.tsx";
import { getAppUrl } from "@/lib/config.ts";

interface SpaceSharingProps {
  spaceId: string;
  spaceSlug: string;
  readOnly: boolean;
}

export default function SpaceSharing({
  spaceId,
  spaceSlug,
  readOnly,
}: SpaceSharingProps) {
  const { t } = useTranslation();
  const { data: share, isLoading } = useSpaceShareQuery(spaceId);
  const createSpaceShareMutation = useCreateSpaceShareMutation();
  const updateSpaceShareMutation = useUpdateSpaceShareMutation();
  const deleteSpaceShareMutation = useDeleteSpaceShareMutation();

  const [isSpacePublic, setIsSpacePublic] = useState<boolean>(false);

  useEffect(() => {
    if (share) {
      setIsSpacePublic(true);
    } else {
      setIsSpacePublic(false);
    }
  }, [share, spaceId]);

  const publicLink = share
    ? `${getAppUrl()}/share/${share.key}/s/${spaceSlug}`
    : "";

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;

    if (value) {
      await createSpaceShareMutation.mutateAsync({
        spaceId: spaceId,
        searchIndexing: false,
      });
      setIsSpacePublic(true);
    } else {
      if (share?.id) {
        await deleteSpaceShareMutation.mutateAsync(share.id);
        setIsSpacePublic(false);
      }
    }
  };

  const handleIndexSearchChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const value = event.currentTarget.checked;
    if (share?.id) {
      await updateSpaceShareMutation.mutateAsync({
        shareId: share.id,
        searchIndexing: value,
      });
    }
  };

  if (isLoading) {
    return null;
  }

  return (
    <div style={{ padding: "16px 0" }}>
      <Alert
        icon={<IconInfoCircle size={16} />}
        color="blue"
        mb="md"
        styles={{ message: { fontSize: 13 } }}
      >
        {t(
          "When you share a space publicly, all pages within this space will be accessible to anyone with the link.",
        )}
      </Alert>

      <Group justify="space-between" wrap="nowrap" gap="xl">
        <div>
          <Text size="sm">
            {isSpacePublic ? t("Shared to web") : t("Share to web")}
          </Text>
          <Text size="xs" c="dimmed">
            {isSpacePublic
              ? t("Anyone with the link can view all pages in this space")
              : t("Make all pages in this space publicly accessible")}
          </Text>
        </div>
        <Switch
          onChange={handleChange}
          checked={isSpacePublic}
          disabled={readOnly}
          size="xs"
        />
      </Group>

      {isSpacePublic && share && (
        <>
          <Group my="sm" gap={4} wrap="nowrap">
            <TextInput
              variant="filled"
              value={publicLink}
              readOnly
              rightSection={<CopyTextButton text={publicLink} />}
              style={{ width: "100%" }}
            />
            <ActionIcon
              component="a"
              variant="default"
              target="_blank"
              href={publicLink}
              size="sm"
            >
              <IconExternalLink size={16} />
            </ActionIcon>
          </Group>

          <Group justify="space-between" wrap="nowrap" gap="xl" mt="md">
            <div>
              <Text size="sm">{t("Search engine indexing")}</Text>
              <Text size="xs" c="dimmed">
                {t("Allow search engines to index all pages")}
              </Text>
            </div>
            <Switch
              onChange={handleIndexSearchChange}
              checked={share.searchIndexing}
              size="xs"
              disabled={readOnly}
            />
          </Group>
        </>
      )}
    </div>
  );
}
