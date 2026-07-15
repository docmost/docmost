import { useState, ReactNode, MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { ActionIcon, ActionIconProps, Menu, UnstyledButton } from "@mantine/core";
import { IconPlus, IconTemplate } from "@tabler/icons-react";
import { ErrorBoundary } from "react-error-boundary";
import { useHasFeature } from "@/ee/hooks/use-feature";
import { Feature } from "@/ee/features";
import TemplatePickerModal from "@/ee/template/components/template-picker-modal";

type CreatePageMenuProps = {
  spaceId: string;
  /** When set, pages created from this menu (blank or from template) are
   * created as a child of this page instead of at the space root. */
  parentPageId?: string;
  onCreateBlank: () => void;
  trigger: "menuItem" | "actionIcon";
  // menuItem-trigger styling (matches the sidebar's "New page" row)
  className?: string;
  innerClassName?: string;
  iconClassName?: string;
  // actionIcon-trigger overrides (defaults match the sidebar's root "+" button)
  actionIconProps?: Partial<ActionIconProps> & {
    "aria-label"?: string;
    tabIndex?: number;
  };
  actionIconGlyphSize?: number;
};

export default function CreatePageMenu({
  spaceId,
  parentPageId,
  onCreateBlank,
  trigger,
  className,
  innerClassName,
  iconClassName,
  actionIconProps,
  actionIconGlyphSize = 18,
}: CreatePageMenuProps) {
  const { t } = useTranslation();
  const hasTemplates = useHasFeature(Feature.TEMPLATES);
  const [templatePickerOpened, setTemplatePickerOpened] = useState(false);

  const buildTrigger = (onClick: (() => void) | undefined): ReactNode => {
    if (trigger === "actionIcon") {
      return (
        <ActionIcon
          variant="default"
          size={18}
          aria-label={t("Create page")}
          title={t("Create page")}
          {...actionIconProps}
          onClick={onClick}
        >
          <IconPlus size={actionIconGlyphSize} />
        </ActionIcon>
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

  // Capture-phase guard: when this trigger sits inside a navigable element
  // (e.g. the page-tree row is a <Link>), preventDefault must run before the
  // ancestor's own click handler checks `event.defaultPrevented` — a
  // bubble-phase stopPropagation on the trigger itself runs too late for
  // React Router's Link, which only skips navigation if defaultPrevented was
  // already set by the time its handler fires.
  const handleCaptureClick = (e: MouseEvent) => {
    if (trigger === "actionIcon") {
      e.preventDefault();
    }
  };

  const content = (() => {
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
              initialParentPageId={parentPageId}
            />
          </ErrorBoundary>
        )}
      </>
    );
  })();

  if (trigger !== "actionIcon") {
    return content;
  }

  return (
    <span onClickCapture={handleCaptureClick} style={{ display: "contents" }}>
      {content}
    </span>
  );
}
