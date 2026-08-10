const fs = require('fs');
let content = fs.readFileSync('components/LeaveBalance.tsx', 'utf8');

content = content.replace(
    /if \(key === 'custom' \|\| key === 'official' \|\| key === 'penalty' \|\| key === 'summer'\) return null;/g,
    "if (key === 'custom' || key === 'official') return null;"
);

// We need to move the official leaves out of the grid and place them below weeklyDays.
content = content.replace(
    /const currentCustom = allHistory\.filter\(h => h\.userId === u\.key && \(h\.type === 'custom' \|\| h\.type === 'official'\) && new Date\(h\.date\) >= pStart && new Date\(h\.date\) <= pEnd\);/,
    "const currentCustom = allHistory.filter(h => h.userId === u.key && (h.type === 'custom') && new Date(h.date) >= pStart && new Date(h.date) <= pEnd);"
);

// Below weeklyDays
content = content.replace(
    /\{balance\.weeklyDays && balance\.weeklyDays\.length > 0 && \(\s*<div className="col-span-2 p-2 bg-purple-900\/20 rounded-xl border border-purple-500\/20 text-center mt-1">\s*<span className="text-\[10px\] text-purple-300 font-bold">إجازة أسبوعية: \{balance\.weeklyDays\.join\('، '\)\}<\/span>\s*<\/div>\s*\)\}/,
    `{balance.weeklyDays && balance.weeklyDays.length > 0 && (
                                    <div className="col-span-2 p-2 bg-purple-900/20 rounded-xl border border-purple-500/20 text-center mt-1">
                                        <span className="text-[10px] text-purple-300 font-bold">إجازة أسبوعية: {balance.weeklyDays.join('، ')}</span>
                                    </div>
                                )}
                                {(() => {
                                    const pStart = new Date(periodDate);
                                    pStart.setHours(0,0,0,0);
                                    const pEnd = getPeriodEnd(periodDate);
                                    pEnd.setHours(23,59,59,999);
                                    const currentOfficial = allHistory.filter(h => h.userId === u.key && h.type === 'official' && new Date(h.date) >= pStart && new Date(h.date) <= pEnd);
                                    const officialGroups: Record<string, number> = {};
                                    currentOfficial.forEach(c => {
                                        const lbl = c.customLabel || 'إجازة رسمية';
                                        officialGroups[lbl] = (officialGroups[lbl] || 0) + c.days;
                                    });
                                    if (Object.keys(officialGroups).length === 0) return null;
                                    return (
                                        <div className="col-span-2 flex flex-col gap-1 mt-1">
                                            {Object.entries(officialGroups).map(([lbl, days]) => (
                                                <div key={'official_'+lbl} className="p-2 bg-blue-900/20 rounded-xl border border-blue-500/20 text-center">
                                                    <span className="text-[10px] text-blue-300 font-bold">{lbl} ({days} يوم)</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}`
);

fs.writeFileSync('components/LeaveBalance.tsx', content);
