import { DataSource, EntityManager } from 'typeorm';

export async function transactionWrapper(
  operation: (...args) => any,
  datasource: DataSource,
  entityManager: EntityManager,
) {
  if (entityManager) {
    return await operation(entityManager);
  } else {
    return await datasource.manager.transaction(
      async (manager: EntityManager) => {
        return await operation(manager);
      },
    );
  }
}
