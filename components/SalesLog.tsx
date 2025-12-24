
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, remove, update } from "firebase/database";
import { User, SaleRecord, ProductItem } from '../types';
import { 
    Trash2, Edit, FileSpreadsheet, Save, X, Calculator, 
    TrendingUp, Calendar, Search, Download, Trophy, Star, User as UserIcon
} from 'lucide-react';
import { exportToCSV } from '../utils';

interface Props {
    user: User;
    markets: string[];
    theme: string;
}

const SalesLog: React.FC<Props> = ({ user, markets, theme }) => {
    const [sales, setSales] = useState<SaleRecord[]>([]);
    const [filteredSales, setFilteredSales] = useState<SaleRecord[]>([]);
    const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
    
    // Filters
    const [filterDate, setFilterDate] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterMarket, setFilterMarket] = useState('');

    // Period Stats States
    const [showStatsModal, setShowStatsModal] = useState(false);
    const [statsStart, setStatsStart] = useState('');
    const [statsEnd, setStatsEnd] = useState('');
    const [statsMarket, setStatsMarket] = useState('');

    useEffect(() => {
        const salesRef = ref(db, 'sales');
        onValue(salesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                let loadedSales: SaleRecord[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                
                if (user.role !== 'admin' && !user.canViewAllSales) {
                    loadedSales = loadedSales.filter(s => s.employeeName === user.name);
                }

                setSales(loadedSales.sort((a, b) => b.timestamp - a.timestamp));
            } else {
                setSales([]);
            }
        });
    }, [user]);

    useEffect(() => {
        let result = sales;
        if (filterDate) {
            result = result.filter(s => s.date.includes(filterDate) || new Date(s.timestamp).toISOString().slice(0,10) === filterDate);
        }
        if (filterEmployee) {
            result = result.filter(s => s.employeeName.includes(filterEmployee));
        }
        if (filterMarket) {
            result = result.filter(s => s.market === filterMarket);
        }
        setFilteredSales(result);
    }, [sales, filterDate, filterEmployee, filterMarket]);

    // --- Statistics Calculations ---
    const getMonthlyData = () => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
        
        return sales.filter(s => s.timestamp >= startOfMonth && s.timestamp <= endOfMonth);
    };

    const calculateAggregatedStats = (records: SaleRecord[]) => {
        const aggregation: Record<string, { name: string, price: number, qty: number, total: number }> = {};
        const employeeTotals: Record<string, number> = {};
        let grandTotal = 0;

        records.forEach(sale => {
            // Employee totals
            employeeTotals[sale.employeeName] = (employeeTotals[sale.employeeName] || 0) + sale.total;
            
            // Item aggregation
            (sale.items || []).forEach(item => {
                const key = `${item.name}_${item.price}`;
                if (!aggregation[key]) {
                    aggregation[key] = { name: item.name, price: Number(item.price), qty: 0, total: 0 };
                }
                aggregation[key].qty += Number(item.qty);
                aggregation[key].total += (Number(item.qty) * Number(item.price));
                grandTotal += (Number(item.qty) * Number(item.price));
            });
        });

        const topEmployee = Object.entries(employeeTotals)
            .sort(([, a], [, b]) => b - a)[0];

        return { 
            items: Object.values(aggregation), 
            grandTotal, 
            topEmployee: topEmployee ? { name: topEmployee[0], total: topEmployee[1] } : null 
        };
    };

    const monthlyRecords = getMonthlyData();
    const monthlyStats = calculateAggregatedStats(monthlyRecords);
    const topItems = monthlyStats.items.sort((a,b) => b.total - a.total).slice(0, 5);

    // --- Export Logic ---
    const handleExportAggregated = () => {
        if (!statsStart || !statsEnd) return alert("يرجى تحديد فترة البداية والنهاية");
        
        const periodRecords = sales.filter(s => {
            const sDate = new Date(s.timestamp);
            const start = new Date(statsStart);
            const end = new Date(statsEnd);
            end.setHours(23,59,59);
            return sDate >= start && sDate <= end && (!statsMarket || s.market === statsMarket);
        });

        const { items, grandTotal } = calculateAggregatedStats(periodRecords);
        if (items.length === 0) return alert("لا توجد مبيعات في هذه الفترة");

        const csvData = items.map(i => ({
            "اسم الصنف": i.name,
            "سعر القطعة": i.price,
            "إجمالي الكمية المباعة": i.qty,
            "إجمالي المبيعات (ج.م)": i.total
        }));

        csvData.push({
            "اسم الصنف": "--- المجموع الكلي ---",
            "سعر القطعة": 0,
            "إجمالي الكمية المباعة": 0,
            "إجمالي المبيعات (ج.م)": grandTotal
        });

        exportToCSV(csvData, `تقرير_مبيعات_تجميعي_${statsStart}_إلى_${statsEnd}`);
    };

    const handleDelete = async (id: string) => {
        if (user.role !== 'admin') return alert("صلاحية الحذف للمسؤول فقط");
        if (window.confirm("هل أنت متأكد من حذف هذا السجل؟")) {
            await remove(ref(db, `sales/${id}`));
        }
    };

    const startEdit = (sale: SaleRecord) => {
        if (user.role !== 'admin') return alert("صلاحية التعديل للمسؤول فقط");
        setEditingSale(JSON.parse(JSON.stringify(sale)));
    };

    const saveEdit = async () => {
        if (!editingSale || !editingSale.id) return;
        try {
            await update(ref(db, `sales/${editingSale.id}`), {
                items: editingSale.items,
                total: editingSale.total,
                market: editingSale.market 
            });
            setEditingSale(null);
            alert("تم تعديل الفاتورة بنجاح");
        } catch (e) { alert("حدث خطأ"); }
    };

    const inputClass = "border p-2.5 rounded-lg w-full text-black focus:ring-2 focus:ring-blue-500 outline-none transition";
    
    return (
        <div className="space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <FileSpreadsheet className="text-blue-500" /> سجل المبيعات
                </h2>
                {user.role === 'admin' && (
                    <div className="flex gap-2 w-full md:w-auto">
                        <button 
                            onClick={() => setShowStatsModal(true)}
                            className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg transition transform active:scale-95"
                        >
                            <Calculator size={18} /> حساب مبيعات فترة
                        </button>
                        <button 
                            onClick={() => {
                                const data = filteredSales.flatMap(sale => (sale.items || []).map(item => ({
                                    "التاريخ": sale.date, "الماركت": sale.market, "الموظف": sale.employeeName,
                                    "الصنف": item.name, "السعر": item.price, "العدد": item.qty, "الإجمالي": (item.price * item.qty)
                                })));
                                exportToCSV(data, 'Full_Sales_Log');
                            }}
                            className="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg transition transform active:scale-95"
                        >
                            <Download size={18} /> تصدير السجل الحالي
                        </button>
                    </div>
                )}
            </div>

            {/* Monthly Leaderboard */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Top Employee Card */}
                <div className={`p-5 rounded-2xl border flex flex-col justify-between ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-500 shadow-xl'}`}>
                    <div className="flex justify-between items-start">
                        <h3 className="text-sm font-bold opacity-80 uppercase tracking-widest flex items-center gap-2">
                            <Trophy size={16} /> نجم الشهر الحالي
                        </h3>
                        <Star className="text-yellow-400 fill-yellow-400" size={20} />
                    </div>
                    <div className="mt-4">
                        {monthlyStats.topEmployee ? (
                            <>
                                <div className="text-2xl font-black mb-1">{monthlyStats.topEmployee.name}</div>
                                <div className="text-sm opacity-90">إجمالي المبيعات: <span className="font-bold">{monthlyStats.topEmployee.total.toLocaleString()} ج.م</span></div>
                            </>
                        ) : (
                            <div className="text-sm opacity-60 italic">لا توجد بيانات لهذا الشهر</div>
                        )}
                    </div>
                </div>

                {/* Top Items List */}
                <div className={`lg:col-span-2 p-5 rounded-2xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100 shadow-lg'}`}>
                    <h3 className="text-xs font-bold text-gray-400 mb-4 flex items-center gap-2 uppercase tracking-widest">
                        <TrendingUp size={16} className="text-blue-500" /> الأصناف الأكثر مبيعاً (يوم 1 - 30)
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {topItems.length > 0 ? topItems.map((item, idx) => (
                            <div key={idx} className={`px-4 py-2 rounded-xl border flex flex-col ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-blue-50 border-blue-100'}`}>
                                <span className="text-[10px] opacity-60 truncate max-w-[120px]">{item.name}</span>
                                <div className="flex items-center justify-between gap-4 mt-0.5">
                                    <span className="text-xs font-bold text-blue-600">{item.total.toLocaleString()} ج.م</span>
                                    <span className="text-[10px] bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-md font-bold">
                                        {item.qty} قطعة
                                    </span>
                                </div>
                            </div>
                        )) : (
                            <div className="w-full text-center text-xs opacity-30 py-4 italic">لا توجد بيانات مبيعات حالياً</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-black/5 p-4 rounded-2xl">
                <div className="relative">
                    <Calendar className="absolute left-3 top-3 opacity-30" size={18} />
                    <input type="date" className={inputClass} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-3 opacity-30" size={18} />
                    <input type="text" placeholder="بحث بالمشاركين..." className={inputClass} value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} />
                </div>
                <select className={inputClass} value={filterMarket} onChange={e => setFilterMarket(e.target.value)}>
                    <option value="">كل الماركتات</option>
                    {markets.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>

            {/* Sales Feed */}
            <div className="space-y-4">
                {filteredSales.map(sale => (
                    <div key={sale.id} className={`p-5 rounded-2xl border transition-all hover:shadow-md ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex gap-3">
                                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                                    <UserIcon size={20} />
                                </div>
                                <div>
                                    <div className="font-bold text-lg text-blue-600 mb-0.5">{sale.market}</div>
                                    <div className="flex items-center gap-3 text-[10px] opacity-60">
                                        <span className="flex items-center gap-1"><Calendar size={10}/> {sale.date}</span>
                                        <span>•</span>
                                        <span>بواسطة: {sale.employeeName}</span>
                                    </div>
                                </div>
                            </div>
                            {user.role === 'admin' && (
                                <div className="flex gap-1">
                                    <button onClick={() => startEdit(sale)} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition"><Edit size={16} /></button>
                                    <button onClick={() => handleDelete(sale.id!)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"><Trash2 size={16} /></button>
                                </div>
                            )}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs text-center border-t border-gray-100 dark:border-gray-800 mt-2 pt-2">
                                <thead className="opacity-40">
                                    <tr>
                                        <th className="text-right py-2">الصنف</th>
                                        <th className="py-2">السعر</th>
                                        <th className="py-2">العدد</th>
                                        <th className="py-2">المجموع</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(sale.items || []).map((item, idx) => (
                                        <tr key={idx} className="border-b border-gray-500/5">
                                            <td className="py-2 text-right font-medium">{item.name}</td>
                                            <td>{item.price}</td>
                                            <td>{item.qty}</td>
                                            <td className="font-bold opacity-60">{(item.price * item.qty).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="font-bold">
                                        <td colSpan={3} className="pt-3 text-left pl-4 opacity-50">الإجمالي:</td>
                                        <td className="pt-3 text-green-600 text-sm">{sale.total.toLocaleString()} ج.م</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal: Period Statistics (Aggregated) */}
            {showStatsModal && user.role === 'admin' && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-md">
                    <div className={`w-full max-w-lg rounded-3xl shadow-2xl p-8 border ${theme === 'dark' ? 'bg-gray-900 text-white border-gray-800' : 'bg-white text-black border-gray-100'}`}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-indigo-600">
                                <Calculator size={24} /> حساب مبيعات فترة معينة
                            </h3>
                            <button onClick={() => setShowStatsModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"><X /></button>
                        </div>
                        
                        <div className="space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block mb-1.5 text-xs font-bold opacity-60">تاريخ البداية</label>
                                    <input type="date" className={inputClass} value={statsStart} onChange={e => setStatsStart(e.target.value)} />
                                </div>
                                <div>
                                    <label className="block mb-1.5 text-xs font-bold opacity-60">تاريخ النهاية</label>
                                    <input type="date" className={inputClass} value={statsEnd} onChange={e => setStatsEnd(e.target.value)} />
                                </div>
                            </div>
                            <div>
                                <label className="block mb-1.5 text-xs font-bold opacity-60">اختيار الماركت (اختياري)</label>
                                <select className={inputClass} value={statsMarket} onChange={e => setStatsMarket(e.target.value)}>
                                    <option value="">جميع الماركتات</option>
                                    {markets.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>

                            <button 
                                onClick={handleExportAggregated}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 transition transform active:scale-95 mt-4"
                            >
                                <FileSpreadsheet size={22} /> تحميل تقرير مجمع (Excel)
                            </button>
                            <p className="text-[10px] text-center opacity-40 leading-relaxed">
                                سيحتوي ملف الإكسيل على تجميع لكل صنف تم بيعه خلال الفترة، موضحاً الكميات الإجمالية وأسعار القطع والمجاميع النهائية.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal (Admin Only) */}
            {editingSale && user.role === 'admin' && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 overflow-y-auto backdrop-blur-sm">
                    <div className={`w-full max-w-2xl rounded-3xl shadow-2xl p-6 ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="text-xl font-bold">تعديل فاتورة - {editingSale.market}</h3>
                            <button onClick={() => setEditingSale(null)} className="p-2 hover:bg-red-50 text-gray-500 hover:text-red-500 rounded-full transition"><X /></button>
                        </div>
                        
                        <div className="max-h-[50vh] overflow-y-auto space-y-3 mb-6 px-1 custom-scrollbar">
                            {editingSale.items.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-3 items-center bg-black/5 p-3 rounded-xl border border-transparent hover:border-blue-500/30 transition">
                                    <div className="col-span-5 text-sm font-bold truncate">{item.name}</div>
                                    <div className="col-span-3">
                                        <input type="number" value={item.price} onChange={e => {
                                            const items = [...editingSale.items];
                                            items[idx].price = Number(e.target.value);
                                            const total = items.reduce((s,i) => s + (i.price * i.qty), 0);
                                            setEditingSale({...editingSale, items, total});
                                        }} className="w-full p-2 border rounded-lg text-black text-center text-sm" />
                                    </div>
                                    <div className="col-span-2">
                                        <input type="number" value={item.qty} onChange={e => {
                                            const items = [...editingSale.items];
                                            items[idx].qty = Number(e.target.value);
                                            const total = items.reduce((s,i) => s + (i.price * i.qty), 0);
                                            setEditingSale({...editingSale, items, total});
                                        }} className="w-full p-2 border rounded-lg text-black text-center text-sm" />
                                    </div>
                                    <div className="col-span-2 text-center text-xs font-bold opacity-60">
                                        {(item.price * item.qty).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between items-center pt-5 border-t">
                             <div className="font-bold text-xl">
                                الإجمالي: <span className="text-green-600">{editingSale.total.toLocaleString()} ج.م</span>
                             </div>
                             <div className="flex gap-2">
                                <button onClick={() => setEditingSale(null)} className="px-6 py-2.5 bg-gray-200 text-black rounded-xl hover:bg-gray-300 font-bold transition">إلغاء</button>
                                <button onClick={saveEdit} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold flex items-center gap-2 transition shadow-lg"><Save size={18}/> حفظ التعديل</button>
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesLog;
