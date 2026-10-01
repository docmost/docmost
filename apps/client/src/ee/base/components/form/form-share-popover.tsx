import {
  ActionIcon,
  Alert,
  Anchor,
  Button,
  Group,
  Loader,
  Popover,
  Radio,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from "@mantine/core";
import {
  IconExternalLink,
  IconInfoCircle,
  IconLock,
  IconUsers,
  IconWorld,
} from "@tabler/icons-react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import CopyTextButton from "@/components/common/copy";
import { getAppUrl, isCloud } from "@/lib/config";
import useTrial from "@/ee/hooks/use-trial";
import APP_ROUTE from "@/lib/app-route";
import { FormAccess, IBaseView } from "@/ee/base/types/base.types";
import {
  useFormShareQuery,
  useUpdateFormShareMutation,
} from "@/ee/base/queries/base-form-query";
import classes from "@/ee/base/styles/form.module.css";

type FormSharePopoverProps = {
  pageId: string;
  view: IBaseView;
};

export function FormSharePopover({ pageId, view }: FormSharePopoverProps) {
  const { t } = useTranslation();
  const { isTrial } = useTrial();
  const { data: share, isLoading } = useFormShareQuery(pageId, view.id);
  const updateShare = useUpdateFormShareMutation(view.id);

  const access: FormAccess =
    (updateShare.isPending ? updateShare.variables?.access : undefined) ??
    share?.access ??
    "none";
  const publicBlockedByPlan = isCloud() && isTrial;
  const publicBlockedByAdmin = share ? !share.publicSharingAllowed : false;
  const link = share?.key ? `${getAppUrl()}/forms/${share.key}` : null;

  const handleAccessChange = (value: string) => {
    const next = value as FormAccess;
    if (next === access) return;
    updateShare.mutate({ pageId, viewId: view.id, access: next });
  };

  return (
    <Popover width={360} position="bottom-end" shadow="md" withinPortal>
      <Popover.Target>
        <Button size="compact-sm" fw={500}>
          {t("Share form")}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="sm">
          <div>
            <Text size="sm" fw={600}>
              {t("Share form")}
            </Text>
            <Text size="xs" c="dimmed">
              {t("Choose who can submit responses to this form.")}
            </Text>
          </div>

          {isLoading ? (
            <Group justify="center" py="md">
              <Loader size="sm" />
            </Group>
          ) : (
            <Radio.Group value={access} onChange={handleAccessChange}>
              <Stack gap={6}>
                <AccessOption
                  value="none"
                  icon={<IconLock size={16} />}
                  title={t("Closed")}
                  description={t("Nobody can submit responses.")}
                />
                <AccessOption
                  value="workspace"
                  icon={<IconUsers size={16} />}
                  title={t("Workspace members")}
                  description={t(
                    "Members sign in to respond. Their name is recorded with each response.",
                  )}
                />
                <AccessOption
                  value="public"
                  icon={<IconWorld size={16} />}
                  title={t("Anyone with the link")}
                  description={t("Anyone can respond. Responses are anonymous.")}
                  disabled={
                    access !== "public" &&
                    (publicBlockedByPlan || publicBlockedByAdmin)
                  }
                />
              </Stack>
            </Radio.Group>
          )}

          {publicBlockedByPlan && access !== "public" && (
            <Text size="xs" c="dimmed">
              {t("Public forms are available on paid plans.")}{" "}
              <Anchor
                component={Link}
                to={APP_ROUTE.SETTINGS.WORKSPACE.BILLING}
                size="xs"
              >
                {t("Upgrade plan")}
              </Anchor>
            </Text>
          )}

          {publicBlockedByAdmin && (
            <Alert
              variant="light"
              color={access === "public" ? "orange" : "gray"}
              icon={<IconInfoCircle size={16} />}
              p="xs"
            >
              <Text size="xs">
                {access === "public"
                  ? t(
                      "Public sharing is disabled for this workspace or space, so this form isn't accepting responses.",
                    )
                  : t(
                      "Public sharing is disabled for this workspace or space.",
                    )}
              </Text>
            </Alert>
          )}

          {link && access !== "none" && (
            <Group gap={4} wrap="nowrap">
              <TextInput
                variant="filled"
                value={link}
                readOnly
                aria-label={t("Form link")}
                rightSection={<CopyTextButton text={link} />}
                style={{ flex: 1 }}
              />
              <Tooltip label={t("Open form")} withArrow>
                <ActionIcon
                  component="a"
                  href={link}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="default"
                  size="lg"
                  aria-label={t("Open form")}
                >
                  <IconExternalLink size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

type AccessOptionProps = {
  value: FormAccess;
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
};

function AccessOption({
  value,
  icon,
  title,
  description,
  disabled,
}: AccessOptionProps) {
  return (
    <Radio.Card
      value={value}
      radius="md"
      className={classes.accessCard}
      disabled={disabled}
    >
      <Group wrap="nowrap" align="flex-start" gap="sm">
        <Radio.Indicator size="xs" mt={2} disabled={disabled} />
        <Stack gap={2} style={{ flex: 1 }}>
          <Group gap={6} wrap="nowrap">
            {icon}
            <Text size="sm" fw={500}>
              {title}
            </Text>
          </Group>
          <Text size="xs" c="dimmed">
            {description}
          </Text>
        </Stack>
      </Group>
    </Radio.Card>
  );
}
