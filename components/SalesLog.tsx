import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, remove, update } from "firebase/database";
import { User, SaleRecord, ProductItem } from '../types';
import { Trash2, Edit, FileSpreadsheet, Save, X } from 'lucide-react';
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

    useEffect(() => {
        const salesRef = ref(db, 'sales');
        onValue(salesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                let loadedSales: SaleRecord[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                
                // DATA PRIVACY: Filter by user unless admin or has specific permission
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
    }, [sales, filterDate, filterEmployee, filterMarket, user]);

    const handleDelete = async (id: string) => {
        if (window.confirm("هل أنت متأكد من حذف هذا السجل؟")) {
            await remove(ref(db, `sales/${id}`));
        }
    };

    const handleExport = () => {
        const exportData = filteredSales.flatMap(sale => 
            (sale.items || []).map(item => ({
                "التاريخ": sale.date,
                "الماركت": sale.market,
                "الموظف": sale.employeeName,
                "الصنف": item.name,
                "سعر القطعة": item.price,
                "العدد": item.qty,
                "الإجمالي للصنف": (Number(item.price) * Number(item.qty)) || 0,
                "اجمالي الفاتورة": sale.total
            }))
        );
        exportToCSV(exportData, `Sales_Report_${new Date().toISOString().slice(0,10)}`);
    };

    // --- Edit Logic ---
    const startEdit = (sale: SaleRecord) => {
        setEditingSale(JSON.parse(JSON.stringify(sale))); // Deep copy
    };

    const handleEditItemChange = (index: number, field: keyof ProductItem, value: any) => {
        if (!editingSale) return;
        const newItems = [...editingSale.items];
        // @ts-ignore
        newItems[index][field] = value;
        
        // Recalculate total based on (Price * Qty) logic
        const newTotal = newItems.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0);
        
        setEditingSale({
            ...editingSale,
            items: newItems,
            total: newTotal
        });
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
        } catch (e) {
            console.error(e);
            alert("حدث خطأ أثناء التعديل");
        }
    };

    const inputClass = "border p-2 rounded w-full text-black";

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold mb-4">سجل المبيعات</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white/5 p-4 rounded-lg">
                <input 
                    type="date" 
                    className={inputClass}
                    value={filterDate}
                    onChange={e => setFilterDate(e.target.value)}
                />
                <input 
                    type="text" 
                    placeholder="بحث باسم الموظف"
                    className={inputClass}
                    value={filterEmployee}
                    onChange={e => setFilterEmployee(e.target.value)}
                />
                <select 
                    className={inputClass}
                    value={filterMarket}
                    onChange={e => setFilterMarket(e.target.value)}
                >
                    <option value="">كل الماركتات</option>
                    {markets.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button 
                    onClick={handleExport}
                    className="bg-green-600 text-white p-2 rounded flex justify-center items-center gap-2 hover:bg-green-700"
                >
                    <FileSpreadsheet /> تصدير اكسيل
                </button>
            </div>

            <div className="overflow-x-auto">
                {filteredSales.map(sale => (
                    <div key={sale.id} className={`mb-4 p-4 rounded-lg border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow'}`}>
                        <div className="flex justify-between items-center border-b pb-2 mb-2">
                            <div>
                                <span className="font-bold text-lg text-blue-500">{sale.market}</span>
                                <span className="mx-2 text-gray-400">|</span>
                                <span>{sale.date}</span>
                                <span className="mx-2 text-gray-400">|</span>
                                <span className="text-sm">بواسطة: {sale.employeeName}</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => startEdit(sale)} className="text-blue-500 hover:bg-blue-100 p-1 rounded">
                                    <Edit size={18} />
                                </button>
                                {(user.role === 'admin' || user.name === sale.employeeName) && (
                                    <button onClick={() => handleDelete(sale.id!)} className="text-red-500 hover:bg-red-100 p-1 rounded">
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <table className="w-full text-sm text-center">
                            <thead>
                                <tr className="opacity-50 border-b border-gray-500/20">
                                    <th className="text-right pb-2">الصنف</th>
                                    <th className="pb-2">سعر القطعة</th>
                                    <th className="pb-2">العدد</th>
                                    <th className="pb-2">الإجمالي</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(sale.items || []).map((item, idx) => (
                                    <tr key={idx} className="border-b border-gray-100/10">
                                        <td className="py-2 text-right">{item.name}</td>
                                        <td>{item.price}</td>
                                        <td>{item.qty}</td>
                                        <td className="font-bold text-gray-500 dark:text-gray-400">
                                            {((Number(item.price) || 0) * (Number(item.qty) || 0)).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="font-bold text-lg">
                                    <td colSpan={3} className="pt-2 text-left pl-4">إجمالي الفاتورة:</td>
                                    <td className="pt-2 text-green-600">{sale.total.toLocaleString()} ج.م</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ))}
            </div>

            {/* Edit Modal */}
            {editingSale && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto p-4">
                    <div className={`w-full max-w-2xl rounded-lg shadow-2xl p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}>
                        <div className="flex justify-between items-center mb-6 border-b pb-2">
                            <h3 className="text-xl font-bold">تعديل المبيعات - {editingSale.market}</h3>
                            <button onClick={() => setEditingSale(null)} className="text-gray-500 hover:text-red-500"><X /></button>
                        </div>
                        
                        <div className="max-h-[60vh] overflow-y-auto space-y-2 mb-4">
                            <div className="grid grid-cols-12 gap-2 font-bold opacity-70 mb-2 px-1 text-center text-xs">
                                <div className="col-span-5 text-right">الصنف</div>
                                <div className="col-span-2">السعر</div>
                                <div className="col-span-2">العدد</div>
                                <div className="col-span-3">الاجمالي</div>
                            </div>
                            {editingSale.items.map((item, idx) => (
                                <div key={idx} className="grid grid-cols-12 gap-2 items-center border-b pb-2 border-gray-500/20">
                                    <div className="col-span-5 text-sm font-bold truncate">{item.name}</div>
                                    <div className="col-span-2">
                                        <input 
                                            type="number" 
                                            value={item.price} 
                                            onChange={e => handleEditItemChange(idx, 'price', e.target.value)}
                                            className="w-full p-1 border rounded text-black bg-gray-50 text-center text-sm"
                                            placeholder="سعر"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <input 
                                            type="number" 
                                            value={item.qty} 
                                            onChange={e => handleEditItemChange(idx, 'qty', e.target.value)}
                                            className="w-full p-1 border rounded text-black bg-gray-50 text-center text-sm"
                                            placeholder="عدد"
                                        />
                                    </div>
                                    <div className="col-span-3 text-center text-sm font-bold">
                                        {((Number(item.price) || 0) * (Number(item.qty) || 0)).toLocaleString()}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t">
                             <div className="font-bold text-lg">
                                الإجمالي الجديد: <span className="text-green-600">{editingSale.total.toLocaleString()} ج.م</span>
                             </div>
                             <div className="flex gap-2">
                                <button onClick={() => setEditingSale(null)} className="px-4 py-2 bg-gray-300 text-black rounded hover:bg-gray-400">إلغاء</button>
                                <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"><Save size={16}/> حفظ التعديلات</button>
                             </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesLog;