const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

const penaltyDetailsCode = `
                                {(() => {
                                    const pStart = new Date(periodDate);
                                    pStart.setHours(0,0,0,0);
                                    const pEnd = getPeriodEnd(periodDate);
                                    pEnd.setHours(23,59,59,999);
                                    const currentPenalty = allHistory.filter(h => h.userId === u.key && h.type === 'penalty' && new Date(h.date) >= pStart && new Date(h.date) <= pEnd);
                                    if (currentPenalty.length === 0) return null;
                                    return (
                                        <div className="col-span-2 flex flex-col gap-1 mt-1">
                                            {currentPenalty.map(p => (
                                                <div key={'penalty_'+p.id} className="p-2 bg-red-900/20 rounded-xl border border-red-500/20 text-center flex justify-between px-4">
                                                    <span className="text-[10px] text-red-300 font-bold">جزاء ({p.date})</span>
                                                    <span className="text-[10px] text-red-300 font-bold">{p.days} يوم</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}
`;

content = content.replace(
    /                                \}\)\(\)\}\s*<\/div>\s*<\/div>\s*\);\s*\}\)\}/,
    `                                })()}\n${penaltyDetailsCode}\n                            </div>\n                        </div>\n                    );\n                }}`
);

fs.writeFileSync('components/LeaveBalance.tsx', content);
