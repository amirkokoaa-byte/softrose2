const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

// 1. Add state
content = content.replace(
    'const [showProductSalesModal, setShowProductSalesModal] = useState(false);',
    'const [showProductSalesModal, setShowProductSalesModal] = useState(false);\n    const [showProductSalesDataModal, setShowProductSalesDataModal] = useState(false);'
);

// 2. Extract first modal content and split it
// target: from `<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">` up to `                        </div>\n                    </div>\n                </div>\n            )}\n`
// Actually it's better to just do string replacements.

const datesInputs = `                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">من تاريخ</label>
                                <input type="date" className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10 text-xs" value={reportStart} onChange={e => setReportStart(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">إلى تاريخ</label>
                                <input type="date" className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10 text-xs" value={reportEnd} onChange={e => setReportEnd(e.target.value)} />
                            </div>`;

content = content.replace(datesInputs, '');

const totalsAndTableRegex = /<div className="grid grid-cols-2 gap-4 mb-6">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*\)\}/;

const match = content.match(totalsAndTableRegex);
if (match) {
    const fullMatch = match[0]; // from <div className="grid grid-cols-2 gap-4 mb-6"> to the end of the modal
    
    const showDataBtn = `</div>
                        <button onClick={() => setShowProductSalesDataModal(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-lg mt-4">اظهر البيانات</button>
                    </div>
                </div>
            )}
            
            {showProductSalesDataModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/20 w-full max-w-2xl rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh] my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-white flex items-center gap-2"><Package className="text-blue-500"/> بيانات مبيعات الأصناف</h3>
                            <button onClick={() => setShowProductSalesDataModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="flex gap-2 mb-4">
                                <input type="date" className="w-full p-1.5 rounded-lg bg-gray-800 text-white border border-white/10 text-[10px]" value={reportStart} onChange={e => setReportStart(e.target.value)} />
                                <input type="date" className="w-full p-1.5 rounded-lg bg-gray-800 text-white border border-white/10 text-[10px]" value={reportEnd} onChange={e => setReportEnd(e.target.value)} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            ${match[1]}
                        </div>
                    </div>
                </div>
            )}`;
            
    content = content.replace(fullMatch, showDataBtn);
    fs.writeFileSync('components/SalesLog.tsx', content);
    console.log("Patched product sales modal.");
} else {
    console.log("Could not find product sales modal table/totals.");
}
