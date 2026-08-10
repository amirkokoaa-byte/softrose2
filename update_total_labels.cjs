const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

content = content.replace(
    /<div className="font-bold text-white text-lg">الإجمالي لجميع الحسابات<\/div>/g,
    '<div className="font-bold text-white text-lg">{targetPrintEmployee ? "الإجمالي المحقق" : "الإجمالي لجميع الحسابات"}</div>'
);

fs.writeFileSync('components/SalesLog.tsx', content);
