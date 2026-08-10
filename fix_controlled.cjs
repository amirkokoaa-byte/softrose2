const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

content = content.replace(
    /value=\{\(showEditBalanceModal as any\)\[key\]\}/g,
    'value={(showEditBalanceModal as any)[key] || 0}'
);

fs.writeFileSync('components/LeaveBalance.tsx', content);
