const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

content = content.replace(
    /\s*\}\)\}\s*<div className="space-y-4">/,
    '\n            <div className="space-y-4">'
);

fs.writeFileSync('components/SalesLog.tsx', content);
