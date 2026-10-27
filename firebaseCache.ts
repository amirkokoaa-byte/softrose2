import { onValue, DatabaseReference, DataSnapshot } from "firebase/database";

type SubscriberCallback = (snapshot: any, isCached?: boolean) => void;

const memoryCache = new Map<string, any>();
const memorySignatures = new Map<string, string>();
const pendingStorageTimers = new Map<string, ReturnType<typeof setTimeout>>();
const activeSubscribers = new Map<string, Set<SubscriberCallback>>();
const activeFirebaseListeners = new Map<string, () => void>();

const IDB_NAME = "SoftRoseLocalCacheDB";
const IDB_VERSION = 1;
const IDB_STORE = "firebase_cache";
const MAX_LOCALSTORAGE_CHARS = 200_000;

let idbPromise: Promise<IDBDatabase | null> | null = null;
let hydrationPromise: Promise<void> | null = null;

const getLocalStorage = () => {
    try {
        return window.localStorage;
    } catch (e) {
        return null;
    }
};

// Request persistent storage on phone/browser so OS never evicts local database
const requestPersistentStorage = () => {
    try {
        if (typeof navigator !== "undefined" && navigator.storage && navigator.storage.persist) {
            navigator.storage.persist().catch(() => {});
        }
    } catch (e) {
        /* ignore */
    }
};

const openCacheDB = (): Promise<IDBDatabase | null> => {
    if (idbPromise) return idbPromise;
    idbPromise = new Promise((resolve) => {
        try {
            if (typeof window === "undefined" || !("indexedDB" in window)) {
                resolve(null);
                return;
            }
            const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(IDB_STORE)) {
                    db.createObjectStore(IDB_STORE);
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
        } catch (e) {
            resolve(null);
        }
    });
    return idbPromise;
};

const readFromIDB = async (key: string): Promise<any> => {
    const db = await openCacheDB();
    if (!db) return undefined;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(IDB_STORE, "readonly");
            const store = tx.objectStore(IDB_STORE);
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(undefined);
        } catch (e) {
            resolve(undefined);
        }
    });
};

const writeToIDB = async (key: string, value: any): Promise<void> => {
    const db = await openCacheDB();
    if (!db) return;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(IDB_STORE, "readwrite");
            const store = tx.objectStore(IDB_STORE);
            if (value !== null && value !== undefined) {
                store.put(value, key);
            } else {
                store.delete(key);
            }
            tx.oncomplete = () => resolve();
            tx.onerror = () => resolve();
        } catch (e) {
            resolve();
        }
    });
};

const computeQuickSignature = (data: any): string => {
    if (data === null || data === undefined) return "null";
    if (typeof data !== "object") return `${typeof data}:${String(data)}`;
    try {
        const keys = Object.keys(data);
        const len = keys.length;
        if (len === 0) return "obj:0";
        const firstKey = keys[0];
        const lastKey = keys[len - 1];
        const firstSample = JSON.stringify(data[firstKey])?.slice(0, 120) || "";
        const lastSample = JSON.stringify(data[lastKey])?.slice(0, 120) || "";
        return `obj:${len}:${firstKey}:${lastKey}:${firstSample}:${lastSample}`;
    } catch (e) {
        return String(Date.now());
    }
};

// Pre-hydrate all cached collections from IndexedDB into memory immediately on startup
const hydrateMemoryFromIDB = (): Promise<void> => {
    if (hydrationPromise) return hydrationPromise;
    requestPersistentStorage();
    hydrationPromise = (async () => {
        const db = await openCacheDB();
        if (!db) return;
        await new Promise<void>((resolve) => {
            try {
                const tx = db.transaction(IDB_STORE, "readonly");
                const store = tx.objectStore(IDB_STORE);
                const cursorReq = store.openCursor();
                cursorReq.onsuccess = (event) => {
                    const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
                    if (cursor) {
                        const k = String(cursor.key);
                        if (!memoryCache.has(k) && cursor.value !== undefined) {
                            memoryCache.set(k, cursor.value);
                            memorySignatures.set(k, computeQuickSignature(cursor.value));
                        }
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                cursorReq.onerror = () => resolve();
            } catch (e) {
                resolve();
            }
        });
    })();
    return hydrationPromise;
};

hydrateMemoryFromIDB();

const createFakeSnapshot = (parsed: any, key: string | null): any => ({
    exists: () => parsed !== null && parsed !== undefined && (typeof parsed === "object" ? Object.keys(parsed).length > 0 : true),
    val: () => parsed,
    key,
    forEach: (childAction: any) => {
        if (parsed && typeof parsed === "object") {
            Object.keys(parsed).forEach((k) => {
                childAction(createFakeSnapshot(parsed[k], k));
            });
        }
    }
});

const scheduleDevicePersistence = (cacheKey: string, data: any) => {
    const existingTimer = pendingStorageTimers.get(cacheKey);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
        pendingStorageTimers.delete(cacheKey);
        writeToIDB(cacheKey, data);

        const storage = getLocalStorage();
        if (!storage) return;
        try {
            if (data !== null && data !== undefined) {
                const serialized = JSON.stringify(data);
                if (serialized.length <= MAX_LOCALSTORAGE_CHARS) {
                    storage.setItem(`fb_cache_${cacheKey}`, serialized);
                } else {
                    storage.removeItem(`fb_cache_${cacheKey}`);
                }
            } else {
                storage.removeItem(`fb_cache_${cacheKey}`);
            }
        } catch (e) {
            /* ignore localStorage quota errors since IndexedDB stores the full data */
        }
    }, 200);

    pendingStorageTimers.set(cacheKey, timer);
};

