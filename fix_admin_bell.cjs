const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

content = content.replace(
    /<\/div>[\s]*?<\/div>[\s]*?\}\)[\s]*?<\/div>[\s]*?<button onClick=\{handleLogout\}/, // wait, there is no }) at the end
    // Let's just do a string replacement
    ""
);

