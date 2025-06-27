import React, { useState } from 'react';
import { ActionIcon, Group, Menu, Text, Tooltip, ScrollArea } from '@mantine/core';
import { IconAnchor } from '@tabler/icons-react';
import { HeadingInfo } from '@/features/search/types/search.types';

interface AnchorSelectorProps {
  headings: HeadingInfo[];
  onSelectAnchor: (anchorSlug: string, headingText: string) => void;
}

export function AnchorSelector({ headings, onSelectAnchor }: AnchorSelectorProps) {
  const [opened, setOpened] = useState(false);

  const handleAnchorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpened(!opened);
  };

  if (!headings?.length) return null;

  return (
    <Menu 
      opened={opened} 
      onChange={setOpened} 
      position="bottom-start" 
      withinPortal
      zIndex={9999}
      width={300}
      offset={5}
    >
      <Menu.Target>
        <Tooltip 
          label={`Link to heading (${headings.length} available)`} 
          withArrow
          zIndex={10000}
          withinPortal
        >
          <ActionIcon
            size="sm"
            variant="light"
            color="blue"
            onClick={handleAnchorClick}
            style={{ marginLeft: '4px' }}
          >
            <IconAnchor size={14} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>

      <Menu.Dropdown style={{ maxHeight: '300px', overflow: 'hidden' }}>
        <Menu.Label>
          Jump to heading ({headings.length} found)
        </Menu.Label>
        <ScrollArea h={250}>
          {headings.map((heading, index) => (
            <Menu.Item
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                onSelectAnchor(heading.slug || '', heading.text);
                setOpened(false);
              }}
              style={{ 
                paddingLeft: `${8 + (heading.level - 1) * 12}px`,
                minHeight: '32px'
              }}
            >
              <Group gap="xs" wrap="nowrap" style={{ width: '100%' }}>
                <Text size="xs" c="dimmed" style={{ minWidth: '20px', fontWeight: 600 }}>
                  H{heading.level}
                </Text>
                <Text 
                  size="sm" 
                  style={{ 
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}
                  title={heading.text}
                >
                  {heading.text}
                </Text>
              </Group>
            </Menu.Item>
          ))}
        </ScrollArea>
      </Menu.Dropdown>
    </Menu>
  );
}
