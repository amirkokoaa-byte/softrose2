const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

// In getPastMonthTargetsData
content = content.replace(
    /let achievedAmount = computeAchieved\(c\.employeeName, year, month, c\.userId\);/g,
    `let achievedAmount = computeAchieved(c.employeeName, year, month, c.userId);
            const start = new Date(year, month, 1).getTime();
            const end = new Date(year, month + 1, 0, 23, 59, 59).getTime();
            const employeeSales = sales.filter(s => {
                const nameMatches = s.employeeName?.trim().toLowerCase() === c.employeeName?.trim().toLowerCase();
                const userMatches = c.userId && s.username && (s.username.replace(/[.#$/\\[\\]]/g, "_") === c.userId || s.username === c.userId);
                return (nameMatches || userMatches) && s.timestamp >= start && s.timestamp <= end;
            });
            const activeMarkets = Array.from(new Set(employeeSales.map(s => s.market))).sort().join('، ');`
);

content = content.replace(
    /achievedAmount\n            \};/g,
    `achievedAmount,
                activeMarkets
            };`
);

content = content.replace(
    /achievedAmount: number \}\[\];/g,
    `achievedAmount: number; activeMarkets?: string; }[];`
);

// In renderPastMonthTargetsList
content = content.replace(
    /<div className="text-\[11px\] text-blue-300 mt-1 font-medium break-words whitespace-normal">\{item\.market\}<\/div>/g,
    `<div className="text-[11px] text-blue-300 mt-1 font-medium break-words whitespace-normal">{item.market}</div>
                                    {item.activeMarkets && (
                                        <div className="text-[11px] text-blue-300 mt-1 font-medium break-words whitespace-normal">
                                            الفروع: {item.activeMarkets}
                                        </div>
                                    )}`
);

fs.writeFileSync('components/SalesLog.tsx', content);
