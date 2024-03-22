import { DefaultNamingStrategy, Table } from 'typeorm';

export class NamingStrategy extends DefaultNamingStrategy {
  primaryKeyName(tableOrName: Table | string, columnNames: string[]): string {
    const tableName = this.normalizeTableName(tableOrName);
    return `PK_${tableName}`;
  }

  indexName(
    tableOrName: Table | string,
    columnNames: string[],
    where?: string,
  ): string {
    const tableName = this.normalizeTableName(tableOrName);

    let name = `${tableName}_${columnNames.join('_')}`;
    if (where) name += '_' + where;

    return `IDX_${name}`;
  }

  uniqueConstraintName(
    tableOrName: Table | string,
    columnNames: string[],
  ): string {
    const tableName = this.normalizeTableName(tableOrName);

    return `UQ_${tableName}_${columnNames.join('_')}`;
  }

  foreignKeyName(
    tableOrName: Table | string,
    columnNames: string[],
    _referencedTablePath?: string,
    _referencedColumnNames?: string[],
  ): string {
    const tableName = this.normalizeTableName(tableOrName);
    const targetTable = this.normalizeTableName(_referencedTablePath);

    const name = `${tableName}_${targetTable}_${columnNames.join('_')}`;
    return `FK_${name}`;
  }

  relationConstraintName(
    tableOrName: Table | string,
    columnNames: string[],
    where?: string,
  ): string {
    const tableName = this.normalizeTableName(tableOrName);

    let name = `${tableName}_${columnNames.join('_')}`;
    if (where) name += '_' + where;

    return `REL_${name}`;
  }

  normalizeTableName(tableOrName: Table | string): string {
    const tableName = this.getTableName(tableOrName);
    return tableName.replace('.', '_');
  }
}
