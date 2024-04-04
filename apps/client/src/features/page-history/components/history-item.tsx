import { Text, Group, UnstyledButton } from '@mantine/core';
import { UserAvatar } from '@/components/ui/user-avatar';
import { formatDate } from '@/lib/time';
import classes from './history.module.css';
import clsx from 'clsx';

interface HistoryItemProps {
  historyItem: any,
  onSelect: (id: string) => void;
  isActive: boolean;
}

function HistoryItem({ historyItem, onSelect, isActive }: HistoryItemProps) {

  return (
    <UnstyledButton p="xs" onClick={() => onSelect(historyItem.id)}
                    className={clsx(classes.history, { [classes.active]: isActive })}
    >
      <Group wrap="nowrap">
        <div>
          <Text size="sm">
            {formatDate(new Date(historyItem.createdAt))}
          </Text>

          <div style={{ flex: 1 }}>
            <Group gap={4} wrap="nowrap">
              <UserAvatar c="blue" size="sm" avatarUrl={historyItem.lastUpdatedBy.avatarUrl}
                          name={historyItem.lastUpdatedBy.name} />
              <Text size="sm" c="dimmed" lineClamp={1}>
                {historyItem.lastUpdatedBy.name}
              </Text>
            </Group>
          </div>
        </div>
      </Group>
    </UnstyledButton>
  );
}

export default HistoryItem;
