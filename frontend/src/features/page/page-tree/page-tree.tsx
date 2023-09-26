'use client';

import React, { useState } from 'react';
import { DndProvider } from 'react-dnd';
import {
  Tree,
  NodeModel,
  MultiBackend,
  getBackendOptions,
} from '@minoru/react-dnd-treeview';
import { PageNode } from './components/page-node';
import { Placeholder } from './components/placeholder';
import styles from './components/css/tree.module.css';
import PageTreeData from './components/tree.json';
import { PageDragPreview } from './components/page-drag-preview';
import { Page } from '@/features/page/page-tree/components/types/types';

export default function PageTree() {
  const [treeData, setTreeData] = useState<NodeModel<Page>[]>(PageTreeData);
  const handleDrop = (newTree: NodeModel<Page>[]) => setTreeData(newTree);

  return (
    <DndProvider backend={MultiBackend} options={getBackendOptions()}>
      <div className={styles.app}>
        <Tree
          tree={treeData}
          rootId={0}
          render={(node, { depth, isOpen, onToggle }) => (
            <PageNode
              node={node}
              depth={depth}
              isOpen={isOpen}
              onToggle={onToggle}
            />
          )}
          dragPreviewRender={(monitorProps) => (
            <PageDragPreview monitorProps={monitorProps} />
          )}
          onDrop={handleDrop}
          classes={{
            root: styles.treeRoot,
            draggingSource: styles.draggingSource,
            placeholder: styles.placeholderContainer,
           // dropTarget: styles.dropTarget,
          }}
          sort={false}
          insertDroppableFirst={false}
          canDrop={(tree, { dragSource, dropTargetId, dropTarget }) => {
            if (dragSource?.parent === dropTargetId) {
              return true;
            }
          }}
          dropTargetOffset={10}
          placeholderRender={(node, { depth }) => (
            <Placeholder node={node} depth={depth} />
          )}
        />
      </div>
    </DndProvider>
  );
}
