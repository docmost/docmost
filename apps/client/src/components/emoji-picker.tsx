import React, { ReactNode } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { ActionIcon, Popover, Button, useMantineColorScheme } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

export interface EmojiPickerInterface {
  onEmojiSelect: (emoji: any) => void;
  icon: ReactNode;
  removeEmojiAction: () => void;
}

function EmojiPicker({ onEmojiSelect, icon, removeEmojiAction }: EmojiPickerInterface) {
  const [opened, handlers] = useDisclosure(false);
  const { colorScheme } = useMantineColorScheme();

  const handleEmojiSelect = (emoji) => {
    onEmojiSelect(emoji);
    handlers.close();
  };

  const handleRemoveEmoji = () => {
    removeEmojiAction();
    handlers.close();
  };

  return (
    <Popover
      opened={opened}
      onClose={handlers.close}
      width={332}
      position="bottom"
    >
      <Popover.Target>
        <ActionIcon color="gray" variant="transparent" onClick={handlers.toggle}>
          {icon}
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown bg="000" style={{ border: "none" }}>
        <Picker data={data} onEmojiSelect={handleEmojiSelect}
                perLine={8}
                skinTonePosition='search'
                theme={colorScheme}
        />
        <Button variant="default" color="gray"
                size="xs"
                style={{ position: 'absolute', zIndex: 2, bottom: '1rem', right: '1rem'}}
                onClick={handleRemoveEmoji}>
          Remove
        </Button>

      </Popover.Dropdown>
    </Popover>
  );
}

export default EmojiPicker;
