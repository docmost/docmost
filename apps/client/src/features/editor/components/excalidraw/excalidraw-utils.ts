type LibraryItems = any;

type LibraryPersistedData = {
  libraryItems: LibraryItems;
};

export interface LibraryPersistenceAdapter {
  load(metadata: { source: "load" | "save" }):
    | Promise<{ libraryItems: LibraryItems } | null>
    | {
    libraryItems: LibraryItems;
  }
    | null;

  save(libraryData: LibraryPersistedData): Promise<void> | void;
}

const LOCAL_STORAGE_KEY = "excalidrawLibrary";

export const localStorageLibraryAdapter: LibraryPersistenceAdapter = {
  async load() {
    try {
      const data = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.error("Error downloading Excalidraw library from localStorage", e);
    }
    return null;
  },
  async save(libraryData) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(libraryData));
    } catch (e) {
      console.error(
        "Error while saving library from Excalidraw to localStorage",
        e,
      );
    }
  },
};
