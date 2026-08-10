const fs = require('fs');
let content = fs.readFileSync('components/CompetitorReports.tsx', 'utf8');

content = content.replace(/value=\{item\.name\}/g, "value={item.name || ''}");
content = content.replace(/value=\{item\.price\}/g, "value={item.price || ''}");

fs.writeFileSync('components/CompetitorReports.tsx', content);
