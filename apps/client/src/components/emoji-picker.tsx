import React, { ReactNode } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { ActionIcon, Popover } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

export interface EmojiPickerInterface {
  onEmojiSelect: (emoji: any) => void;
  icon: ReactNode;
}

function EmojiPicker({ onEmojiSelect, icon }: EmojiPickerInterface) {
  const [opened, handlers] = useDisclosure(false);

  const handleEmojiSelect = (emoji) => {
    onEmojiSelect(emoji);
    handlers.close();
  };

  return (
    <Popover
      opened={opened}
      onClose={handlers.close}
      width={200}
      position="bottom"
    >
      <Popover.Target>
        <ActionIcon color="gray" variant="transparent" onClick={handlers.toggle}>
          {icon}
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown bg="000" style={{ border: "none" }}>
        <Picker data={data} onEmojiSelect={handleEmojiSelect} />
      </Popover.Dropdown>
    </Popover>
  );
}

export default EmojiPicker;
