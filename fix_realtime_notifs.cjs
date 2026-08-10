const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

const oldFetchNotifs = `    const fetchNotifs = () => {
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
    const unsubNotifs = fetchNotifs();`;

const newFetchNotifs = `    const fetchNotifs = () => {
        const unsubUser = onValue(ref(db, \`notifications/\${user.username}\`), (snapshot) => {
            const data = snapshot.val();
            const list = data ? Object.keys(data).map(key => ({ id: key, notifPath: \`notifications/\${user.username}/\${key}\`, ...data[key] })) : [];
            setNotifications(prev => {
                const others = prev.filter(n => n.type === 'admin_alert');
                const newAll = [...others, ...list].sort((a,b) => b.timestamp - a.timestamp);
                setUnreadCount(newAll.filter(n => !n.isRead).length);
                return newAll;
            });
        });

        let unsubAdmin = () => {};
        if (user.role === 'admin') {
            unsubAdmin = onValue(ref(db, \`notifications/admin_alerts\`), (snapshot) => {
                const data = snapshot.val();
                const list = data ? Object.keys(data).map(key => ({ id: key, notifPath: \`notifications/admin_alerts/\${key}\`, type: 'admin_alert', ...data[key] })) : [];
                setNotifications(prev => {
                    const others = prev.filter(n => n.type !== 'admin_alert');
                    const newAll = [...others, ...list].sort((a,b) => b.timestamp - a.timestamp);
                    setUnreadCount(newAll.filter(n => !n.isRead).length);
                    return newAll;
                });
            });
        }
        return () => { unsubUser(); unsubAdmin(); };
    };
    const unsubNotifs = fetchNotifs();`;

if (content.includes(oldFetchNotifs)) {
    content = content.replace(oldFetchNotifs, newFetchNotifs);
    fs.writeFileSync('App.tsx', content);
    console.log("Updated App.tsx successfully.");
} else {
    console.log("Could not find the target code in App.tsx.");
}
