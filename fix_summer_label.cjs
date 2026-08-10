const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

content = content.replace(
    /<span className="text-\[10px\] text-teal-300 font-bold">مخصوم \{p\.days\} يوم من السنوي<\/span>/,
    `{p.deductedFromAnnual !== false ? (
                                                        <span className="text-[10px] text-teal-300 font-bold">مخصوم {p.days} يوم من السنوي</span>
                                                    ) : (
                                                        <span className="text-[10px] text-teal-300 font-bold">{p.days} يوم</span>
                                                    )}`
);

fs.writeFileSync('components/LeaveBalance.tsx', content);
