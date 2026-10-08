import { Alert, Anchor, Group, Text } from "@mantine/core";
import { IconExternalLink, IconWorld } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { ISpace } from "@/features/space/types/space.types.ts";
import { buildPublicSpaceUrl } from "@/features/page/page.utils.ts";
import { isBetaPublicSpaces } from "@/lib/config.ts";

type SpacePublicNoticeProps = {
  space: ISpace;
};

export default function SpacePublicNotice({ space }: SpacePublicNoticeProps) {
  const { t } = useTranslation();

  if (!isBetaPublicSpaces() || !space?.isPublished) {
    return null;
  }

  return (
    <Alert
      variant="light"
      color="blue"
      icon={<IconWorld size={18} />}
      title={t("This space is public")}
      mb="lg"
    >
      <Group justify="space-between" gap="xs">
        <Text size="sm">
          {t(
            "Anyone on the internet can read the pages in this space, except restricted pages.",
          )}
        </Text>
        <Anchor
          size="sm"
          fw={500}
          href={buildPublicSpaceUrl({ spaceSlug: space.slug })}
          target="_blank"
          rel="noopener"
          style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
        >
          {t("Open public site")}
          <IconExternalLink size={14} />
        </Anchor>
      </Group>
    </Alert>
  );
}
