import { NodeApi, NodeRendererProps, Tree, TreeApi } from 'react-arborist';
import { pageData } from '@/features/page/tree/data';
import {
  IconArrowsLeftRight,
  IconChevronDown,
  IconChevronRight,
  IconCornerRightUp,
  IconDots,
  IconDotsVertical,
  IconEdit,
  IconFileDescription,
  IconLink,
  IconPlus,
  IconStar,
  IconTrash,
} from '@tabler/icons-react';

import { useEffect, useRef } from 'react';
import clsx from 'clsx';

import styles from './tree.module.css';
import { ActionIcon, Menu, rem } from '@mantine/core';
import { atom, useAtom } from 'jotai';
import { useDynamicTree } from './hooks/use-dynamic-tree';
import { FillFlexParent } from './components/fill-flex-parent';
import { Data } from './types';
import { treeApiAtom } from './atoms/tree-api-atom';

export default function PageTree() {
  const { data, setData, controllers } = useDynamicTree();

  const [, setTree] = useAtom<TreeApi<Data>>(treeApiAtom);


  useEffect(() => {
    setData(pageData);
  }, [setData]);

  return (
    <div className={styles.treeContainer}>
      <FillFlexParent>
        {(dimens) => (
          <Tree
            data={data}
            {...controllers}
            {...dimens}
            // @ts-ignore
            ref={(t) => setTree(t)}
            openByDefault={false}
            disableMultiSelection={true}
            className={styles.tree}
            rowClassName={styles.row}
            padding={15}
            rowHeight={30}
            overscanCount={5}
          >
            {Node}
          </Tree>
        )}
      </FillFlexParent>
    </div>
  );
}

function Node({ node, style, dragHandle }: NodeRendererProps<any>) {
  return (
    <>
      <div
        style={style}
        className={clsx(styles.node, node.state)}
        ref={dragHandle}
      >
        <PageArrow node={node} />

        <IconFileDescription size="18px" style={{ marginRight: '4px' }} />

        <span className={styles.text}>
          {node.isEditing ? (
            <Input node={node} />
          ) : (
            node.data.name || 'untitled'
          )}
        </span>

        <div className={styles.actions}>
          <NodeMenu node={node} />
          <CreateNode node={node} />
        </div>
      </div>
    </>
  );
}

function CreateNode({ node }: { node: NodeApi<Data> }) {
  const [tree] = useAtom(treeApiAtom);

  function handleCreate() {
    tree?.create({ type: 'internal', parentId: node.id, index: 0 });
  }

  return (
    <ActionIcon variant="transparent" color="gray" onClick={handleCreate}>
      <IconPlus style={{ width: rem(20), height: rem(20) }} stroke={2} />
    </ActionIcon>
  );
}

function NodeMenu({ node }: { node: NodeApi<Data> }) {
  const [tree] = useAtom(treeApiAtom);

  function handleDelete() {
    const sib = node.nextSibling;
    const parent = node.parent;
    tree?.focus(sib || parent, { scroll: false });
    tree?.delete(node);
  }

  return (
    <Menu shadow="md" width={200}>
      <Menu.Target>
        <ActionIcon variant="transparent" color="gray">
          <IconDotsVertical
            style={{ width: rem(20), height: rem(20) }}
            stroke={2}
          />
        </ActionIcon>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Item
          leftSection={<IconEdit style={{ width: rem(14), height: rem(14) }} />}
          onClick={() => node.edit()}
        >
          Rename
        </Menu.Item>
        <Menu.Item
          leftSection={<IconStar style={{ width: rem(14), height: rem(14) }} />}
        >
          Favorite
        </Menu.Item>

        <Menu.Divider />

        <Menu.Item
          leftSection={<IconLink style={{ width: rem(14), height: rem(14) }} />}
        >
          Copy link
        </Menu.Item>

        <Menu.Item
          leftSection={
            <IconCornerRightUp style={{ width: rem(14), height: rem(14) }} />
          }
        >
          Move
        </Menu.Item>

        <Menu.Divider />
        <Menu.Item
          leftSection={
            <IconArrowsLeftRight style={{ width: rem(14), height: rem(14) }} />
          }
        >
          Archive
        </Menu.Item>
        <Menu.Item
          color="red"
          leftSection={
            <IconTrash style={{ width: rem(14), height: rem(14) }} />
          }
          onClick={() => handleDelete()}
        >
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

function PageArrow({ node }: { node: NodeApi<Data> }) {
  return (
    <span onClick={() => node.toggle()}>
      {node.isInternal ? (
        node.children && node.children.length > 0 ? (
          node.isOpen ? (
            <IconChevronDown size={18} />
          ) : (
            <IconChevronRight size={18} />
          )
        ) : (
          <IconChevronRight size={18} style={{ visibility: 'hidden' }} />
        )
      ) : null}
    </span>
  );
}

function Input({ node }: { node: NodeApi<Data> }) {
  return (
    <input
      autoFocus
      name="name"
      type="text"
      placeholder="untitled"
      defaultValue={node.data.name}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => node.reset()}
      onKeyDown={(e) => {
        if (e.key === 'Escape') node.reset();
        if (e.key === 'Enter') node.submit(e.currentTarget.value);
      }}
    />
  );
}
