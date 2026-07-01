import { db } from './firebase';
import { ref, get, update, remove } from 'firebase/database';

async function run() {
    console.log("Starting...");
    
    // Wafaa's user ID is -OgfbbMu-amjaJZhd86X (from earlier verify output)
    const wafaaRes = await get(ref(db, 'users'));
    let wafaaId = null;
    let malakId = null;
    if (wafaaRes.exists()) {
        const users = wafaaRes.val();
        for (const uId in users) {
             if (users[uId].username === 'وفاء' || users[uId].username === 'Wafaa') wafaaId = uId;
             if (users[uId].username === 'ملك' || users[uId].username === 'Malak') malakId = uId;
        }
    }
    
    // fallback if couldn't find
    if (!wafaaId) wafaaId = '-OgfbbMu-amjaJZhd86X';
    if (!malakId) malakId = '-OggeKIQLF490T6I7Voj';

    // Delete Wafaa's target
    console.log("Deleting target for wafaa: ", wafaaId);
    await remove(ref(db, `targets/${wafaaId}`));

    // Recalculate for Malak
    console.log("Recalculating target for Malak: ", malakId);
    let malakAchieved = 0;
    const salesSnap = await get(ref(db, 'sales'));
    if (salesSnap.exists()) {
        const sales = salesSnap.val();
        for (const saleId in sales) {
            const sale = sales[saleId];
            if (sale.username === 'ملك' || sale.username === 'Malak' || sale.employeeName === 'ملك' || sale.employeeName === 'Malak') {
                if (sale.timestamp) {
                    const date = new Date(sale.timestamp);
                    // From May 1, 2026 onwards for the current month target? Wait, today is June 3, 2026.
                    // But wait, the user said "1/5/2026". "حساب المحقق من التارج و الظهور لحظيا مثل باقي الحسابات التي تم وضع لها تارجت"
                    // If target was already reset for June, calculating from May 1st will show May + June sales for Malak's target. Let's just sum all sales from May 1st, 2026.
                    if (date >= new Date('2026-05-01T00:00:00Z')) {
                       malakAchieved += (sale.total || 0);
                    }
                }
            }
        }
    }

    console.log("Malak's total achieved since May 1: ", malakAchieved);
    await update(ref(db, `targets/${malakId}`), { achieved: malakAchieved });

    console.log("Done");
    process.exit(0);
}

run().catch(console.error);
