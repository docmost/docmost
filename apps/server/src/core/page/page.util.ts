import { KyselyTransaction } from '@docmost/db/types/kysely.types';
import { MovePageDto } from './dto/move-page.dto';
import { PageOrdering } from '@docmost/db/types/entity.types';

export enum OrderingEntity {
  WORKSPACE = 'WORKSPACE',
  SPACE = 'SPACE',
  PAGE = 'PAGE',
}

export type TreeNode = {
  id: string;
  title: string;
  icon?: string;
  children?: TreeNode[];
};

export function orderPageList(arr: string[], payload: MovePageDto): void {
  const { pageId: id, after, before } = payload;

  // Removing the item we are moving from the array first.
  const index = arr.indexOf(id);
  if (index > -1) arr.splice(index, 1);

  if (after) {
    const afterIndex = arr.indexOf(after);
    if (afterIndex > -1) {
      arr.splice(afterIndex + 1, 0, id);
    } else {
      // Place the item at the end if the after ID is not found.
      arr.push(id);
    }
  } else if (before) {
    const beforeIndex = arr.indexOf(before);
    if (beforeIndex > -1) {
      arr.splice(beforeIndex, 0, id);
    } else {
      // Place the item at the end if the before ID is not found.
      arr.push(id);
    }
  } else {
    // If neither after nor before is provided, just add the id at the end
    if (!arr.includes(id)) {
      arr.push(id);
    }
  }
}

/**
 * Remove an item from an array and update the entity
 * @param entity - The entity instance (Page or Space)
 * @param arrayField - The name of the field which is an array
 * @param itemToRemove - The item to remove from the array
 * @param manager - EntityManager instance
 */
export async function removeFromArrayAndSave(
  entity: PageOrdering,
  arrayField: string,
  itemToRemove: any,
  trx: KyselyTransaction,
) {
  const array = entity[arrayField];
  const index = array.indexOf(itemToRemove);
  if (index > -1) {
    array.splice(index, 1);
    await trx
      .updateTable('pageOrdering')
      .set(entity)
      .where('id', '=', entity.id)
      .execute();
  }
}

export function transformPageResult(result: any[]): any[] {
  return result.map((row) => {
    const processedRow = {};
    for (const key in row) {
      //const newKey = key.split('_').slice(1).join('_');
      if (key === 'childrenIds' && !row[key]) {
        processedRow[key] = [];
      } else {
        processedRow[key] = row[key];
      }
    }
    return processedRow;
  });
}
