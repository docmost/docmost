import classes from "@/features/editor/styles/editor.module.css";
import {
  ActionIcon,
  Divider,
  Group,
  Popover,
  Stack,
  Text,
  Tooltip,
  UnstyledButton,
} from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import clsx from "clsx";
import { useTranslation } from "react-i18next";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { PageVerificationBadge } from "@/ee/page-verification";
import { IContributor } from "@/features/page/types/page.types.ts";
import { useAsideTriggerProps } from "@/hooks/use-toggle-aside.tsx";

export type PageUser = {
  id: string;
  name: string;
  avatarUrl: string;
};

type PageBylineProps = {
  creator?: PageUser;
  contributors?: IContributor[];
  readOnly?: boolean;
};

export function PageByline({
  creator,
  contributors,
  readOnly,
}: PageBylineProps) {
  const { t } = useTranslation();
  const detailsTriggerProps = useAsideTriggerProps("details");

  const otherContributors = (contributors ?? []).filter(
    (c) => c.id !== creator?.id,
  );

  return (
    <Group
      gap="sm"
      mb="md"
      className={clsx("print-hide", classes.byline)}
      style={{ marginTop: "-0.5em" }}
    >
      {creator && (
        <Popover position="bottom-start" shadow="md" width={280} withArrow>
          <Popover.Target>
            <UnstyledButton
              aria-label={t("Created by {{name}}", { name: creator.name })}
            >
              <Group gap={6}>
                <CustomAvatar
                  avatarUrl={creator.avatarUrl}
                  name={creator.name}
                  size={22}
                />
                <Text size="sm" c="dimmed">
                  {t("By {{name}}", { name: creator.name })}
                </Text>
              </Group>
            </UnstyledButton>
          </Popover.Target>
          <Popover.Dropdown>
            <Stack gap="xs">
              <Group gap="sm">
                <CustomAvatar
                  avatarUrl={creator.avatarUrl}
                  name={creator.name}
                  size={36}
                />
                <div>
                  <Text size="sm" fw={500}>
                    {creator.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {otherContributors.length === 0
                      ? t("Owner, no contributors")
                      : t("Owner")}
                  </Text>
                </div>
              </Group>

              {otherContributors.length > 0 && (
                <>
                  <Divider />
                  <Text size="xs" fw={500} c="dimmed" tt="uppercase">
                    {t("Contributors")}
                  </Text>
                  <Stack gap={6}>
                    {otherContributors.map((contributor) => (
                      <Group gap="sm" key={contributor.id}>
                        <CustomAvatar
                          avatarUrl={contributor.avatarUrl}
                          name={contributor.name}
                          size={28}
                        />
                        <Text size="sm">{contributor.name}</Text>
                      </Group>
                    ))}
                  </Stack>
                </>
              )}
            </Stack>
          </Popover.Dropdown>
        </Popover>
      )}
      <Tooltip label={t("Details")} withArrow openDelay={250}>
        <ActionIcon
          variant="subtle"
          color="gray"
          aria-label={t("Details")}
          {...detailsTriggerProps}
        >
          <IconInfoCircle size={20} stroke={1.5} />
        </ActionIcon>
      </Tooltip>

      <PageVerificationBadge readOnly={readOnly} />
    </Group>
  );
}
