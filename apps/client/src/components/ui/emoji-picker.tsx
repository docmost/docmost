import React, { ReactNode,useRef,useEffect  } from 'react';
import {
  ActionIcon,
  Popover,
  Button,
  useMantineColorScheme,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { Suspense } from 'react';
const Picker = React.lazy(() => import('@emoji-mart/react'));

export interface EmojiPickerInterface {
  onEmojiSelect: (emoji: any) => void;
  icon: ReactNode;
  removeEmojiAction: () => void;
  readOnly: boolean;
 
}

function EmojiPicker({
  onEmojiSelect,
  icon,
  removeEmojiAction,
  readOnly,
}: EmojiPickerInterface) {
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
  const targetRef = useRef(null); 
  const dropdownRef = useRef(null);
  
  useEffect(() => {
    const closeOpenMenus = (e: any) => {
      if (
        opened &&
        targetRef.current &&
        dropdownRef.current &&
        !targetRef.current.contains(e.target) &&
        !dropdownRef.current.contains(e.target)
      ) {
        handlers.close();
      }
    };

      document.addEventListener('mousedown', closeOpenMenus);
    return () => {
      document.removeEventListener('mousedown', closeOpenMenus);
    };
  }, [opened]);

  return (
    <Popover
    opened={opened}
      onClose={handlers.close}
      width={332}
      position="bottom"
      disabled={readOnly}
    >
      <Popover.Target ref={targetRef}>
        <ActionIcon c="gray" variant="transparent" onClick={handlers.toggle} >
          {icon}
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown bg="000" style={{ border: 'none' }} ref={ref2}>
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
