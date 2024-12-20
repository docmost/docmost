import React, { ReactNode } from 'react';
import {
  ActionIcon,
  Popover,
  Button,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Suspense } from 'react';
import { nodeIdAtom } from '@/features/page/tree/atoms/node-id-atom.ts';
import { useAtom } from "jotai";
const Picker = React.lazy(() => import('@emoji-mart/react'));

export interface EmojiPickerInterface {
  onEmojiSelect: (emoji: any) => void;
  icon: ReactNode;
  removeEmojiAction: () => void;
  readOnly: boolean;
  nodeId:string;
}

function EmojiPicker({
  onEmojiSelect,
  icon,
  removeEmojiAction,
  readOnly,
  nodeId,
}: EmojiPickerInterface) {
  const [opened, handlers] = useDisclosure(false);
  const { colorScheme } = useMantineColorScheme();
  const [nodeIdValueAtom,setNodeIdValueAtom]=useAtom(nodeIdAtom)

  const handleEmojiSelect = (emoji) => {
    onEmojiSelect(emoji);
    setNodeIdValueAtom(null);
  };

  const handleRemoveEmoji = () => {
    removeEmojiAction();
    setNodeIdValueAtom(null);
  };

  return (
    <Popover
      opened={nodeIdValueAtom===nodeId}
      onClose={handlers.close}
      width={332}
      position="bottom"
      disabled={readOnly}
    >
      <Popover.Target>
        <ActionIcon c="gray" variant="transparent" onClick={()=>setNodeIdValueAtom((prev:string|null)=>prev===nodeId?null:nodeId)}>
          {icon}
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown bg="000" style={{ border: 'none' }}>
        <Suspense fallback={null}>
          <Picker
            data={async () => (await import('@emoji-mart/data')).default}
            onEmojiSelect={handleEmojiSelect}
            perLine={8}
            skinTonePosition="search"
            theme={colorScheme}
          />
        </Suspense>
        <Button
          variant="default"
          c="gray"
          size="xs"
          style={{
            position: 'absolute',
            zIndex: 2,
            bottom: '1rem',
            right: '1rem',
          }}
          onClick={handleRemoveEmoji}
        >
          Remove
        </Button>
      </Popover.Dropdown>
    </Popover>
  );
}

export default EmojiPicker;
