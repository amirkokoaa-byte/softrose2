const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

content = content.replace(
    /if \(leaveType === 'summer'\) \{\n            cur\['annual'\] = Number\(cur\['annual'\] \|\| 0\) - Number\(leaveDays\);\n        \}/,
    `if (leaveType === 'summer') {
            if (Number(cur['annual'] || 0) > 0) {
                cur['annual'] = Number(cur['annual'] || 0) - Number(leaveDays);
            }
        }`
);

fs.writeFileSync('components/LeaveBalance.tsx', content);
