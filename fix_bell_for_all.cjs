const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

// Remove {user.role === 'admin' && (
content = content.replace(
    /\{user\.role === 'admin' && \(<div className="relative">/,
    `<div className="relative">`
);

// Remove )}
content = content.replace(
    /<\/div>\)\}\s*<button onClick=\{handleLogout\}/,
    `</div>\n            \n            <button onClick={handleLogout}`
);

fs.writeFileSync('App.tsx', content);
