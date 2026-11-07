import { useEffect, useMemo, useState } from "react";
import {
  ActionIcon,
  Anchor,
  Button,
  Group,
  Stack,
  Switch,
  Text,
  TextInput,
} from "@mantine/core";
import { IconExternalLink, IconLock } from "@tabler/icons-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getPageIcon } from "@/lib";
import CopyTextButton from "@/components/common/copy";
import { getAppUrl, isCloud } from "@/lib/config";
import { buildPageUrl } from "@/features/page/page.utils";
import {
  useCreateShareMutation,
  useDeleteShareMutation,
  useShareForPageQuery,
  useUpdateShareMutation,
} from "@/features/share/queries/share-query";
import useTrial from "@/ee/hooks/use-trial";

type PublishTabProps = {
  pageId: string;
  readOnly?: boolean;
  isRestricted?: boolean;
  workspaceSharingDisabled?: boolean;
  spaceSharingDisabled?: boolean;
};

export function PublishTab({ pageId, readOnly, isRestricted, workspaceSharingDisabled, spaceSharingDisabled }: PublishTabProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pageSlug, spaceSlug } = useParams();
  const { isTrial } = useTrial();

  const { data: share } = useShareForPageQuery(pageId);
  const createShareMutation = useCreateShareMutation();
  const updateShareMutation = useUpdateShareMutation();
  const deleteShareMutation = useDeleteShareMutation();

  const pageIsShared = share && share.level === 0;
  const isDescendantShared = share && share.level > 0;

  const publicLink = `${getAppUrl()}/share/${share?.key}/p/${pageSlug}`;

  const [isPagePublic, setIsPagePublic] = useState<boolean>(false);

  useEffect(() => {
    setIsPagePublic(!!share);
  }, [share, pageId]);

  const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.currentTarget.checked;

    if (value) {
      createShareMutation.mutateAsync({
        pageId: pageId,
        includeSubPages: true,
        searchIndexing: false,
      });
      setIsPagePublic(value);
    } else {
      if (share && share.id) {
        deleteShareMutation.mutateAsync(share.id);
        setIsPagePublic(value);
      }
    }
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

  const shareLink = useMemo(
    () => (
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
    ),
    [publicLink],
  );

  if (isCloud() && isTrial) {
    return (
      <Stack align="center" py="md">
        <IconLock size={20} stroke={1.5} />
        <Text size="sm" ta="center" fw={500}>
          {t("Upgrade to share pages")}
        </Text>
        <Text size="sm" c="dimmed" ta="center">
          {t(
            "Page sharing is available on paid plans. Upgrade to share your pages publicly.",
          )}
        </Text>
        <Button size="xs" onClick={() => navigate("/settings/billing")}>
          {t("Upgrade Plan")}
        </Button>
      </Stack>
    );
  }

  if (workspaceSharingDisabled || spaceSharingDisabled) {
    return (
      <Stack align="center" py="md">
        <IconLock size={20} stroke={1.5} />
        <Text size="sm" ta="center" fw={500}>
          {t("Public sharing is disabled")}
        </Text>
        <Text size="sm" c="dimmed" ta="center">
          {workspaceSharingDisabled
            ? t("Public sharing has been disabled at the workspace level.")
            : t("Public sharing has been disabled for this space.")}
        </Text>
      </Stack>
    );
  }

  if (isRestricted) {
    return (
      <Stack align="center" py="md">
        <IconLock size={20} stroke={1.5} />
        <Text size="sm" ta="center" fw={500}>
          {t("Restricted page")}
        </Text>
        <Text size="sm" c="dimmed" ta="center">
          {t("Restricted pages cannot be shared publicly.")}
        </Text>
      </Stack>
    );
  }

  if (isDescendantShared) {
    return (
      <Stack gap="sm">
        <Text size="sm">{t("Inherits public sharing from")}</Text>
        <Anchor
          size="sm"
          underline="never"
          style={{
            cursor: "pointer",
            color: "var(--mantine-color-text)",
          }}
          component={Link}
          to={buildPageUrl(
            spaceSlug,
            share.sharedPage.slugId,
            share.sharedPage.title,
          )}
        >
          <Group gap="4" wrap="nowrap">
            {getPageIcon(share.sharedPage.icon)}
            <Text fz="sm" fw={500} lineClamp={1}>
              {share.sharedPage.title || t("untitled")}
            </Text>
          </Group>
        </Anchor>
        {shareLink}
      </Stack>
    );
  }

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap" gap="xl">
        <div>
          <Text size="sm">
            {isPagePublic ? t("Shared to web") : t("Share to web")}
          </Text>
          <Text size="xs" c="dimmed">
            {isPagePublic
              ? t("Anyone with the link can view this page")
              : t("Make this page publicly accessible")}
          </Text>
        </div>
        <Switch
          onChange={handleChange}
          checked={isPagePublic}
          disabled={readOnly}
          size="xs"
        />
      </Group>

      {pageIsShared && (
        <>
          {shareLink}
          <Group justify="space-between" wrap="nowrap" gap="xl">
            <div>
              <Text size="sm">{t("Include sub-pages")}</Text>
              <Text size="xs" c="dimmed">
                {t("Make sub-pages public too")}
              </Text>
            </div>
            <Switch
              onChange={handleSubPagesChange}
              checked={share.includeSubPages}
              size="xs"
              disabled={readOnly}
            />
          </Group>
          <Group justify="space-between" wrap="nowrap" gap="xl">
            <div>
              <Text size="sm">{t("Search engine indexing")}</Text>
              <Text size="xs" c="dimmed">
                {t("Allow search engines to index page")}
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
    </Stack>
  );
}
