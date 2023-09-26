'use client';

import React from 'react';
import { PageIcon } from './page-icon';
import styles from './css/custom-drag-preview.module.css';
import { DragLayerMonitorProps } from '@minoru/react-dnd-treeview';
import { Page, PageProperties } from '@/features/page/page-tree/components/types/types';

type Props = {
  monitorProps: DragLayerMonitorProps<PageProperties>;
}

export const PageDragPreview: React.FC<Props> = (props) => {
  const item = props.monitorProps.item;

  return (
    <div className={styles.root} data-testid="custom-drag-preview">
      <div className={styles.icon}>
        <PageIcon />
      </div>
      <div className={styles.label}>{item.text}</div>
    </div>
  );
}
