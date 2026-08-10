const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

// Add visibleCount state
content = content.replace(
    /const \[selectedSalesIds, setSelectedSalesIds\] = useState<string\[\]>\(\[\]\);/,
    `const [selectedSalesIds, setSelectedSalesIds] = useState<string[]>([]);
    const [visibleCount, setVisibleCount] = useState(15);`
);

content = content.replace(
    /setReportStart\(''\); setReportEnd\(''\);\n    \};/,
    `setReportStart(''); setReportEnd(''); setVisibleCount(15);
    };`
);

const renderMapPattern = /\{filteredSales\.map\(sale => \(/;
content = content.replace(
    renderMapPattern,
    `{filteredSales.slice(0, visibleCount).map(sale => (`
);

content = content.replace(
    /\}\)\}\n            <\/div>\n            \n            \{\/\* نافذة تعديل المبيعات \*\/\}/,
    `}))}
                {visibleCount < filteredSales.length && (
                    <div className="flex justify-center mt-6 mb-6">
                        <button onClick={() => setVisibleCount(v => v + 15)} className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/50 px-8 py-3 rounded-2xl font-bold shadow-lg transition">
                            عرض المزيد
                        </button>
                    </div>
                )}
            </div>
            
            {/* نافذة تعديل المبيعات */}`
);

fs.writeFileSync('components/SalesLog.tsx', content);
