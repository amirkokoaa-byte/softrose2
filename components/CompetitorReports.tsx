
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { ref, onValue, remove, update } from "firebase/database";
import { User, CompetitorPrice } from '../types';
import { exportToCSV } from '../utils';
import { COMPANIES } from '../constants';
import { Trash2, Edit, Save, X, FileSpreadsheet, User as UserIcon, Calendar, Building, Scale, Search, Filter } from 'lucide-react';

interface Props {
    user: User;
    markets: string[];
    theme: string;
}

const CompetitorReports: React.FC<Props> = ({ user, markets, theme }) => {
    const [data, setData] = useState<CompetitorPrice[]>([]);
    const [selectedMarket, setSelectedMarket] = useState('');
    const [selectedCompany, setSelectedCompany] = useState('');
    const [editingReport, setEditingReport] = useState<CompetitorPrice | null>(null);
    
    // Price Comparison State
    const [showComparisonModal, setShowComparisonModal] = useState(false);
    const [compMarket, setCompMarket] = useState('all');
    const [compCompany, setCompCompany] = useState(COMPANIES[0]);
    const [compProduct, setCompProduct] = useState('all');

    useEffect(() => {
        onValue(ref(db, 'competitor_prices'), s => {
            if(s.exists()) {
                let arr = Object.keys(s.val()).map(key => ({
                    id: key,
                    ...s.val()[key]
                })) as CompetitorPrice[];
                
                if (user.role !== 'admin') {
                    arr = arr.filter(d => markets.includes(d.market));
                }
                
                setData(arr.sort((a, b) => b.timestamp - a.timestamp));
            } else {
                setData([]);
            }
        });
    }, [user, markets]);

    const filtered = data.filter(d => 
        (!selectedMarket || d.market === selectedMarket) &&
        (!selectedCompany || d.company === selectedCompany)
    );

    // منطق مقارنة الأسعار: استخراج أحدث سعر لكل منتج في كل ماركت
    const comparisonResults = useMemo(() => {
        const results: { market: string; product: string; price: number; date: string; timestamp: number }[] = [];
        const latestMap = new Map<string, CompetitorPrice>();

        // ترتيب البيانات من الأحدث للأقدم لمعالجة أحدث سعر أولاً
        const sortedData = [...data].sort((a, b) => b.timestamp - a.timestamp);

        sortedData.forEach(record => {
            if (record.company === compCompany) {
                if (compMarket === 'all' || record.market === compMarket) {
                    record.items.forEach(item => {
                        if (compProduct === 'all' || item.name === compProduct) {
                            const key = `${record.market}_${item.name}`;
                            // إذا لم يتم تسجيل أحدث سعر لهذا المنتج في هذا الماركت بعد
                            if (!results.find(r => r.market === record.market && r.product === item.name)) {
                                results.push({
                                    market: record.market,
                                    product: item.name,
                                    price: item.price,
                                    date: record.date,
                                    timestamp: record.timestamp
                                });
                            }
                        }
                    });
                }
            }
        });

        return results.sort((a, b) => a.market.localeCompare(b.market, 'ar'));
    }, [data, compCompany, compMarket, compProduct]);

    // قائمة المنتجات المتاحة للشركة المختارة في المقارنة
    const availableProducts = useMemo(() => {
        const set = new Set<string>();
        data.filter(d => d.company === compCompany).forEach(d => d.items.forEach(i => set.add(i.name)));
        return Array.from(set).sort();
    }, [data, compCompany]);

    const handleExport = () => {
        const exportData = filtered.flatMap(d => (d.items || []).map(i => ({
            "التاريخ": d.date,
            "اليوم": new Date(d.timestamp).toLocaleDateString('ar-EG', { weekday: 'long' }),
            "اسم الفرع": d.market,
            "الموظف": d.employeeName || "غير معروف",
            "الشركة": d.company,
            "الصنف": i.name,
            "الفئة": i.category,
            "السعر": i.price
        })));
        exportToCSV(exportData, 'Competitor_Report_Detailed');
    };

    const handleExportComparison = () => {
        const exportData = comparisonResults.map(r => ({
            "الماركت / الفرع": r.market,
            "المنتج": r.product,
            "أحدث سعر مسجل": r.price,
            "تاريخ التسجيل": r.date
        }));
        exportToCSV(exportData, `Price_Comparison_${compCompany}`);
    };

    const handleUpdate = async () => {
        if(!editingReport || !editingReport.id) return;
        await update(ref(db, `competitor_prices/${editingReport.id}`), { items: editingReport.items });
        setEditingReport(null);
        alert("تم التعديل بنجاح");
    };

    const updateEditingItem = (index: number, field: 'name' | 'price', value: any) => {
        if (!editingReport) return;
        const newItems = [...editingReport.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setEditingReport({ ...editingReport, items: newItems });
    };

    const inputClass = "w-full p-2.5 rounded-xl bg-gray-700 text-white border border-white/10 text-xs font-bold";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                    <Building className="text-blue-500" /> تقارير أسعار المنافسين
                </h2>
                <button 
                    onClick={() => setShowComparisonModal(true)} 
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg transition active:scale-95"
                >
                    <Scale size={18}/> مقارنة الأسعار
                </button>
            </div>
            
            <div className="bg-gray-800 p-5 rounded-2xl space-y-4 border border-white/10 shadow-xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select className={inputClass} value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                        <option value="">كل الماركتات المتاحة لك</option>
                        {markets.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <select className={inputClass} value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                        <option value="">كل الشركات</option>
                        {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
                <button onClick={handleExport} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg transition active:scale-95">
                    <FileSpreadsheet size={20} /> تصدير التقرير التفصيلي (أحدث المبيعات)
                </button>
            </div>

            <div className="space-y-4">
                {filtered.map((record) => (
                    <div key={record.id} className="p-5 rounded-2xl border bg-gray-800 border-white/10 text-white shadow-lg">
                        <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-blue-400">{record.market}</h3>
                                <div className="flex flex-wrap gap-3 mt-1 text-[10px] opacity-70 text-white">
                                    <span className="flex items-center gap-1 font-bold"><Calendar size={12}/> {record.date}</span>
                                    <span className="flex items-center gap-1 font-bold"><UserIcon size={12}/> {record.employeeName}</span>
                                    <span className="font-black text-green-400">{record.company}</span>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                <button onClick={() => setEditingReport(record)} className="p-2 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition"><Edit size={16}/></button>
                                {(user.role === 'admin' || user.name === record.employeeName) && (
                                     <button onClick={() => remove(ref(db, `competitor_prices/${record.id!}`))} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition"><Trash2 size={16}/></button>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {(record.items || []).map((item, idx) => (
                                <div key={idx} className="flex justify-between p-2 px-3 bg-black/30 rounded-xl text-xs border border-white/5">
                                    <span className="opacity-80 truncate pr-2 font-bold text-white">{item.name}</span>
                                    <span className="font-black text-green-400">{item.price} ج.م</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* مودال مقارنة الأسعار */}
            {showComparisonModal && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[400] p-4 backdrop-blur-md">
                    <div className="w-full max-w-4xl bg-gray-900 border border-white/20 rounded-3xl p-6 flex flex-col max-h-[95vh] shadow-2xl animate-in zoom-in-95">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-white flex items-center gap-2"><Scale className="text-indigo-400"/> مقارنة أحدث الأسعار المسجلة</h3>
                            <button onClick={() => setShowComparisonModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">الماركت</label>
                                <select className="w-full p-3 rounded-xl bg-[#808080] text-white border border-white/10 text-xs font-bold" value={compMarket} onChange={e => setCompMarket(e.target.value)}>
                                    <option value="all">كل الماركتات</option>
                                    {markets.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">الشركة</label>
                                <select className="w-full p-3 rounded-xl bg-[#808080] text-white border border-white/10 text-xs font-bold" value={compCompany} onChange={e => setCompCompany(e.target.value)}>
                                    {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">المنتج</label>
                                <select className="w-full p-3 rounded-xl bg-[#808080] text-white border border-white/10 text-xs font-bold" value={compProduct} onChange={e => setCompProduct(e.target.value)}>
                                    <option value="all">كل المنتجات</option>
                                    {availableProducts.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/5 rounded-2xl bg-black/20 p-2">
                             <table className="w-full text-xs text-center border-collapse">
                                <thead className="bg-white/5 sticky top-0 z-10">
                                    <tr className="text-white opacity-60">
                                        <th className="py-3 px-4 text-right">الماركت / الفرع</th>
                                        <th className="py-3 px-4">المنتج</th>
                                        <th className="py-3 px-4">أحدث سعر</th>
                                        <th className="py-3 px-4">تاريخ التسجيل</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparisonResults.length === 0 ? (
                                        <tr><td colSpan={4} className="py-10 opacity-30 italic text-white">لا توجد بيانات مطابقة للبحث</td></tr>
                                    ) : comparisonResults.map((r, i) => (
                                        <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors text-white">
                                            <td className="py-3 px-4 text-right font-bold text-indigo-300">{r.market}</td>
                                            <td className="py-3 px-4 font-bold">{r.product}</td>
                                            <td className="py-3 px-4 font-black text-green-400">{r.price.toLocaleString()} ج.م</td>
                                            <td className="py-3 px-4 opacity-50 text-[10px]">{r.date}</td>
                                        </tr>
                                    ))}
                                </tbody>
                             </table>
                        </div>

                        {comparisonResults.length > 0 && (
                            <button 
                                onClick={handleExportComparison}
                                className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2 mt-4"
                            >
                                <FileSpreadsheet size={20}/> تصدير مقارنة الأسعار (أحدث سعر)
                            </button>
                        )}
                    </div>
                </div>
            )}

            {editingReport && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[500] p-4 backdrop-blur-md">
                    <div className="w-full max-w-2xl bg-gray-900 border border-white/10 rounded-3xl p-6 flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <h3 className="font-bold text-xl text-blue-400 flex items-center gap-2"><Edit size={20}/> تعديل تقرير المنافس</h3>
                            <button onClick={() => setEditingReport(null)} className="p-2 hover:bg-white/10 rounded-full text-white"><X/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                            {editingReport.items.map((item, idx) => (
                                <div key={idx} className="bg-black/20 p-4 rounded-xl space-y-3 border border-white/5">
                                    <input 
                                        type="text" 
                                        className="w-full bg-gray-800 text-white p-2.5 rounded-lg border border-white/10 text-xs font-bold"
                                        value={item.name}
                                        onChange={e => updateEditingItem(idx, 'name', e.target.value)}
                                        placeholder="اسم الصنف"
                                    />
                                    <div className="flex items-center gap-3">
                                        <label className="text-[10px] font-black opacity-40 uppercase text-white">السعر</label>
                                        <input 
                                            type="number" 
                                            value={item.price} 
                                            onChange={e => updateEditingItem(idx, 'price', Number(e.target.value))} 
                                            className="flex-1 p-2.5 rounded-lg bg-gray-700 text-white text-center border border-white/10 text-xs font-black"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleUpdate} className="mt-6 w-full bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition">
                            <Save size={20}/> حفظ بيانات التعديل
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompetitorReports;
