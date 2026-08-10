const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

content = content.replace(
    /\{user\.role === 'admin' && \(\n<div className="flex items-center justify-between bg-gray-800 p-4 rounded-2xl border border-white\/10 shadow-lg">/g,
    '<div className="flex items-center justify-between bg-gray-800 p-4 rounded-2xl border border-white/10 shadow-lg">'
);

content = content.replace(
    /        \{user\.role === 'admin' && <input type="checkbox" className="w-5 h-5 accent-blue-500 rounded"[\s\S]*?\} \/>\n        \}/g,
    `        <input type="checkbox" className="w-5 h-5 accent-blue-500 rounded"
               checked={selectedSalesIds.includes(sale.id)} 
               onChange={e => {
                   if (e.target.checked) setSelectedSalesIds(prev => [...prev, sale.id]);
                   else setSelectedSalesIds(prev => prev.filter(id => id !== sale.id));
               }} />`
);

fs.writeFileSync('components/SalesLog.tsx', content);
