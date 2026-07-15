import { useState, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ActionIcon, Menu, Tooltip, UnstyledButton } from "@mantine/core";
import { IconPlus, IconTemplate } from "@tabler/icons-react";
import { ErrorBoundary } from "react-error-boundary";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import TemplatePickerModal from "@/ee/template/components/template-picker-modal";

type CreatePageMenuProps = {
  spaceId: string;
  onCreateBlank: () => void;
  trigger: "menuItem" | "actionIcon";
  className?: string;
  innerClassName?: string;
  iconClassName?: string;
};

export default function CreatePageMenu({
  spaceId,
  onCreateBlank,
  trigger,
  className,
  innerClassName,
  iconClassName,
}: CreatePageMenuProps) {
  const { t } = useTranslation();
  const hasTemplates = useHasFeature(Feature.TEMPLATES);
  const [templatePickerOpened, setTemplatePickerOpened] = useState(false);

  const buildTrigger = (onClick: (() => void) | undefined): ReactNode => {
    if (trigger === "actionIcon") {
      return (
        <Tooltip label={t("Create page")} withArrow position="right">
          <ActionIcon
            variant="default"
            size={18}
            onClick={onClick}
            aria-label={t("Create page")}
          >
            <IconPlus />
          </ActionIcon>
        </Tooltip>
      );
    }

    return (
      <UnstyledButton className={className} onClick={onClick}>
        <div className={innerClassName}>
          <IconPlus size={18} className={iconClassName} stroke={2} />
          <span>{t("New page")}</span>
        </div>
      </UnstyledButton>
    );
  };

  if (!hasTemplates) {
    return buildTrigger(onCreateBlank);
  }

  return (
    <>
      <Menu
        width={220}
        shadow="md"
        withArrow
        position={trigger === "actionIcon" ? "bottom-end" : "right-start"}
      >
        <Menu.Target>{buildTrigger(undefined)}</Menu.Target>

        <Menu.Dropdown>
          <Menu.Item
            leftSection={<IconPlus size={16} />}
            onClick={onCreateBlank}
          >
            {t("Add Blank Page")}
          </Menu.Item>
          <Menu.Item
            leftSection={<IconTemplate size={16} />}
            onClick={() => setTemplatePickerOpened(true)}
          >
            {t("Use Template")}
          </Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {templatePickerOpened && (
        <ErrorBoundary fallbackRender={() => null}>
          <TemplatePickerModal
            opened={templatePickerOpened}
            onClose={() => setTemplatePickerOpened(false)}
            initialSpaceId={spaceId}
          />
        </ErrorBoundary>
      )}
    </>
  );
}
