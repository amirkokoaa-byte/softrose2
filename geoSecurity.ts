/**
 * Geolocation Security & Geofencing Module (Phase 4)
 * - Haversine Great-Circle Distance Calculation
 * - Multi-Layer Anti-Fake GPS Detection (Time-to-Fix, Accuracy Radius Anomaly, Mock Flags, Teleportation)
 * - Strict 1000m Geofencing Enforcement
 */

export interface GeoCoordinates {
    lat: number;
    lon: number;
}

export interface AntiFakeResult {
    isSuspicious: boolean;
    confidence: 'clean' | 'suspicious';
    reason?: string;
    details: {
        accuracy: number;
        timeToFixMs: number;
        isMockedFlag: boolean;
        impossibleSpeed: boolean;
        abnormalAccuracy: boolean;
    };
}

export interface LocationValidationResult {
    success: boolean;
    distanceMeters?: number;
    nearestBranchName?: string;
    errorMessage?: string;
    isFakeSuspected?: boolean;
    fakeReason?: string;
    userCoords?: GeoCoordinates;
}

/**
 * Calculates the great-circle distance between two geographic points using the Haversine formula.
 * @param lat1 Latitude of point 1 in degrees
 * @param lon1 Longitude of point 1 in degrees
 * @param lat2 Latitude of point 2 in degrees
 * @param lon2 Longitude of point 2 in degrees
 * @returns Distance in meters
 */
export function calculateHaversineDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
): number {
    const R = 6371e3; // Earth radius in meters
    const toRad = (degrees: number) => (degrees * Math.PI) / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in meters
}

/**
 * Parses coordinate string like "30.0444, 31.2357" or "30.0444 31.2357"
 */
export function parseCoordinates(coordString: string): GeoCoordinates | null {
    if (!coordString || typeof coordString !== 'string') return null;
    const clean = coordString.replace(/[^\d.,\-+ ]/g, '').trim();
    const parts = clean.split(/[\s,]+/).map(p => parseFloat(p.trim()));

    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const lat = parts[0];
        const lon = parts[1];
        if (lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180) {
            return { lat, lon };
        }
    }
    return null;
}

/**
 * High-accuracy GPS acquisition with multi-layered Anti-Fake GPS heuristics
 */
export function acquireSecurePosition(): Promise<{
    position: GeolocationPosition;
    antiFake: AntiFakeResult;
}> {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            return reject(new Error('متصفحك لا يدعم تحديد الموقع الجغرافي (Geolocation).'));
        }

        const requestStartTime = performance.now();

        const options: PositionOptions = {
            enableHighAccuracy: true, // Forces hardware GPS sensor activation
            timeout: 15000,           // Maximum 15 seconds to establish GPS lock
            maximumAge: 0             // Strict fresh satellite reading, no stale cache
        };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const timeToFixMs = Math.round(performance.now() - requestStartTime);
                const coords = position.coords;

                // --- LAYER 1: Explicit Mock Location Flags (Chromium/Android WebViews) ---
                const rawCoords = coords as any;
                const isMockedFlag = Boolean(
                    rawCoords.isMocked ||
                    (position as any).mocked ||
                    rawCoords.mocked
                );

                // --- LAYER 2: Accuracy Radius Physical Validation ---
                // Real consumer phone GPS accuracy is physically between 3m and 150m.
                // An accuracy of EXACTLY 0 or negative is physically impossible on real hardware
                // and is a hallmark of software mock location injectors.
                const abnormalAccuracy = coords.accuracy <= 0 || coords.accuracy < 1.0;

                // --- LAYER 3: Impossible Teleportation / Speed Check ---
                let impossibleSpeed = false;
                try {
                    const lastCheckRaw = sessionStorage.getItem('__last_geo_verification');
                    if (lastCheckRaw) {
                        const lastCheck = JSON.parse(lastCheckRaw);
                        const timeDeltaSec = (Date.now() - lastCheck.timestamp) / 1000;
                        if (timeDeltaSec > 0 && timeDeltaSec < 3600) { // Within 1 hour
                            const travelDistance = calculateHaversineDistance(
                                lastCheck.lat,
                                lastCheck.lon,
                                coords.latitude,
                                coords.longitude
                            );
                            const speedKmH = (travelDistance / 1000) / (timeDeltaSec / 3600);
                            // If calculated speed exceeds 350 km/h between two checks
                            if (travelDistance > 500 && speedKmH > 350) {
                                impossibleSpeed = true;
                            }
                        }
                    }
                } catch {
                    // Ignore storage errors
                }

                // --- LAYER 4: Time-To-Fix vs MaximumAge=0 Heuristic ---
                // A cold GPS fix with maximumAge=0 should not resolve in less than 15 milliseconds
                // unless mock coordinates are being artificially fed.
                const suspiciousTimeToFix = timeToFixMs < 15 && coords.accuracy < 5;

                const isSuspicious = isMockedFlag || abnormalAccuracy || impossibleSpeed || suspiciousTimeToFix;

                let reason: string | undefined;
                if (isMockedFlag) {
                    reason = 'اكتشاف إشارة تزييف موقع مباشرة (Mocked flag detected)';
                } else if (abnormalAccuracy) {
                    reason = `دقة إشارة غير منطقية فيزيائياً (${coords.accuracy}m)`;
                } else if (impossibleSpeed) {
                    reason = 'قفزة مكانية مستحيلة فيزيائياً (Teleportation/Impossible speed)';
                } else if (suspiciousTimeToFix) {
                    reason = 'استجابة فورية غير حقيقية لإشارة GPS مصطنعة';
                }

                const antiFake: AntiFakeResult = {
                    isSuspicious,
                    confidence: isSuspicious ? 'suspicious' : 'clean',
                    reason,
                    details: {
                        accuracy: coords.accuracy,
                        timeToFixMs,
                        isMockedFlag,
                        impossibleSpeed,
                        abnormalAccuracy
                    }
                };

                // Store current coordinates for subsequent speed validation if clean
                if (!isSuspicious) {
                    try {
                        sessionStorage.setItem('__last_geo_verification', JSON.stringify({
                            lat: coords.latitude,
                            lon: coords.longitude,
                            timestamp: Date.now()
                        }));
                    } catch {
                        // ignore
                    }
                }

                resolve({ position, antiFake });
            },
            (error) => {
                let msg = 'تعذر الحصول على الموقع الجغرافي.';
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        msg = 'تم رفض إذن الوصول إلى الموقع الجغرافي. يرجى تفعيل الـ GPS والسماح للمتصفح بالوصول لتسجيل الحضور والانصراف.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        msg = 'إشارة الموقع الجغرافي (GPS) غير متوفرة حالياً، يرجى التأكد من تشغيل الموقع والمحاولة مجدداً.';
                        break;
                    case error.TIMEOUT:
                        msg = 'استغرق تحديد الموقع وقتاً طويلاً. يرجى التأكد من قوة إشارة الـ GPS والمحاولة مجدداً.';
                        break;
                }
                reject(new Error(msg));
            },
            options
        );
    });
}

