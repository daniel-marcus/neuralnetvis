import { openDB } from "idb"

const DB_NAME = "neuralnetvis_datasets_test" // TODO: change to "neuralnetvis_datasets"
const KEY_PATH = "index"

export async function getDb(storeName: string) {
  const dbInfo = await indexedDB.databases()
  const existingDb = dbInfo.find((db) => db.name === DB_NAME)
  const currentVersion = existingDb?.version || 1
  let db = await openDB(DB_NAME, currentVersion)
  if (db.objectStoreNames.contains(storeName)) {
    return db
  } else {
    db.close()
    db = await openDB(DB_NAME, currentVersion + 1, {
      upgrade(db) {
        db.createObjectStore(storeName, { keyPath: KEY_PATH })
      },
    })
    return db
  }
}

export async function putDataBatch<T>(storeName: string, batches: T[]) {
  const db = await getDb(storeName)
  const tx = db.transaction(storeName, "readwrite")
  const store = tx.objectStore(storeName)
  batches.forEach((batch) => {
    store.put(batch)
  })
  await tx.done
}

export async function putData<T>(storeName: string, key: string, value: T) {
  const db = await getDb(storeName)
  const tx = db.transaction(storeName, "readwrite")
  const store = tx.objectStore(storeName)
  await store.put(value)
  await tx.done
}

export async function getData<T>(
  storeName: string,
  key: string | number
): Promise<T | undefined> {
  const db = await getDb(storeName)
  const tx = db.transaction(storeName, "readonly")
  const store = tx.objectStore(storeName)
  const res = await store.get(key)
  await tx.done
  return res
}

export async function getAll<T>(storeName: string): Promise<T[]> {
  const db = await getDb(storeName)
  const tx = db.transaction(storeName, "readonly")
  const store = tx.objectStore(storeName)
  const res = await store.getAll()
  await tx.done
  return res
}

export async function storeExistsAndHasEntries(storeName: string) {
  const db = await getDb(storeName)
  if (!db.objectStoreNames.contains(storeName)) {
    db.close()
    return false
  }
  const count = await db.count(storeName)
  db.close()
  return count > 0
}
