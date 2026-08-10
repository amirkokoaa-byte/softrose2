const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

const targetHeaderOld = `
                            <button 
                                onClick={() => handleDownloadImage(false)}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition h-[40px]"
                                title="تحميل صورة"
                            >
                                <Printer size={14}/> تحميل كصورة
                            </button>
                        </div>
`;

// It might be handleDownloadImage() because we replaced it. Let's do a more robust regex.
content = content.replace(
    /                            <button \n                                onClick=\{\(\) => setSelectedTargetMonth\('current'\)\}[\s\S]*?<\/button>\s*<button \n                                onClick=\{[\s\S]*?\}\n                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2\.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1\.5 transition h-\[40px\]"\n                                title="تحميل صورة"\n                            >\n                                <Printer size=\{14\}\/> تحميل كصورة\n                            <\/button>\n                        <\/div>/,
    `                            <button 
                                onClick={() => setSelectedTargetMonth('current')}
                                className={\`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition h-[40px] \${
                                    selectedTargetMonth === 'current' 
                                        ? 'bg-orange-600 text-white cursor-default' 
                                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                                }\`}
                            >
                                <Target size={14}/> الشهر الحالي
                            </button>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-black opacity-50 uppercase mb-1 text-white">تحديد اسم</label>
                                <select 
                                    className="w-full p-2.5 rounded-xl bg-gray-800 text-white border border-white/10 text-xs font-bold"
                                    value={targetPrintEmployee} 
                                    onChange={e => setTargetPrintEmployee(e.target.value)}
                                >
                                    <option value="">الكل</option>
                                    {usersList.map(u => <option key={u.key} value={u.key}>{u.name}</option>)}
                                </select>
                            </div>
                            <button 
                                onClick={() => handleDownloadImage(false)}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition h-[40px]"
                                title="تحميل صورة"
                            >
                                <Printer size={14}/> تحميل
                            </button>
                            {targetPrintEmployee && (
                                <button 
                                    onClick={() => handleDownloadImage(true)}
                                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition h-[40px]"
                                    title="مشاركة WhatsApp"
                                >
                                    <Share2 size={14}/> WhatsApp
                                </button>
                            )}
                        </div>`
);

// We need to make sure the grid columns are updated from md:grid-cols-3 to 5 if needed, but the container has `grid-cols-1 md:grid-cols-3`. Let's just change it to md:grid-cols-5.
content = content.replace(/className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-4 items-end"/, 'className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4 items-end"');

fs.writeFileSync('components/SalesLog.tsx', content);
