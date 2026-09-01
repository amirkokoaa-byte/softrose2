const fs = require('fs');
let content = fs.readFileSync('components/CompetitorReports.tsx', 'utf8');

// 1. add state
content = content.replace(
    'const [showComparisonModal, setShowComparisonModal] = useState(false);',
    'const [showComparisonModal, setShowComparisonModal] = useState(false);\n    const [showComparisonDataModal, setShowComparisonDataModal] = useState(false);'
);

// 2. replace the table part with button, and create second modal
const regex = /<\/div>\s*<div className="flex-1 overflow-y-auto custom-scrollbar border border-white\/5 rounded-2xl bg-black\/20 p-2">([\s\S]*?)<\/div>\s*\{comparisonResults\.length > 0 && \([\s\S]*?<\/button>\s*\)\}\s*<\/div>\s*<\/div>\s*\)\}/;

const match = content.match(regex);
if (match) {
    const tableAndExport = `
                        <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/5 rounded-2xl bg-black/20 p-2">
                            ${match[1]}
                        </div>
                        {comparisonResults.length > 0 && (
                            <button 
                                onClick={handleExportComparison}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-4 rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2 mt-4"
                            >
                                <FileSpreadsheet size={20}/> تصدير مقارنة الأسعار (أحدث سعر)
                            </button>
                        )}
    `;
    
    const showDataBtn = `</div>
                        <button onClick={() => setShowComparisonDataModal(true)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition shadow-lg mt-4">اظهر البيانات</button>
                    </div>
                </div>
            )}
            
            {showComparisonDataModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="w-full max-w-4xl bg-gray-900 border border-white/20 rounded-3xl p-6 flex flex-col max-h-[95vh] shadow-2xl animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-white flex items-center gap-2"><Scale className="text-indigo-400"/> بيانات أحدث الأسعار</h3>
                            <button onClick={() => setShowComparisonDataModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        ${tableAndExport}
                    </div>
                </div>
            )}`;
            
    content = content.replace(match[0], showDataBtn);
    fs.writeFileSync('components/CompetitorReports.tsx', content);
    console.log("Patched competitor reports modal.");
} else {
    console.log("Regex match failed for competitor reports.");
}

