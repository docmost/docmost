import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  SlashMenuGroupedItemsType,
  SlashMenuItemType,
} from '@/features/editor/components/slash-menu/types';
import {
  Group,
  Paper,
  ScrollArea,
  Text,
  UnstyledButton,
} from '@mantine/core';
import classes from './slash-menu.module.css';
import clsx from 'clsx';

const CommandList = ({
                       items,
                       command,
                       editor,
                       range,
                     }: {
  items: SlashMenuGroupedItemsType;
  command: any;
  editor: any;
  range: any;
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);

  const flatItems = useMemo(() => {
    return Object.values(items).flat();
  }, [items]);

  const selectItem = useCallback(
    (index: number) => {
      const item = flatItems[index];
      if (item) {
        command(item);
      }
    },
    [command, flatItems],
  );

  useEffect(() => {
    const navigationKeys = ['ArrowUp', 'ArrowDown', 'Enter'];
    const onKeyDown = (e: KeyboardEvent) => {
      if (navigationKeys.includes(e.key)) {
        e.preventDefault();

        if (e.key === 'ArrowUp') {
          setSelectedIndex((selectedIndex + flatItems.length - 1) % flatItems.length);
          return true;
        }

        if (e.key === 'ArrowDown') {
          setSelectedIndex((selectedIndex + 1) % flatItems.length);
          return true;
        }

        if (e.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [flatItems, selectedIndex, setSelectedIndex, selectItem]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [flatItems]);

  useEffect(() => {
    viewportRef.current
      ?.querySelector(`[data-item-index="${selectedIndex}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  return flatItems.length > 0 ? (
    <Paper id="slash-command" shadow="xl" p="sm" withBorder>
      <ScrollArea viewportRef={viewportRef} h={350} w={250} scrollbarSize={5}>
        {Object.entries(items).map(([category, categoryItems]) => (
          <div key={category}>
            <Text c="dimmed" mb={4} fw={500} tt="capitalize">
              {category}
            </Text>
            {categoryItems.map((item: SlashMenuItemType, index: number) => (
              <UnstyledButton
                data-item-index={index}
                key={index}
                onClick={() => selectItem(index)}
                className={clsx(classes.menuBtn, { [classes.selectedItem]: index === selectedIndex })}
                style={{
                  width: '100%',
                  padding: 'var(--mantine-spacing-xs)',
                  color: 'var(--mantine-color-text)',
                  borderRadius: 'var(--mantine-radius-sm)',
                }}
              >
                <Group>
                  <item.icon size={18} />

                  <div style={{ flex: 1 }}>
                    <Text size="sm" fw={500}>
                      {item.title}
                    </Text>

                    <Text c="dimmed" size="xs">
                      {item.description}
                    </Text>
                  </div>
                </Group>
              </UnstyledButton>
            ))}
          </div>
        ))}
      </ScrollArea>
    </Paper>
  ) : null;
};

export default CommandList;
