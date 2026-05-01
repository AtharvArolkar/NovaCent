import type { OfflineStore } from "./types";

const DB_NAME = "expense-tracker-offline";
const DB_VERSION = 1;
const STORE_NAMES = ["reports", "currencyRates", "syncOutbox"] as const;

export type OfflineStoreName = (typeof STORE_NAMES)[number];

const memoryStores = new Map<string, Map<string, unknown>>();

const hasWindowStorage = () =>
  typeof window !== "undefined" && typeof window.localStorage !== "undefined";

const hasIndexedDb = () =>
  typeof indexedDB !== "undefined" && typeof window !== "undefined";

const keyFor = (storeName: OfflineStoreName) => `offline:${storeName}`;

const readLocalStore = <TRecord extends { id: string }>(
  storeName: OfflineStoreName,
): Map<string, TRecord> => {
  if (!hasWindowStorage()) {
    const existing = memoryStores.get(storeName) as Map<string, TRecord> | undefined;
    if (existing) return existing;
    const created = new Map<string, TRecord>();
    memoryStores.set(storeName, created);
    return created;
  }

  const raw = window.localStorage.getItem(keyFor(storeName));
  const parsed = raw ? (JSON.parse(raw) as TRecord[]) : [];
  return new Map(parsed.map((record) => [record.id, record]));
};

const writeLocalStore = <TRecord extends { id: string }>(
  storeName: OfflineStoreName,
  records: Map<string, TRecord>,
) => {
  if (!hasWindowStorage()) {
    memoryStores.set(storeName, records);
    return;
  }

  window.localStorage.setItem(
    keyFor(storeName),
    JSON.stringify(Array.from(records.values())),
  );
};

const openDatabase = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      for (const storeName of STORE_NAMES) {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: "id" });
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const withObjectStore = async <TResult>(
  storeName: OfflineStoreName,
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<TResult> | void,
): Promise<TResult | undefined> => {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const request = operation(store);
    let result: TResult | undefined;

    if (request) {
      request.onsuccess = () => {
        result = request.result;
      };
      request.onerror = () => reject(request.error);
    }

    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
};

const createIndexedDbStore = <TRecord extends { id: string }>(
  storeName: OfflineStoreName,
): OfflineStore<TRecord> => ({
  async get(id) {
    return withObjectStore<TRecord>(storeName, "readonly", (store) => store.get(id));
  },
  async getAll() {
    return (
      (await withObjectStore<TRecord[]>(storeName, "readonly", (store) =>
        store.getAll(),
      )) ?? []
    );
  },
  async set(record) {
    await withObjectStore(storeName, "readwrite", (store) => store.put(record));
  },
  async delete(id) {
    await withObjectStore(storeName, "readwrite", (store) => store.delete(id));
  },
  async clear() {
    await withObjectStore(storeName, "readwrite", (store) => store.clear());
  },
});

const createLocalStore = <TRecord extends { id: string }>(
  storeName: OfflineStoreName,
): OfflineStore<TRecord> => ({
  async get(id) {
    return readLocalStore<TRecord>(storeName).get(id);
  },
  async getAll() {
    return Array.from(readLocalStore<TRecord>(storeName).values());
  },
  async set(record) {
    const store = readLocalStore<TRecord>(storeName);
    store.set(record.id, record);
    writeLocalStore(storeName, store);
  },
  async delete(id) {
    const store = readLocalStore<TRecord>(storeName);
    store.delete(id);
    writeLocalStore(storeName, store);
  },
  async clear() {
    writeLocalStore(storeName, new Map());
  },
});

export const createOfflineStore = <TRecord extends { id: string }>(
  storeName: OfflineStoreName,
): OfflineStore<TRecord> =>
  hasIndexedDb()
    ? createIndexedDbStore<TRecord>(storeName)
    : createLocalStore<TRecord>(storeName);

export const isExpired = (expiresAt?: string, now = new Date()) =>
  Boolean(expiresAt && new Date(expiresAt).getTime() <= now.getTime());

