import { useMemo, useState } from 'react';
import {
  CreateHandler,
  DeleteHandler,
  MoveHandler,
  RenameHandler,
  SimpleTree,
} from 'react-arborist';

let nextId = 0;

export function useDynamicTree<T>() {
  const [data, setData] = useState<T[]>([]);
  const tree = useMemo(
    () =>
      new SimpleTree<// @ts-ignore
      T>(data),
    [data]
  );

  const onMove: MoveHandler<T> = (args: {
    dragIds: string[];
    parentId: null | string;
    index: number;
  }) => {
    for (const id of args.dragIds) {
      tree.move({ id, parentId: args.parentId, index: args.index });
    }
    setData(tree.data);

    // reparent pages in db on move

  };

  const onRename: RenameHandler<T> = ({ name, id }) => {
    tree.update({ id, changes: { name } as any });
    setData(tree.data);

    console.log('new title: ' + name + ' for ' + id )
    // use jotai to store the title in an atom
    // on rename, persist to db
  };

  const onCreate: CreateHandler<T> = ({ parentId, index, type }) => {
    const data = { id: `id-${nextId++}`, name: '' } as any;
    //if (type === 'internal') 
    data.children = []; // all nodes are internal
    tree.create({ parentId, index, data });
    setData(tree.data);

    // oncreate, create new page on db
    // figure out the id for new pages
    // perhaps persist the uuid to the create page endpoint 

    return data;
  };

  const onDelete: DeleteHandler<T> = (args: { ids: string[] }) => {
    args.ids.forEach((id) => tree.drop({ id }));
    setData(tree.data);
    // delete page by id from db
  };

  const controllers = { onMove, onRename, onCreate, onDelete };

  return { data, setData, controllers } as const;
}
