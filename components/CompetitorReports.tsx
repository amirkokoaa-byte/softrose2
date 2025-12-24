
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, remove, update } from "firebase/database";
import { User, CompetitorPrice } from '../types';
import { exportToCSV } from '../utils';
import { COMPANIES } from '../constants';
import { Trash2, Edit, Save, X, FileSpreadsheet, Columns2 } from 'lucide-react';

interface Props {
    user: User;
    markets: string[];
    theme: string;
}

const CompetitorReports: React.FC<Props> = ({ user, markets, theme }) => {
    const [data, setData] = useState<CompetitorPrice[]>([]);
    const [selectedMarket, setSelectedMarket] = useState('');
    const [selectedCompany, setSelectedCompany] = useState('');
    const [companies, setCompanies] = useState<string[]>(COMPANIES);
    const [editingReport, setEditingReport] = useState<CompetitorPrice | null>(null);

    useEffect(() => {
        onValue(ref(db, 'settings/companies'), s => {
            if(s.exists()) setCompanies(Object.values(s.val()));
        });
        onValue(ref(db, 'competitor_prices'), s => {
            if(s.exists()) {
                let arr = Object.keys(s.val()).map(key => ({
                    id: key,
                    ...s.val()[key]
                })) as CompetitorPrice[];

                // DATA PRIVACY
                if (user.role !== 'admin') {
                    arr = arr.filter(d => d.employeeName === user.name);
                }

                setData(arr);
            } else {
                setData([]);
            }
        });
    }, [user]);

    const filtered = data.filter(d => 
        (!selectedMarket || d.market === selectedMarket) &&
        (!selectedCompany || d.company === selectedCompany)
    );

    // Standard Export (Filtered data)
    const handleExport = () => {
        if (filtered.length === 0) return alert("لا توجد بيانات لتصديرها");
        const csv = filtered.flatMap(d => (d.items || []).map(i => ({
            "الماركت": d.market,
            "الشركة": d.company,
            "التاريخ": d.date,
            "بواسطة": d.employeeName || '-',
            "القسم": i.category,
            "المنتج": i.name,
            "السعر": i.price
        })));
        const fileName = selectedCompany ? `تقرير_منافسين_${selectedCompany}` : 'تقرير_المنافسين_العام';
        exportToCSV(csv, fileName);
    };

    // Horizontal Comparison Export (All companies side by side for a market)
    const handleExportHorizontal = () => {
        if (!selectedMarket) return alert("يرجى اختيار الماركت أولاً للمقارنة");
        
        // Group data by company for the selected market
        const marketData = data.filter(d => d.market === selectedMarket);
        const companyGroups: Record<string, {name: string, price: number}[]> = {};
        
        marketData.forEach(report => {
            if (!companyGroups[report.company]) companyGroups[report.company] = [];
            companyGroups[report.company].push(...report.items);
        });

        const activeCompanies = Object.keys(companyGroups);
        if (activeCompanies.length === 0) return alert("لا توجد بيانات لهذا الماركت");

        // Find max items to determine row count
        const maxRows = Math.max(...activeCompanies.map(c => companyGroups[c].length));
        
        const csvRows: any[] = [];

        for (let i = 0; i < maxRows; i++) {
            const row: Record<string, any> = {};
            activeCompanies.forEach(company => {
                const item = companyGroups[company][i];
                row[`${company} - الصنف`] = item ? item.name : "";
                row[`${company} - السعر`] = item ? item.price : "";
            });
            csvRows.push(row);
        }

        exportToCSV(csvRows, `مقارنة_عرضية_${selectedMarket}`);
    };

    const handleDelete = async (id: string) => {
        if(confirm("حذف هذا التقرير؟")) {
            await remove(ref(db, `competitor_prices/${id}`));
        }
    };

    const saveEdit = async () => {
        if(!editingReport || !editingReport.id) return;
        try {
            await update(ref(db, `competitor_prices/${editingReport.id}`), {
                items: editingReport.items
            });
            setEditingReport(null);
            alert("تم التعديل");
        } catch(e) { console.error(e); }
    };

    const updateEditItem = (index: number, price: number) => {
        if(!editingReport) return;
        const newItems = [...editingReport.items];
        newItems[index].price = price;
        setEditingReport({...editingReport, items: newItems});
    };

    const inputClass = "border p-2 rounded text-black w-full text-sm md:text-base";

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">تقارير المنافسين</h2>
            
            <div className="bg-white/5 p-4 rounded-xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs mb-1 opacity-70">فلترة بالماركت</label>
                        <select className={inputClass} value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                            <option value="">كل الماركتات</option>
                            {markets.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs mb-1 opacity-70">فلترة بالشركة</label>
                        <select className={inputClass} value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                            <option value="">كل الشركات</option>
                            {companies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-3 pt-2">
                    <button 
                        onClick={handleExport} 
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold transition shadow-lg"
                    >
                        <FileSpreadsheet size={20} /> تصدير إكسيل (طولي)
                    </button>
                    
                    {selectedMarket && (
                        <button 
                            onClick={handleExportHorizontal} 
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold transition shadow-lg border-2 border-blue-400/30"
                        >
                            <Columns2 size={20} /> تصدير مقارنة عرضية (ماركت {selectedMarket})
                        </button>
                    )}
                </div>
            </div>

            <div className="space-y-4">
                {filtered.length === 0 ? (
                    <div className="text-center py-10 opacity-50 italic">لا توجد تقارير مطابقة للبحث</div>
                ) : filtered.map((record, i) => (
                    <div key={record.id || i} className={`p-4 rounded-xl border transition-all hover:shadow-md ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100 shadow'}`}>
                        <div className="font-bold text-lg mb-2 flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-blue-600">{record.company}</span>
                                <span className="text-xs font-normal opacity-70">{record.market} | {record.date}</span>
                                <span className="text-[10px] text-gray-400">بواسطة: {record.employeeName}</span>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => setEditingReport(record)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition"><Edit size={18}/></button>
                                {(user.role === 'admin' || user.name === record.employeeName) && (
                                     <button onClick={() => handleDelete(record.id!)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={18}/></button>
                                )}
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-center">
                                <thead className="bg-gray-500/5">
                                    <tr className="border-b border-gray-500/10">
                                        <th className="p-2 text-right">المنتج</th>
                                        <th className="p-2">السعر</th>
                                        <th className="p-2 hidden md:table-cell">القسم</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(record.items || []).map((item, idx) => (
                                        <tr key={idx} className="border-b border-gray-500/5 hover:bg-black/5">
                                            <td className="p-2 text-right">{item.name}</td>
                                            <td className="p-2 font-bold text-green-600">{item.price}</td>
                                            <td className="p-2 opacity-70 text-xs hidden md:table-cell">{item.category}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit Modal */}
            {editingReport && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto p-4 backdrop-blur-sm">
                    <div className={`w-full max-w-xl rounded-2xl shadow-2xl p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}>
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-xl">تعديل أسعار {editingReport.company}</h3>
                            <button onClick={() => setEditingReport(null)} className="p-1 hover:bg-red-50 rounded-full transition"><X /></button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto space-y-2 mb-4 pr-1 custom-scrollbar">
                            {editingReport.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 border border-gray-100/10 rounded-lg bg-black/5 gap-2">
                                    <span className="flex-1 text-sm font-medium">{item.name}</span>
                                    <div className="w-24">
                                        <input 
                                            type="number" 
                                            value={item.price} 
                                            onChange={e => updateEditItem(idx, Number(e.target.value))}
                                            className="w-full p-2 border rounded-lg text-center text-black font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="السعر"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2 pt-4 border-t">
                            <button onClick={() => setEditingReport(null)} className="px-6 py-2 bg-gray-200 text-black rounded-xl font-bold hover:bg-gray-300 transition">إلغاء</button>
                            <button onClick={saveEdit} className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition shadow-lg"><Save size={18}/> حفظ التعديل</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompetitorReports;
