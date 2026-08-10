const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

// 1. Add state
content = content.replace(
    /const \[exportMarket, setExportMarket\] = useState\(''\);/,
    `const [exportMarket, setExportMarket] = useState('');
    const [exportEmployee, setExportEmployee] = useState('');`
);

// 2. Update logic
content = content.replace(
    /const periodSales = sales\.filter\(s => s\.timestamp >= startTS && s\.timestamp <= endTS && \(!exportMarket \|\| s\.market === exportMarket\)\);/,
    `const periodSales = sales.filter(s => s.timestamp >= startTS && s.timestamp <= endTS && (!exportMarket || s.market === exportMarket) && (!exportEmployee || s.employeeName === exportEmployee || s.username === exportEmployee));`
);

// 3. Add to UI
content = content.replace(
    /<div><label className="block text-xs font-bold mb-1 opacity-60 text-white">الماركت \(اختياري\)<\/label><select className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white\/10" value=\{exportMarket\} onChange=\{e => setExportMarket\(e\.target\.value\)\}><option value="">كل الماركتات<\/option>\{markets\.map\(m => <option key=\{m\} value=\{m\}>\{m\}<\/option>\)\}<\/select><\/div>/,
    `<div><label className="block text-xs font-bold mb-1 opacity-60 text-white">الماركت (اختياري)</label><select className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10" value={exportMarket} onChange={e => setExportMarket(e.target.value)}><option value="">كل الماركتات</option>{markets.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div><label className="block text-xs font-bold mb-1 opacity-60 text-white">الموظف (اختياري)</label><select className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10" value={exportEmployee} onChange={e => setExportEmployee(e.target.value)}><option value="">كل الموظفين</option>{usersList.map(u => <option key={u.key} value={u.name || u.username}>{u.name || u.username}</option>)}</select></div>`
);

fs.writeFileSync('components/SalesLog.tsx', content);
