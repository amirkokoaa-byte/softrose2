const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

content = content.replace(
    /<div className="relative">[\s]*?<button onClick=\{[\s\S]*?className="relative p-2 rounded-full hover:bg-white\/10">/,
    `{user.role === 'admin' && (<div className="relative">
                <button onClick={() => {
        setShowNotifDropdown(!showNotifDropdown);
        if (!showNotifDropdown && user.role === 'admin') {
            // mark all as read
            notifications.filter(n => !n.isRead).forEach(n => {
                if (n.notifPath) update(ref(db, n.notifPath), { isRead: true });
            });
            setUnreadCount(0);
        }
    }} className="relative p-2 rounded-full hover:bg-white/10">`
);

content = content.replace(
    /<\/div>[\s]*?<\/div>[\s]*?<\/div>[\s]*?\)\}[\s]*?<\/div>[\s]*?<button onClick=\{handleLogout\}/,
    `</div>
                    </div>
                )}
            </div>)}
            
            <button onClick={handleLogout}`
);

fs.writeFileSync('App.tsx', content);
