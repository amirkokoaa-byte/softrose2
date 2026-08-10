const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

content = content.replace(
    /<button \n                            onClick=\{\(\) => setShowWeeklyModal\(true\)\} \n                            className="bg-purple-600 text-white px-5 py-2.5 rounded-2xl font-bold shadow-xl flex items-center gap-2 active:scale-95 transition"\n                        >\n                            <CalendarPlus size=\{18\} \/> إجازات أسبوعية\n                        <\/button>/g,
    '{user.role === \'admin\' && (\n<button onClick={() => setShowWeeklyModal(true)} className="bg-purple-600 text-white px-5 py-2.5 rounded-2xl font-bold shadow-xl flex items-center gap-2 active:scale-95 transition"><CalendarPlus size={18} /> إجازات أسبوعية</button>\n)}'
);

fs.writeFileSync('components/LeaveBalance.tsx', content);
