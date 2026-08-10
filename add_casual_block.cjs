const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

const casualBlockCode = `
                                {(() => {
                                    const pStart = new Date(periodDate);
                                    pStart.setHours(0,0,0,0);
                                    const pEnd = getPeriodEnd(periodDate);
                                    pEnd.setHours(23,59,59,999);
                                    const currentCasual = allHistory.filter(h => h.userId === u.key && h.type === 'casual' && new Date(h.date) >= pStart && new Date(h.date) <= pEnd);
                                    if (currentCasual.length === 0) return null;
                                    const casualDays = currentCasual.reduce((sum, h) => sum + h.days, 0);
                                    return (
                                        <div className="col-span-2 p-2 bg-yellow-900/20 rounded-xl border border-yellow-500/20 text-center mt-1">
                                            <span className="text-[10px] text-yellow-300 font-bold">المسجل عارضة هذا الشهر: {casualDays} يوم</span>
                                        </div>
                                    );
                                })()}
`;

content = content.replace(
    /                                \{balance\.weeklyDays && balance\.weeklyDays\.length > 0 && \(/,
    `${casualBlockCode}\n                                {balance.weeklyDays && balance.weeklyDays.length > 0 && (`
);

fs.writeFileSync('components/LeaveBalance.tsx', content);
