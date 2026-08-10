const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

content = content.replace(
    /d\.toLocaleDateString\('ar-EG'\)/g,
    `d.toLocaleDateString('en-US')`
);

fs.writeFileSync('components/LeaveBalance.tsx', content);
