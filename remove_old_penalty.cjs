const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

const regex = /\/\/ Check penalty in current month[\s\S]*?return \(/;
content = content.replace(regex, 'return (');

const regex2 = /\{penaltyText && <span className="absolute bottom-1 text-\[8px\] text-red-500 font-bold bg-red-500\/10 px-1 rounded">\{penaltyText\}<\/span>\}/g;
content = content.replace(regex2, '');

fs.writeFileSync('components/LeaveBalance.tsx', content);
