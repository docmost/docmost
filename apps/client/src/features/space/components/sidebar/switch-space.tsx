import classes from "./switch-space.module.css";
import { useNavigate } from "react-router-dom";
import { SpaceSelect } from "./space-select";
import { getSpaceUrl } from "@/lib/config";
import { Button, Popover, Text } from "@mantine/core";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { useDisclosure } from "@mantine/hooks";
import { CustomAvatar } from "@/components/ui/custom-avatar.tsx";
import { AvatarIconType } from "@/features/attachments/types/attachment.types.ts";
import React from "react";

interface SwitchSpaceProps {
  spaceName: string;
  spaceSlug: string;
  spaceIcon?: string;
}

export function SwitchSpace({
  spaceName,
  spaceSlug,
  spaceIcon,
}: SwitchSpaceProps) {
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
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <SpaceSelect
          label={spaceName}
          value={spaceSlug}
          onChange={(space) => handleSelect(space.slug)}
          width={300}
          opened={true}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
