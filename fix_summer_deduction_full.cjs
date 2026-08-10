const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

content = content.replace(
    /if \(leaveType === 'summer'\) \{\n            if \(Number\(cur\['annual'\] \|\| 0\) > 0\) \{\n                cur\['annual'\] = Number\(cur\['annual'\] \|\| 0\) - Number\(leaveDays\);\n            \}\n        \}/,
    `let deductedFromAnnual = false;
        if (leaveType === 'summer') {
            if (Number(cur['annual'] || 0) > 0) {
                cur['annual'] = Number(cur['annual'] || 0) - Number(leaveDays);
                deductedFromAnnual = true;
            }
        }`
);

content = content.replace(
    /if \(leaveType === 'custom'\) \{\n            newLeaveData\.customLabel = customLeaveName\.trim\(\);\n        \}/,
    `if (leaveType === 'custom') {
            newLeaveData.customLabel = customLeaveName.trim();
        }
        if (leaveType === 'summer') {
            newLeaveData.deductedFromAnnual = deductedFromAnnual;
        }`
);

content = content.replace(
    /if \(record\.type === 'summer'\) \{\n                await update\(balanceRef, \{ 'annual': \(Number\(bal\['annual'\]\) \|\| 0\) \+ Number\(record\.days\) \}\);\n            \}/,
    `if (record.type === 'summer') {
                if (record.deductedFromAnnual !== false) {
                    await update(balanceRef, { 'annual': (Number(bal['annual']) || 0) + Number(record.days) });
                }
            }`
);

fs.writeFileSync('components/LeaveBalance.tsx', content);
