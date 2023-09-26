'use client';

import React from 'react';
import { PageIcon } from './page-icon';
import { Page } from '@/features/page/page-tree/components/types/types';
import styles from './css/page-node.module.css';
import { NodeModel } from '@minoru/react-dnd-treeview';
import { Text } from '@mantine/core';
import { IconChevronRight } from '@tabler/icons-react';

type Props = {
  node: NodeModel<Page>;
  depth: number;
  isOpen: boolean;
  testIdPrefix?: string;
  onToggle: (id: NodeModel['id']) => void;
}

export const PageNode: React.FC<Props> = ({ testIdPrefix = '', ...props }) => {
  const { id, droppable, data } = props.node;
  const indent = props.depth * 24;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    props.onToggle(props.node.id);
  };

  return (
    <div
      className={styles.root}
      style={{ paddingInlineStart: indent }}
      data-testid={`${testIdPrefix}page-node-${id}`}
    >
      <div className={` ${styles.arrow} ${props.isOpen ? styles.isOpen : ''}`}>
        {props.node.droppable && (
          <div onClick={handleToggle}>
            <IconChevronRight size={18} data-testid={`icon-chevron-right-${id}`} />
          </div>
        )}
      </div>
      <div className={styles.icon}>
        <PageIcon />
      </div>
      <div className={styles.label}>
        <Text>{props.node.text}</Text>
      </div>
    </div>
  );
};
