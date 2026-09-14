import classes from "./switch-space.module.css";
import { useNavigate } from "react-router-dom";
import { SpaceSelect } from "./space-select";
import { getSpaceUrl } from "@/lib/config";
import { Button, Popover, Text, Tooltip } from "@mantine/core";
import {
  IconChevronDown,
  IconChevronUp,
  IconWorld,
} from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import React from "react";
import { useTranslation } from "react-i18next";

interface SwitchSpaceProps {
  spaceName: string;
  spaceSlug: string;
  spaceIcon?: string;
  isPublished?: boolean;
}

export function SwitchSpace({
  spaceName,
  spaceSlug,
  spaceIcon,
  isPublished,
}: SwitchSpaceProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [opened, { close, toggle }] = useDisclosure(false);

  const handleSelect = (value: string) => {
    if (value) {
      navigate(getSpaceUrl(value));
      close();
    }
  };

  return (
    <Popover
      width={300}
      position="bottom"
      withArrow
      shadow="md"
      opened={opened}
      onChange={toggle}
      trapFocus
      returnFocus
    >
      <Popover.Target>
        <Button
          variant="subtle"
          fullWidth
          justify="space-between"
          rightSection={opened ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
          color="gray"
          onClick={toggle}
        >
          <CustomAvatar
            name={spaceName}
            avatarUrl={spaceIcon}
            type={AvatarIconType.SPACE_ICON}
            color="initials"
            variant="filled"
            size={20}
          />
          <Text className={classes.spaceName} size="md" fw={500} lineClamp={1}>
            {spaceName}
          </Text>

          {isPublished && (
            <Tooltip label={t("This space is public")}>
              <IconWorld
                size={14}
                aria-label={t("This space is public")}
                style={{ flexShrink: 0 }}
              />
            </Tooltip>
          )}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <SpaceSelect
          label={spaceName}
          value={spaceSlug}
          onChange={(space) => handleSelect(space.slug)}
          width={300}
          opened={true}
          withinPortal={false}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
