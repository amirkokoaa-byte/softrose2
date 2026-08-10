const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

content = content.replace(
    /<div className="flex items-center justify-between bg-gray-800 p-4 rounded-2xl border border-white\/10 shadow-lg">/g,
    '{user.role === \'admin\' && (\n<div className="flex items-center justify-between bg-gray-800 p-4 rounded-2xl border border-white/10 shadow-lg">'
);
content = content.replace(
    /<button onClick=\{\(\) => handleDeleteSales\(\)\} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition text-xs shadow-xl"><Trash2 size=\{14\}\/> حذف المحدد<\/button>\n                    <\/div>\n                \)\}\n            <\/div>/g,
    '<button onClick={() => handleDeleteSales()} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition text-xs shadow-xl"><Trash2 size={14}/> حذف المحدد</button>\n                    </div>\n                )}\n            </div>\n)}'
);

content = content.replace(
    /        <input type="checkbox" className="w-5 h-5 accent-blue-500 rounded"/g,
    '        {user.role === \'admin\' && <input type="checkbox" className="w-5 h-5 accent-blue-500 rounded"'
);
content = content.replace(
    /                   else setSelectedSalesIds\(prev => prev\.filter\(id => id !== sale\.id\)\);\n               \}\} \/>/g,
    '                   else setSelectedSalesIds(prev => prev.filter(id => id !== sale.id));\n               }} />\n        }'
);

fs.writeFileSync('components/SalesLog.tsx', content);
