import classes from './switch-space.module.css';
import { useNavigate } from 'react-router-dom';
import { SpaceSelect } from './space-select';
import { getSpaceUrl } from '@/lib/config';
import { Avatar, Button, Popover, Text } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';

interface SwitchSpaceProps {
  spaceName: string;
  spaceSlug: string;
}

export function SwitchSpace({ spaceName, spaceSlug }: SwitchSpaceProps) {
  const navigate = useNavigate();

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
    >
      <Popover.Target>
        <Button
          variant="subtle"
          fullWidth
          justify="space-between"
          rightSection={<IconChevronDown size={18} />}
          color="gray"
        >
          <Avatar
            size={20}
            color="initials"
            variant="filled"
            name={spaceName}
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
          onChange={handleSelect}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
