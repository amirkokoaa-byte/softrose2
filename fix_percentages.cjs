const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

// For current targets
content = content.replace(
    /<span className="font-black text-green-400">\{totalAchieved\.toLocaleString\(\)\}<\/span>/g,
    `<div className="flex items-center gap-2 justify-end"><span className="font-black text-green-400">{totalAchieved.toLocaleString()}</span><span className="text-xs text-orange-400 font-bold">({totalPerc}%)</span></div>`
);

// For past targets which might have " ج.م"
content = content.replace(
    /<span className="font-black text-green-400">\{totalAchieved\.toLocaleString\(\)\} ج\.م<\/span>/g,
    `<div className="flex items-center gap-2 justify-end"><span className="font-black text-green-400">{totalAchieved.toLocaleString()} ج.م</span><span className="text-xs text-orange-400 font-bold">({totalPerc}%)</span></div>`
);

fs.writeFileSync('components/SalesLog.tsx', content);
