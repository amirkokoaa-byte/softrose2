const fs = require('fs');
let content = fs.readFileSync('components/InventoryLog.tsx', 'utf8');

content = content.replace(/value=\{item\.qty\}/g, "value={item.qty || ''}");

fs.writeFileSync('components/InventoryLog.tsx', content);
