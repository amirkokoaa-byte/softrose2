const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

content = content.replace(
    /const typeLogic: any = \{.*?\};/,
    "const typeLogic: any = { annual: 'remaining', casual: 'remaining', sick: 'accrued', exams: 'accrued', unpaid: 'accrued', custom: 'remaining', penalty: 'accrued', official: 'none', summer: 'accrued' };"
);
content = content.replace(
    /const typeLabels: any = \{.*?\};/,
    "const typeLabels: any = { annual: 'سنوي', casual: 'عارضة', sick: 'مرضي', exams: 'امتحانات', unpaid: 'غياب بأذن', penalty: 'جزاء', official: 'إجازة رسمية', summer: 'إجازة مصيف' };"
);
content = content.replace(
    /const typeColors: any = \{.*?\};/,
    "const typeColors: any = { annual: 'text-green-400', casual: 'text-yellow-400', sick: 'text-red-400', exams: 'text-purple-400', unpaid: 'text-orange-400', custom: 'text-cyan-400', penalty: 'text-red-600', official: 'text-blue-400', summer: 'text-teal-400' };"
);

const handleAddLeaveRegex = /if \(typeLogic\[targetBalanceField\] === 'remaining'\) \{\s*cur\[targetBalanceField\] = Number\(cur\[targetBalanceField\] \|\| 0\) - Number\(leaveDays\);\s*\} else if \(typeLogic\[targetBalanceField\] === 'accrued'\) \{\s*cur\[targetBalanceField\] = Number\(cur\[targetBalanceField\] \|\| 0\) \+ Number\(leaveDays\);\s*\}/;
const handleAddLeaveReplace = `if (typeLogic[targetBalanceField] === 'remaining') {
            cur[targetBalanceField] = Number(cur[targetBalanceField] || 0) - Number(leaveDays);
        } else if (typeLogic[targetBalanceField] === 'accrued') {
            cur[targetBalanceField] = Number(cur[targetBalanceField] || 0) + Number(leaveDays);
        }
        if (leaveType === 'summer') {
            cur['annual'] = Number(cur['annual'] || 0) - Number(leaveDays);
        }`;
content = content.replace(handleAddLeaveRegex, handleAddLeaveReplace);

const handleDeleteRegex = /await update\(balanceRef, \{ \[record\.type\]: \(Number\(bal\[record\.type\]\) \|\| 0\) \+ \(multiplier \* Number\(record\.days\)\) \}\);/g;
const handleDeleteReplace = `await update(balanceRef, { [record.type]: (Number(bal[record.type]) || 0) + (multiplier * Number(record.days)) });
            if (record.type === 'summer') {
                await update(balanceRef, { 'annual': (Number(bal['annual']) || 0) + Number(record.days) });
            }`;
content = content.replace(handleDeleteRegex, handleDeleteReplace);

const successAlertRegex = /alert\("تم تسجيل العملية بنجاح"\);/g;
const successAlertReplace = `if (leaveType === 'penalty') {
            alert("تم الحفظ");
        } else {
            alert("تم تسجيل العملية بنجاح");
        }`;
content = content.replace(successAlertRegex, successAlertReplace);

// Remove custom, official, penalty, summer filtering so we can display them differently
const objectEntriesRegex = /if \(key === 'custom' \|\| key === 'official' \|\| key === 'penalty'\) return null;/g;
const objectEntriesReplace = `if (key === 'custom' || key === 'official' || key === 'penalty' || key === 'summer') return null;`;
content = content.replace(objectEntriesRegex, objectEntriesReplace);

fs.writeFileSync('components/LeaveBalance.tsx', content);
