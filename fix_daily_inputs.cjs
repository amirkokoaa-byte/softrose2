const fs = require('fs');
let content = fs.readFileSync('components/DailySales.tsx', 'utf8');

// The original was value={item.price || ''}, so we don't strictly need this unless it's item.name.
// Actually we already saw value={item.price || ''} in DailySales.tsx.

fs.writeFileSync('components/DailySales.tsx', content);