/**
 * Validates employee position against configured branch slots and performs Anti-Fake check.
 * Maximum allowed distance is strictly 1000 meters.
 */
export async function validateEmployeeGeofence(
    branchSlots: Array<{ branchName: string; coordinates: string }>,
    employeeBranchName?: string
): Promise<LocationValidationResult> {
    try {
        const { position, antiFake } = await acquireSecurePosition();

        // 1. Anti-Fake GPS verification
        if (antiFake.isSuspicious) {
            return {
                success: false,
                isFakeSuspected: true,
                fakeReason: antiFake.reason || 'اشتباه في تزييف الموقع',
                userCoords: {
                    lat: position.coords.latitude,
                    lon: position.coords.longitude
                }
            };
        }

        const userLat = position.coords.latitude;
        const userLon = position.coords.longitude;

        // 2. Extract and parse all valid branch coordinates
        const validBranches = branchSlots
            .map(slot => ({
                branchName: slot.branchName,
                coords: parseCoordinates(slot.coordinates)
            }))
            .filter((item): item is { branchName: string; coords: GeoCoordinates } => item.coords !== null);

        // If no coordinates configured at all by admin
        if (validBranches.length === 0) {
            // If admin hasn't set branch coordinates yet
            return {
                success: true, // Allow registration if admin hasn't configured coordinates yet, but log coords
                userCoords: { lat: userLat, lon: userLon }
            };
        }

        // 3. Find closest branch distance
        let closestBranch = validBranches[0];
        let minDistance = calculateHaversineDistance(
            userLat,
            userLon,
            closestBranch.coords.lat,
            closestBranch.coords.lon
        );

        for (let i = 1; i < validBranches.length; i++) {
            const branch = validBranches[i];
            const dist = calculateHaversineDistance(
                userLat,
                userLon,
                branch.coords.lat,
                branch.coords.lon
            );
            if (dist < minDistance) {
                minDistance = dist;
                closestBranch = branch;
            }
        }

        // Also check if there is a specific branch matching the employee's assigned branch
        if (employeeBranchName) {
            const matchingBranch = validBranches.find(b => b.branchName === employeeBranchName);
            if (matchingBranch) {
                const specificDist = calculateHaversineDistance(
                    userLat,
                    userLon,
                    matchingBranch.coords.lat,
                    matchingBranch.coords.lon
                );
                // If within 1000m of their specific branch, use that distance
                if (specificDist <= 1000) {
                    minDistance = specificDist;
                    closestBranch = matchingBranch;
                }
            }
        }

        const distanceMeters = Math.round(minDistance);

        // 4. Strict Geofence Check: Must be <= 1000 meters
        if (distanceMeters > 1000) {
            return {
                success: false,
                distanceMeters,
                nearestBranchName: closestBranch.branchName,
                errorMessage: 'عفواً، أنت لست في إطار الفرع.',
                userCoords: { lat: userLat, lon: userLon }
            };
        }

        return {
            success: true,
            distanceMeters,
            nearestBranchName: closestBranch.branchName,
            userCoords: { lat: userLat, lon: userLon }
        };

    } catch (err: any) {
        return {
            success: false,
            errorMessage: err.message || 'فشل التحقق من الموقع الجغرافي.'
        };
    }
}
