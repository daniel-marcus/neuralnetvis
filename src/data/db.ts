import { openDB } from "idb"
import { DatasetKey } from "./types"

/* 
dbName: ds.key
storeName: "train" | "test" | "meta
*/

export const DB_PREFIX = "nnv_dev_"
const KEY_PATH = "index"
const STORE_NAMES = ["train", "test", "meta"] as const

// TODO: dbName: DatasetDef.name
type StoreName = (typeof STORE_NAMES)[number]

export function getDb(dbName: DatasetKey) {
  return openDB(`${DB_PREFIX}${dbName}`, 1, {
    upgrade(db) {
      STORE_NAMES.forEach((storeName) => {
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: KEY_PATH })
        }
      })
    },
  })
}

export async function putDataBatches<T>(
  dbName: DatasetKey,
  storeName: StoreName,
  batches: T[]
) {
  const db = await getDb(dbName)
  const tx = db.transaction(storeName, "readwrite")
  const store = tx.objectStore(storeName)
  batches.forEach((batch) => {
    store.put(batch)
  })
  await tx.done
}

export async function putData<T>(
  dbName: DatasetKey,
  storeName: StoreName,
  value: T
) {
  const db = await getDb(dbName)
  const tx = db.transaction(storeName, "readwrite")
  const store = tx.objectStore(storeName)
  await store.put(value)
  await tx.done
}

export async function getData<T>(
  dbName: DatasetKey,
  storeName: StoreName,
  key: string | number
): Promise<T | undefined> {
  const db = await getDb(dbName)
  const tx = db.transaction(storeName, "readonly")
  const store = tx.objectStore(storeName)
  const res = await store.get(key)
  await tx.done
  return res
}

export async function getAll<T>(
  dbName: DatasetKey,
  storeName: StoreName,
  range?: IDBKeyRange
): Promise<T[]> {
  const db = await getDb(dbName)
  const tx = db.transaction(storeName, "readonly")
  const store = tx.objectStore(storeName)
  const res = await store.getAll(range)
  await tx.done
  return res
}

export async function storeHasEntries(
  dbName: DatasetKey,
  storeName: StoreName
) {
  const db = await getDb(dbName)
  const count = await db.count(storeName)
  db.close()
  return count > 0
}
