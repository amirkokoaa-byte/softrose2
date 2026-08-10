const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

content = content.replace(
    /\s*\)\}\s*<div className="space-y-4">/,
    '\n            <div className="space-y-4">'
);
content = content.replace(
    /else setSelectedSalesIds\(prev => prev\.filter\(id => id !== sale\.id\)\);\s*\}\} \/>\s*\)\}\s*<div className="font-bold text-xl text-blue-400">\{sale\.market\}<\/div>/g,
    `else setSelectedSalesIds(prev => prev.filter(id => id !== sale.id));
               }} />
        <div className="font-bold text-xl text-blue-400">{sale.market}</div>`
);

fs.writeFileSync('components/SalesLog.tsx', content);
