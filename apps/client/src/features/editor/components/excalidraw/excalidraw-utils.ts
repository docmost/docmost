import { ENCRYPTION_KEY_BITS } from "@excalidraw/common";

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
      console.error(
        "Error downloading Excalidraw library from localStorage",
        e,
      );
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

export const blobToArrayBuffer = (blob: Blob): Promise<ArrayBuffer> => {
  if ("arrayBuffer" in blob) {
    return blob.arrayBuffer();
  }
  // Safari
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result) {
        return reject(new Error("Couldn't convert blob to ArrayBuffer"));
      }
      resolve(event.target.result as ArrayBuffer);
    };
    reader.readAsArrayBuffer(blob);
  });
};

export const IV_LENGTH_BYTES = 12;

// Pre-transform error: No known conditions for "./data/encryption" specifier in "@excalidraw/excalidraw" package
//   Plugin: vite:import-analysis
//   File: /Users/lite/WebstormProjects/docmost-ee/apps/client/src/features/editor/components/excalidraw/use-excalidraw-collab.ts:11:7
//   7  |    decryptData,
//   8  |    encryptData
//   9  |  } from "@excalidraw/excalidraw/data/encryption";

//@ts-ignore
export const createIV = (): Uint8Array<ArrayBuffer> => {
  const arr = new Uint8Array(IV_LENGTH_BYTES);
  return window.crypto.getRandomValues(arr);
};

export const generateEncryptionKey = async <
  T extends "string" | "cryptoKey" = "string",
>(
  returnAs?: T,
): Promise<T extends "cryptoKey" ? CryptoKey : string> => {
  const key = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: ENCRYPTION_KEY_BITS,
    },
    true, // extractable
    ["encrypt", "decrypt"],
  );
  return (
    returnAs === "cryptoKey"
      ? key
      : (await window.crypto.subtle.exportKey("jwk", key)).k
  ) as T extends "cryptoKey" ? CryptoKey : string;
};

export const getCryptoKey = (key: string, usage: KeyUsage) =>
  window.crypto.subtle.importKey(
    "jwk",
    {
      alg: "A128GCM",
      ext: true,
      k: key,
      key_ops: ["encrypt", "decrypt"],
      kty: "oct",
    },
    {
      name: "AES-GCM",
      length: ENCRYPTION_KEY_BITS,
    },
    false, // extractable
    [usage],
  );

export const encryptData = async (
  key: string | CryptoKey,
  //@ts-ignore
  data: Uint8Array<ArrayBuffer> | ArrayBuffer | Blob | File | string,
  //@ts-ignore
): Promise<{ encryptedBuffer: ArrayBuffer; iv: Uint8Array<ArrayBuffer> }> => {
  const importedKey =
    typeof key === "string" ? await getCryptoKey(key, "encrypt") : key;
  const iv = createIV();
  //@ts-ignore
  const buffer: ArrayBuffer | Uint8Array<ArrayBuffer> =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
        ? data
        : data instanceof Blob
          ? await blobToArrayBuffer(data)
          : data;

  // We use symmetric encryption. AES-GCM is the recommended algorithm and
  // includes checks that the ciphertext has not been modified by an attacker.
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    importedKey,
    buffer,
  );

  return { encryptedBuffer, iv };
};

export const decryptData = async (
  //@ts-ignore
  iv: Uint8Array<ArrayBuffer>,
  //@ts-ignore
  encrypted: Uint8Array<ArrayBuffer> | ArrayBuffer,
  privateKey: string,
): Promise<ArrayBuffer> => {
  const key = await getCryptoKey(privateKey, "decrypt");
  return window.crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
    },
    key,
    encrypted,
  );
};
