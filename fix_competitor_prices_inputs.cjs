const fs = require('fs');
let content = fs.readFileSync('components/CompetitorPrices.tsx', 'utf8');

content = content.replace(/value=\{currentName\}/g, "value={currentName || ''}");

fs.writeFileSync('components/CompetitorPrices.tsx', content);
