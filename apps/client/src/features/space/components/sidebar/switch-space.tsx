import classes from './switch-space.module.css';
import { useNavigate } from 'react-router-dom';
import { SpaceSelect } from './space-select';
import { getSpaceUrl } from '@/lib/config';
import { Avatar, Button, Popover, Text } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';
import { useDisclosure } from '@mantine/hooks';
import { useAtom } from 'jotai';
import { userAtom } from '@/features/user/atoms/current-user-atom';

interface SwitchSpaceProps {
  spaceName: string;
  spaceSlug: string;
}

export function SwitchSpace({ spaceName, spaceSlug }: SwitchSpaceProps) {
  const navigate = useNavigate();
  const [opened, { close, open, toggle }] = useDisclosure(false);
  const [user,] = useAtom(userAtom);

  const handleSelect = (value: string) => {
    if (value) {
      navigate(getSpaceUrl(value));
      close();
    }
  };
  
  const disabled = !user || !!user.isAnonymous

  return (
    <Popover
      width={300}
      position="bottom"
      withArrow
      shadow="md"
      opened={opened}
      onChange={toggle}
      disabled={disabled}
    >
      <Popover.Target>
        <Button
          variant="subtle"
          fullWidth
          justify="space-between"
          rightSection={disabled? undefined : <IconChevronDown size={18} />}
          color="gray"
          onClick={open}
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
