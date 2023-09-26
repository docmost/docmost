'use client';

import React from 'react';
import styles from './css/placeholder.module.css';
import { NodeModel } from '@minoru/react-dnd-treeview';

type Props = {
  node: NodeModel;
  depth: number;
};

export const Placeholder: React.FC<Props> = (props) => (
  <div
    className={styles.root}
    style={{ left: props.depth * 24 }}
    data-testid="placeholder"
  ></div>
);
