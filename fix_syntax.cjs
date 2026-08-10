const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

// I need to see exactly where I broke it.
content = content.replace(/\)\}\n            <\/div>\n\)\}/g, ")}\n            </div>\n            )}");

fs.writeFileSync('components/SalesLog.tsx', content);
