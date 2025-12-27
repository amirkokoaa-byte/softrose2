
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, remove, update } from "firebase/database";
import { User, CompetitorPrice } from '../types';
import { exportToCSV } from '../utils';
import { COMPANIES } from '../constants';
import { Trash2, Edit, Save, X, FileSpreadsheet } from 'lucide-react';

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
        // جلب الشركات بخصوصية
        onValue(ref(db, 'settings/companies'), s => {
            if(s.exists()) {
                const rawData = s.val();
                const allCompanies: any[] = Object.keys(rawData).map(key => {
                    const item = rawData[key];
                    return typeof item === 'string' ? { name: item, createdBy: 'system' } : item;
                });

                if (user.role === 'admin') {
                    setCompanies(allCompanies.map(c => c.name));
                } else {
                    const filtered = allCompanies.filter(c => c.createdBy === 'system' || c.createdBy === user.username);
                    setCompanies(filtered.map(c => c.name));
                }
            } else {
                setCompanies(COMPANIES);
            }
        });

        // جلب التقارير (خصوصية البيانات نفسها)
        onValue(ref(db, 'competitor_prices'), s => {
            if(s.exists()) {
                let arr = Object.keys(s.val()).map(key => ({
                    id: key,
                    ...s.val()[key]
                })) as CompetitorPrice[];

                if (user.role !== 'admin' && !user.canViewAllSales) {
                    arr = arr.filter(d => d.employeeName === user.name);
                }
                setData(arr);
            } else {
                setData([]);
            }
        });
    }, [user.username, user.role, user.name, user.canViewAllSales]);

    const filtered = data.filter(d => 
        (!selectedMarket || d.market === selectedMarket) &&
        (!selectedCompany || d.company === selectedCompany)
    );

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
        exportToCSV(csv, 'تقرير_المنافسين');
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
                <button 
                    onClick={handleExport} 
                    className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-lg flex items-center justify-center gap-2 font-bold transition shadow-lg"
                >
                    <FileSpreadsheet size={20} /> تصدير إكسيل
                </button>
            </div>

            <div className="space-y-4">
                {filtered.map((record, i) => (
                    <div key={record.id || i} className={`p-4 rounded-xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100 shadow'}`}>
                        <div className="font-bold text-lg mb-2 flex justify-between items-center">
                            <div className="flex flex-col">
                                <span className="text-blue-600">{record.company}</span>
                                <span className="text-xs font-normal opacity-70">{record.market} | {record.date}</span>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => setEditingReport(record)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition"><Edit size={18}/></button>
                                {(user.role === 'admin' || user.name === record.employeeName) && (
                                     <button onClick={() => handleDelete(record.id!)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={18}/></button>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {(record.items || []).map((item, idx) => (
                                <div key={idx} className="flex justify-between p-2 bg-black/5 rounded text-sm">
                                    <span>{item.name}</span>
                                    <span className="font-bold text-green-600">{item.price} ج.م</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {editingReport && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
                    <div className={`w-full max-w-xl rounded-2xl p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}>
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-xl">تعديل أسعار {editingReport.company}</h3>
                            <button onClick={() => setEditingReport(null)}><X /></button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto space-y-2 mb-4 custom-scrollbar">
                            {editingReport.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 bg-black/5 rounded gap-2">
                                    <span className="flex-1 text-sm">{item.name}</span>
                                    <input 
                                        type="number" 
                                        value={item.price} 
                                        onChange={e => updateEditItem(idx, Number(e.target.value))}
                                        className="w-24 p-2 border rounded text-center text-black"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingReport(null)} className="px-4 py-2 bg-gray-200 text-black rounded-lg">إلغاء</button>
                            <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg">حفظ</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompetitorReports;
