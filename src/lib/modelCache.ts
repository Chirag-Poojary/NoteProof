/**
 * modelCache.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Downloads ONNX model files and caches them persistently in IndexedDB.
 * Subsequent visits load instantly from local storage, bypassing the network.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DB_NAME = "onnx-model-cache";
const STORE_NAME = "models";

export async function fetchAndCacheModel(modelUrl: string): Promise<ArrayBuffer> {
  if (typeof window === "undefined") {
    throw new Error("fetchAndCacheModel can only be called in the browser environment.");
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      const transaction = db.transaction([STORE_NAME], "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const getReq = store.get(modelUrl);

      getReq.onsuccess = async () => {
        if (getReq.result) {
          console.log(`[ModelCache] Loaded ${modelUrl} instantly from IndexedDB cache`);
          resolve(getReq.result);
        } else {
          console.log(`[ModelCache] Fetching model from network: ${modelUrl}`);
          try {
            const response = await fetch(modelUrl);
            if (!response.ok) {
              throw new Error(`HTTP error! status: ${response.status} fetching ${modelUrl}`);
            }
            const arrayBuffer = await response.arrayBuffer();

            // Save to IDB for future sessions
            const writeTx = db.transaction([STORE_NAME], "readwrite");
            const writeStore = writeTx.objectStore(STORE_NAME);
            writeStore.put(arrayBuffer, modelUrl);

            console.log(`[ModelCache] Saved ${modelUrl} to IndexedDB cache`);
            resolve(arrayBuffer);
          } catch (err) {
            reject(err);
          }
        }
      };

      getReq.onerror = async () => {
        // Fallback to direct fetch if IDB read fails
        try {
          const response = await fetch(modelUrl);
          resolve(await response.arrayBuffer());
        } catch (err) {
          reject(err);
        }
      };
    };

    request.onerror = async () => {
      // Fallback if IndexedDB is blocked (e.g. Incognito)
      try {
        const response = await fetch(modelUrl);
        resolve(await response.arrayBuffer());
      } catch (err) {
        reject(err);
      }
    };
  });
}
