const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

// Update App.tsx to subscribe to admin notifications if user is admin
content = content.replace(
    /const unsubNotifs = onCachedValue\(ref\(db, \`notifications\/\$\{user\.username\}\`\), \`notifs_\$\{user\.username\}\`, \(snapshot\) => \{([\s\S]*?)\}\);/g,
    `const fetchNotifs = () => {
        let allNotifs: any[] = [];
        const process = () => {
            const sorted = allNotifs.sort((a,b) => b.timestamp - a.timestamp);
            setNotifications(sorted);
            setUnreadCount(sorted.filter(n => !n.isRead).length);
        };

        const unsubUser = onCachedValue(ref(db, \`notifications/\${user.username}\`), \`notifs_\${user.username}\`, (snapshot) => {
            allNotifs = allNotifs.filter(n => n.type === 'admin_alert'); // clear old user notifs
            if(snapshot.exists()) {
                const data = snapshot.val();
                const list = Object.keys(data).map(key => ({ id: key, notifPath: \`notifications/\${user.username}/\${key}\`, ...data[key] }));
                allNotifs = [...allNotifs, ...list];
            }
            process();
        });

        let unsubAdmin = () => {};
        if (user.role === 'admin') {
            unsubAdmin = onCachedValue(ref(db, \`notifications/admin_alerts\`), \`notifs_admin\`, (snapshot) => {
                allNotifs = allNotifs.filter(n => n.type !== 'admin_alert'); // clear old admin notifs
                if(snapshot.exists()) {
                    const data = snapshot.val();
                    const list = Object.keys(data).map(key => ({ id: key, notifPath: \`notifications/admin_alerts/\${key}\`, type: 'admin_alert', ...data[key] }));
                    allNotifs = [...allNotifs, ...list];
                }
                process();
            });
        }
        return () => { unsubUser(); unsubAdmin(); };
    };
    const unsubNotifs = fetchNotifs();`
);

content = content.replace(
    /update\(ref\(db, \`notifications\/\$\{user\.username\}\/\$\{id\}\`\), \{ isRead: true \}\);/g,
    `const notif = notifications.find(n => n.id === id);
    if (notif && notif.notifPath) {
        update(ref(db, notif.notifPath), { isRead: true });
    } else {
        update(ref(db, \`notifications/\${user.username}/\${id}\`), { isRead: true });
    }`
);

content = content.replace(
    /remove\(ref\(db, \`notifications\/\$\{user\.username\}\/\$\{id\}\`\)\);/g,
    `const notif = notifications.find(n => n.id === id);
    if (notif && notif.notifPath) {
        remove(ref(db, notif.notifPath));
    } else {
        remove(ref(db, \`notifications/\${user.username}/\${id}\`));
    }`
);

// We should also automatically mark all as read when opening dropdown if admin?
// "في حالة فتح الـ Admin لقائمة الإشعارات، يتم مسح الأرقام من على أيقونة الجرس وتصفير العداد."
content = content.replace(
    /setShowNotifDropdown\(!showNotifDropdown\)/,
    `() => {
        setShowNotifDropdown(!showNotifDropdown);
        if (!showNotifDropdown && user.role === 'admin') {
            // mark all as read
            notifications.filter(n => !n.isRead).forEach(n => {
                if (n.notifPath) update(ref(db, n.notifPath), { isRead: true });
            });
            setUnreadCount(0);
        }
    }`
);

fs.writeFileSync('App.tsx', content);
