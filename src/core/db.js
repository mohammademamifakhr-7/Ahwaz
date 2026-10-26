const DB_NAME = 'evogenesis';
const DB_VERSION = 1;
const STORE = 'worlds';
const MAX_SNAPSHOTS = 5;

let _dbPromise = null;

function openDB() {
     if (_dbPromise) return _dbPromise;
     _dbPromise = new Promise((resolve, reject) => {
          const req = indexedDB.open(DB_NAME, DB_VERSION);
          req.onupgradeneeded = () => {
               const db = req.result;
               if (!db.objectStoreNames.contains(STORE)) {
                    const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('savedAt', 'savedAt');
               }
          };
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
     });
     return _dbPromise;
}

export async function saveWorld(snapshot) {
     try {
          const db = await openDB();
          return await new Promise((resolve, reject) => {
               const tx = db.transaction(STORE, 'readwrite');
               const store = tx.objectStore(STORE);
               store.add({ savedAt: Date.now(), data: snapshot });
               const reqAll = store.getAll();
               reqAll.onsuccess = () => {
                    const all = reqAll.result || [];
                    if (all.length > MAX_SNAPSHOTS) {
                         all.sort((a, b) => a.savedAt - b.savedAt);
                         const toDelete = all.length - MAX_SNAPSHOTS;
                         for (let i = 0; i < toDelete; i++) store.delete(all[i].id);
                    }
               };
               tx.oncomplete = () => resolve(true);
               tx.onerror = () => reject(tx.error);
          });
     } catch (e) { console.warn('[db] save failed:', e); return false; }
}

export async function loadLatestWorld() {
     try {
          const db = await openDB();
          return await new Promise((resolve, reject) => {
               const tx = db.transaction(STORE, 'readonly');
               const store = tx.objectStore(STORE);
               const req = store.getAll();
               req.onsuccess = () => {
                    const all = req.result || [];
                    if (!all.length) return resolve(null);
                    all.sort((a, b) => b.savedAt - a.savedAt);
                    resolve(all[0].data);
               };
               req.onerror = () => reject(req.error);
          });
     } catch (e) { console.warn('[db] load failed:', e); return null; }
}

export async function clearWorlds() {
     try {
          const db = await openDB();
          return await new Promise((resolve, reject) => {
               const tx = db.transaction(STORE, 'readwrite');
               tx.objectStore(STORE).clear();
               tx.oncomplete = () => resolve(true);
               tx.onerror = () => reject(tx.error);
          });
     } catch (e) { return false; }
}