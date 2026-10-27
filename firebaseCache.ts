import { ref, onValue, DatabaseReference, DataSnapshot } from "firebase/database";

const memoryCache = new Map<string, any>();
const pendingStorageTimers = new Map<string, ReturnType<typeof setTimeout>>();

const getLocalStorage = () => {
    try {
        return window.localStorage;
    } catch (e) {
        return null;
    }
};

const createFakeSnapshot = (parsed: any, key: string | null): any => ({
    exists: () => parsed !== null && parsed !== undefined && (typeof parsed === 'object' ? Object.keys(parsed).length > 0 : true),
    val: () => parsed,
    key,
    forEach: (childAction: any) => {
        if (parsed && typeof parsed === 'object') {
            Object.keys(parsed).forEach(k => {
                childAction(createFakeSnapshot(parsed[k], k));
            });
        }
    }
});

const scheduleLocalStorageWrite = (cacheKey: string, data: any) => {
    const storage = getLocalStorage();
    if (!storage) return;

    const existingTimer = pendingStorageTimers.get(cacheKey);
    if (existingTimer) clearTimeout(existingTimer);

    const timer = setTimeout(() => {
        pendingStorageTimers.delete(cacheKey);
        try {
            if (data !== null && data !== undefined) {
                storage.setItem(`fb_cache_${cacheKey}`, JSON.stringify(data));
            } else {
                storage.removeItem(`fb_cache_${cacheKey}`);
            }
        } catch (e) {
            /* ignore quota or storage errors */
        }
    }, 250);

    pendingStorageTimers.set(cacheKey, timer);
};

const getEffectiveCacheKey = (refObj: DatabaseReference, fallbackKey: string): string => {
    try {
        const urlStr = refObj.toString();
        const pathPart = urlStr.replace(/^https?:\/\/[^/]+\/?/, '').replace(/[/.#$[\]]/g, '_');
        if (pathPart) return pathPart;
    } catch (e) {
        /* ignore */
    }
    return fallbackKey;
};

export const onCachedValue = (
    refObj: DatabaseReference,
    cacheKey: string,
    callback: (snapshot: any, isCached?: boolean) => void
) => {
    const effectiveKey = getEffectiveCacheKey(refObj, cacheKey);
    let emittedFromCache = false;

    if (memoryCache.has(effectiveKey)) {
        const memData = memoryCache.get(effectiveKey);
        emittedFromCache = true;
        callback(createFakeSnapshot(memData, refObj.key), true);
    } else {
        const storage = getLocalStorage();
        if (storage) {
            const cached = storage.getItem(`fb_cache_${effectiveKey}`);
            if (cached && cached !== "undefined") {
                try {
                    const parsed = JSON.parse(cached);
                    memoryCache.set(effectiveKey, parsed);
                    emittedFromCache = true;
                    callback(createFakeSnapshot(parsed, refObj.key), true);
                } catch (e) {
                    /* ignore */
                }
            }
        }
    }

    let isFirstRealtimeEvent = true;

    const unsubscribe = onValue(refObj, (snapshot: DataSnapshot) => {
        const data = snapshot.val();
        const prevData = memoryCache.get(effectiveKey);
        memoryCache.set(effectiveKey, data);
        scheduleLocalStorageWrite(effectiveKey, data);

        if (isFirstRealtimeEvent && emittedFromCache && prevData === data) {
            isFirstRealtimeEvent = false;
            return;
        }
        isFirstRealtimeEvent = false;
        callback(snapshot, false);
    });

    return unsubscribe;
};

