const fs = require('fs');

// 1. DailySales.tsx
let dsContent = fs.readFileSync('components/DailySales.tsx', 'utf8');
dsContent = dsContent.replace(
    /await push\(salesRef, saleData\);/,
    `await push(salesRef, saleData);
            
            // Push Notification to Admin
            const adminAlertRef = ref(db, 'notifications/admin_alerts');
            const now = new Date();
            await push(adminAlertRef, {
                type: 'admin_alert',
                actionType: 'sales',
                message: \`قام \${user.name || user.username} بتسجيل مبيعات جديدة في \${selectedMarket || 'بدون ماركت'}\`,
                sender: user.name || user.username,
                timestamp: now.getTime(),
                dateString: now.toLocaleDateString('ar-EG', { weekday: 'long' }) + ' ' + now.toLocaleDateString('ar-EG'),
                timeString: now.toLocaleTimeString('ar-EG'),
                isRead: false
            });`
);
fs.writeFileSync('components/DailySales.tsx', dsContent);


// 2. CompetitorPrices.tsx
let cpContent = fs.readFileSync('components/CompetitorPrices.tsx', 'utf8');
cpContent = cpContent.replace(
    /await update\(ref\(db\), updates\);/,
    `await update(ref(db), updates);
        
        // Push Notification to Admin
        const adminAlertRef = ref(db, 'notifications/admin_alerts');
        const now = new Date();
        await push(adminAlertRef, {
            type: 'admin_alert',
            actionType: 'prices',
            message: \`قام \${user.name || user.username} بتسجيل أسعار منافسين جديدة.\`,
            sender: user.name || user.username,
            timestamp: now.getTime(),
            dateString: now.toLocaleDateString('ar-EG', { weekday: 'long' }) + ' ' + now.toLocaleDateString('ar-EG'),
            timeString: now.toLocaleTimeString('ar-EG'),
            isRead: false
        });`
);
fs.writeFileSync('components/CompetitorPrices.tsx', cpContent);

