'use client';

const DB_NAME = 'life-tracker.finance';
const DB_VERSION = 1;
const META_STORE = 'meta';
const VAULT_STORE = 'vault';

const META_KEY = 'config';
const VAULT_KEY = 'main';

function isBrowser() {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

function openDb() {
  if (!isBrowser()) {
    return Promise.reject(new Error('IndexedDB is not available.'));
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
      if (!db.objectStoreNames.contains(VAULT_STORE)) {
        db.createObjectStore(VAULT_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

async function withStore(storeName, mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    try {
      result = fn(store);
    } catch (err) {
      reject(err);
      return;
    }
    tx.oncomplete = () => {
      db.close();
      resolve(result?.value !== undefined ? result.value : result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('Transaction failed'));
    };
  });
}

function promisifyRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getMeta() {
  return withStore(META_STORE, 'readonly', (store) =>
    promisifyRequest(store.get(META_KEY))
  );
}

export async function setMeta(meta) {
  return withStore(META_STORE, 'readwrite', (store) => {
    store.put(meta, META_KEY);
  });
}

export async function getVaultBlob() {
  return withStore(VAULT_STORE, 'readonly', (store) =>
    promisifyRequest(store.get(VAULT_KEY))
  );
}

export async function setVaultBlob(blob) {
  return withStore(VAULT_STORE, 'readwrite', (store) => {
    store.put(blob, VAULT_KEY);
  });
}

export async function deleteVault() {
  return withStore(VAULT_STORE, 'readwrite', (store) => {
    store.delete(VAULT_KEY);
  });
}

export async function purgeAll() {
  if (!isBrowser()) return;
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onblocked = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export const STORAGE_AVAILABLE = isBrowser;
