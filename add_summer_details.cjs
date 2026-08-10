const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

const summerDetailsCode = `
                                {(() => {
                                    const pStart = new Date(periodDate);
                                    pStart.setHours(0,0,0,0);
                                    const pEnd = getPeriodEnd(periodDate);
                                    pEnd.setHours(23,59,59,999);
                                    const currentSummer = allHistory.filter(h => h.userId === u.key && h.type === 'summer' && new Date(h.date) >= pStart && new Date(h.date) <= pEnd);
                                    if (currentSummer.length === 0) return null;
                                    return (
                                        <div className="col-span-2 flex flex-col gap-1 mt-1">
                                            {currentSummer.map(p => (
                                                <div key={'summer_'+p.id} className="p-2 bg-teal-900/20 rounded-xl border border-teal-500/20 text-center flex justify-between px-4">
                                                    <span className="text-[10px] text-teal-300 font-bold">إجازة مصيف ({p.date})</span>
                                                    <span className="text-[10px] text-teal-300 font-bold">مخصوم {p.days} يوم من السنوي</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
`;

content = content.replace(
    /                                \}\)\(\)\}\s*<\/div>\s*<\/div>\s*\);\s*\}\)\}/,
    `                                })()}\n${summerDetailsCode}\n                            </div>\n                        </div>\n                    );\n                }}`
);

fs.writeFileSync('components/LeaveBalance.tsx', content);
