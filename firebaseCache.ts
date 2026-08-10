import { ref, onValue, DatabaseReference, DataSnapshot } from "firebase/database";

const getLocalStorage = () => {
    try {
        return window.localStorage;
    } catch (e) {
        return null;
    }
};

export const onCachedValue = (
    refObj: DatabaseReference,
    cacheKey: string,
    callback: (snapshot: any, isCached?: boolean) => void
) => {
    const storage = getLocalStorage();
    
    if (storage) {
        const cached = storage.getItem(`fb_cache_${cacheKey}`);
        if (cached && cached !== "undefined") {
            try {
                const parsed = JSON.parse(cached);
                const fakeSnapshot = {
                    exists: () => parsed !== null && (typeof parsed === 'object' ? Object.keys(parsed).length > 0 : true),
                    val: () => parsed,
                    key: refObj.key,
                    forEach: (childAction: any) => {
                        if (parsed && typeof parsed === 'object') {
                            Object.keys(parsed).forEach(key => {
                                childAction({
                                    key,
                                    val: () => parsed[key]
                                });
                            });
                        }
                    }
                };
                callback(fakeSnapshot, true);
            } catch (e) {
                /* ignore */
            }
        }
    }

    const unsubscribe = onValue(refObj, (snapshot: DataSnapshot) => {
        const data = snapshot.val();
        if (storage) {
            if (data !== null) {
                storage.setItem(`fb_cache_${cacheKey}`, JSON.stringify(data));
            } else {
                storage.removeItem(`fb_cache_${cacheKey}`);
            }
        }
        callback(snapshot, false);
    });

    return unsubscribe;
};
