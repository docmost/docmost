// y-indexeddb names each database after the collab document, page.<pageId>
const PAGE_DATABASE_PREFIX = "page.";

export async function deleteLocalPageData(): Promise<void> {
  try {
    const databases = (await indexedDB.databases?.()) ?? [];
    const pageDatabaseNames = databases
      .map((database) => database.name)
      .filter((name) => name?.startsWith(PAGE_DATABASE_PREFIX));

    await Promise.all(
      pageDatabaseNames.map(
        (name) =>
          new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          }),
      ),
    );
  } catch {
    // local cleanup must never block logout
  }
}
