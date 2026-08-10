const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

content = content.replace(/value=\{item\.name\}/g, "value={item.name || ''}");
content = content.replace(/value=\{item\.price\}/g, "value={item.price || ''}");
content = content.replace(/value=\{item\.qty\}/g, "value={item.qty || ''}");

fs.writeFileSync('components/SalesLog.tsx', content);
