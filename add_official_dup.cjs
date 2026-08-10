const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

content = content.replace(
    /if \(leaveType === 'official'\) \{\n            const ts = new Date\(leaveDate\)\.getTime\(\);\n            const updates: any = \{\};/,
    `if (leaveType === 'official') {
            const isOfficialDuplicate = allHistory.some(r => r.date === leaveDate && r.type === 'official');
            if (isOfficialDuplicate) return alert("تم تسجيل إجازة رسمية في هذا اليوم مسبقاً");
            const ts = new Date(leaveDate).getTime();
            const updates: any = {};`
);

fs.writeFileSync('components/LeaveBalance.tsx', content);
