import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, remove, update } from "firebase/database";
import { User, CompetitorPrice } from '../types';
import { exportToCSV } from '../utils';
import { COMPANIES } from '../constants';
import { Trash2, Edit, Save, X } from 'lucide-react';

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
                const arr = Object.keys(s.val()).map(key => ({
                    id: key,
                    ...s.val()[key]
                }));
                setData(arr);
            } else {
                setData([]);
            }
        });
    }, []);

    const filtered = data.filter(d => 
        (!selectedMarket || d.market === selectedMarket) &&
        (!selectedCompany || d.company === selectedCompany)
    );

    const handleExport = () => {
        const csv = filtered.flatMap(d => (d.items || []).map(i => ({
            "الماركت": d.market,
            "الشركة": d.company,
            "التاريخ": d.date,
            "القسم": i.category,
            "المنتج": i.name,
            "السعر": i.price
        })));
        exportToCSV(csv, 'Competitor_Report');
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

    const inputClass = "border p-2 rounded text-black w-full";

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">تقارير المنافسين</h2>
            <div className="flex gap-4">
                <select className={inputClass} value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                    <option value="">كل الماركتات</option>
                    {markets.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <select className={inputClass} value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                    <option value="">كل الشركات</option>
                    {companies.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={handleExport} className="bg-green-600 text-white px-4 rounded whitespace-nowrap">تصدير اكسيل</button>
            </div>

            <div className="space-y-4">
                {filtered.map((record, i) => (
                    <div key={record.id || i} className={`p-4 rounded border ${theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow'}`}>
                        <div className="font-bold text-lg mb-2 flex justify-between items-center">
                            <div>
                                <span>{record.company} @ {record.market}</span>
                                <span className="text-sm opacity-70 mr-2">{record.date}</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingReport(record)} className="text-blue-500 p-1"><Edit size={18}/></button>
                                <button onClick={() => handleDelete(record.id!)} className="text-red-500 p-1"><Trash2 size={18}/></button>
                            </div>
                        </div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-500/10">
                                    <th className="p-2 text-right">المنتج</th>
                                    <th className="p-2 text-right">السعر</th>
                                    <th className="p-2 text-right">القسم</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(record.items || []).map((item, idx) => (
                                    <tr key={idx} className="border-b border-gray-500/10">
                                        <td className="p-2">{item.name}</td>
                                        <td className="p-2 font-bold">{item.price}</td>
                                        <td className="p-2 opacity-70">{item.category}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>

            {/* Edit Modal */}
            {editingReport && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto p-4">
                    <div className={`w-full max-w-xl rounded-lg shadow-2xl p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}>
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-xl">تعديل أسعار المنافسين</h3>
                            <button onClick={() => setEditingReport(null)}><X /></button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto space-y-2 mb-4">
                            {editingReport.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 border-b border-gray-100/10 gap-2">
                                    <span className="flex-1">{item.name}</span>
                                    <div className="w-32">
                                        <input 
                                            type="number" 
                                            value={item.price} 
                                            onChange={e => updateEditItem(idx, Number(e.target.value))}
                                            className="w-full p-1 border rounded text-center text-black"
                                            placeholder="السعر"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingReport(null)} className="px-4 py-2 bg-gray-500 text-white rounded">إلغاء</button>
                            <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded flex items-center gap-2"><Save size={16}/> حفظ</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompetitorReports;