const fs = require('fs');
let content = fs.readFileSync('components/InventoryRegistration.tsx', 'utf8');

content = content.replace(/value=\{item\.name\}/g, "value={item.name || ''}");

fs.writeFileSync('components/InventoryRegistration.tsx', content);