const getEffectiveCacheKey = (refObj: DatabaseReference, fallbackKey: string): string => {
    try {
        const urlStr = refObj.toString();
        const pathPart = urlStr.replace(/^https?:\/\/[^/]+\/?/, "").replace(/[/.#$[\]]/g, "_");
        if (pathPart) return pathPart;
    } catch (e) {
        /* ignore */
    }
    return fallbackKey;
};

export const onCachedValue = (
    refObj: DatabaseReference,
    cacheKey: string,
    callback: SubscriberCallback
) => {
    const effectiveKey = getEffectiveCacheKey(refObj, cacheKey);
    let emittedFromCache = false;
    let isUnsubscribed = false;

    // Register subscriber in shared pool so switching tabs never tears down & re-downloads Firebase data
    let subs = activeSubscribers.get(effectiveKey);
    if (!subs) {
        subs = new Set<SubscriberCallback>();
        activeSubscribers.set(effectiveKey, subs);
    }
    subs.add(callback);

    // 1. Synchronous check in memoryCache (0ms instant delivery)
    if (memoryCache.has(effectiveKey)) {
        const memData = memoryCache.get(effectiveKey);
        emittedFromCache = true;
        callback(createFakeSnapshot(memData, refObj.key), true);
    } else {
        // 2. Synchronous check in localStorage for small keys
        const storage = getLocalStorage();
        if (storage) {
            const cached = storage.getItem(`fb_cache_${effectiveKey}`);
            if (cached && cached !== "undefined") {
                try {
                    const parsed = JSON.parse(cached);
                    memoryCache.set(effectiveKey, parsed);
                    memorySignatures.set(effectiveKey, computeQuickSignature(parsed));
                    emittedFromCache = true;
                    callback(createFakeSnapshot(parsed, refObj.key), true);
                } catch (e) {
                    /* ignore */
                }
            }
        }

        // 3. Asynchronous load from IndexedDB on the phone/browser
        if (!emittedFromCache) {
            readFromIDB(effectiveKey).then((idbData) => {
                if (isUnsubscribed || emittedFromCache) return;
                if (idbData !== undefined && idbData !== null) {
                    if (!memoryCache.has(effectiveKey)) {
                        memoryCache.set(effectiveKey, idbData);
                        memorySignatures.set(effectiveKey, computeQuickSignature(idbData));
                    }
                    emittedFromCache = true;
                    callback(createFakeSnapshot(memoryCache.get(effectiveKey), refObj.key), true);
                }
            });
        }
    }

    // 4. Attach a single shared Firebase listener per path for the whole app session
    if (!activeFirebaseListeners.has(effectiveKey)) {
        let isFirstRealtimeEvent = true;
        const unsubFirebase = onValue(refObj, (snapshot: DataSnapshot) => {
            const data = snapshot.val();
            const newSig = computeQuickSignature(data);
            const prevSig = memorySignatures.get(effectiveKey);
            const prevData = memoryCache.get(effectiveKey);

            memoryCache.set(effectiveKey, data);
            memorySignatures.set(effectiveKey, newSig);
            scheduleDevicePersistence(effectiveKey, data);

            if (isFirstRealtimeEvent && prevData !== undefined && (prevData === data || (prevSig && prevSig === newSig))) {
                isFirstRealtimeEvent = false;
                return;
            }
            isFirstRealtimeEvent = false;

            const currentSubs = activeSubscribers.get(effectiveKey);
            if (currentSubs) {
                currentSubs.forEach((subCallback) => {
                    try {
                        subCallback(snapshot, false);
                    } catch (e) {
                        console.error("Error in cached value subscriber:", e);
                    }
                });
            }
        });
        activeFirebaseListeners.set(effectiveKey, unsubFirebase);
    }

    return () => {
        isUnsubscribed = true;
        const currentSubs = activeSubscribers.get(effectiveKey);
        if (currentSubs) {
            currentSubs.delete(callback);
        }
    };
};
