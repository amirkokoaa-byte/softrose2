const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

// For current targets
content = content.replace(
    /const totalAchieved = targetsWithAchieved\.reduce\(\(sum, t\) => sum \+ t\.achieved, 0\);/,
    `const totalAchieved = finalTargets.reduce((sum, t) => sum + t.achieved, 0);`
);

content = content.replace(
    /\{targetsWithAchieved\.length > 0 && \(/,
    `{finalTargets.length > 0 && (`
);
content = content.replace(
    /\{targetsWithAchieved\.length === 0 && <div className="text-center py-10 opacity-50 text-white">لا يوجد تارجت مسجل<\/div>\}/,
    `{finalTargets.length === 0 && <div className="text-center py-10 opacity-50 text-white">لا يوجد تارجت مسجل</div>}`
);

// For past targets
content = content.replace(
    /const totalAchieved = dataList\.reduce\(\(sum, t\) => sum \+ t\.achieved, 0\);/,
    `const totalAchieved = dataList.reduce((sum, t) => sum + t.achieved, 0);` // Wait, it already uses dataList? Let's check past targets logic.
);

fs.writeFileSync('components/SalesLog.tsx', content);
