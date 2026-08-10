const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

content = content.replace(
    /<div className="flex items-center gap-2 justify-end"><span className="font-black text-green-400">\{totalAchieved\.toLocaleString\(\)\}<\/span><span className="text-xs text-orange-400 font-bold">\(\{totalPerc\}%\)<\/span><\/div>/g,
    `<span className="font-black text-green-400">{totalAchieved.toLocaleString()}</span>`
);

content = content.replace(
    /<div className="flex items-center gap-2 justify-end"><span className="font-black text-green-400">\{totalAchieved\.toLocaleString\(\) ج\.م\}<\/span><span className="text-xs text-orange-400 font-bold">\(\{totalPerc\}%\)<\/span><\/div>/g,
    `<span className="font-black text-green-400">{totalAchieved.toLocaleString()} ج.م</span>`
);

// Wait, I messed up the regex for "ج.م"
// let's just do standard replace
content = content.split('<div className="flex items-center gap-2 justify-end"><span className="font-black text-green-400">{totalAchieved.toLocaleString()}</span><span className="text-xs text-orange-400 font-bold">({totalPerc}%)</span></div>').join('<span className="font-black text-green-400">{totalAchieved.toLocaleString()}</span>');

content = content.split('<div className="flex items-center gap-2 justify-end"><span className="font-black text-green-400">{totalAchieved.toLocaleString()} ج.م</span><span className="text-xs text-orange-400 font-bold">({totalPerc}%)</span></div>').join('<span className="font-black text-green-400">{totalAchieved.toLocaleString()} ج.م</span>');

fs.writeFileSync('components/SalesLog.tsx', content);
