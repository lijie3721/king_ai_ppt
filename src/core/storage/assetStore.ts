import type { DeckAsset, DeckAssetMeta } from "../markdown/types";

const dbName = "ai-ppt-assets";
const storeName = "assets";
const dbVersion = 1;

export async function isAssetStoreAvailable(): Promise<boolean> {
  return typeof indexedDB !== "undefined";
}

export async function saveAsset(asset: DeckAsset): Promise<void> {
  const db = await openAssetDb();
  await runAssetRequest(db.transaction(storeName, "readwrite").objectStore(storeName).put(asset));
  db.close();
}

export async function saveAssets(assets: DeckAsset[]): Promise<void> {
  const db = await openAssetDb();
  const transaction = db.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  await Promise.all(assets.map((asset) => runAssetRequest(store.put(asset))));
  await waitForTransaction(transaction);
  db.close();
}

export async function loadAssets(assetMetas: DeckAssetMeta[]): Promise<DeckAsset[]> {
  const db = await openAssetDb();
  const transaction = db.transaction(storeName, "readonly");
  const store = transaction.objectStore(storeName);
  const assets = await Promise.all(
    assetMetas.map(async (meta) => {
      const stored = await runAssetRequest<DeckAsset | undefined>(store.get(meta.id));
      return stored ?? { ...meta, dataUrl: "" };
    })
  );
  db.close();
  return assets;
}

export async function deleteAssets(assetIds: string[]): Promise<void> {
  if (assetIds.length === 0) return;
  const db = await openAssetDb();
  const transaction = db.transaction(storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  await Promise.all(assetIds.map((assetId) => runAssetRequest(store.delete(assetId))));
  await waitForTransaction(transaction);
  db.close();
}

function openAssetDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB is not available."));
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName, dbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onerror = () => reject(request.error ?? new Error("Could not open asset store."));
    request.onsuccess = () => resolve(request.result);
  });
}

function runAssetRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error ?? new Error("Asset store request failed."));
    request.onsuccess = () => resolve(request.result);
  });
}

function waitForTransaction(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Asset store transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Asset store transaction aborted."));
  });
}
