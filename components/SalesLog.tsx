import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, remove, update } from "firebase/database";
import { User, SaleRecord } from '../types';
import { Trash2, Edit, FileSpreadsheet } from 'lucide-react';
import { exportToCSV, formatDate } from '../utils';

interface Props {
    user: User;
    markets: string[];
    theme: string;
}

const SalesLog: React.FC<Props> = ({ user, markets, theme }) => {
    const [sales, setSales] = useState<SaleRecord[]>([]);
    const [filteredSales, setFilteredSales] = useState<SaleRecord[]>([]);
    
    // Filters
    const [filterDate, setFilterDate] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterMarket, setFilterMarket] = useState('');

    useEffect(() => {
        const salesRef = ref(db, 'sales');
        onValue(salesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const loadedSales: SaleRecord[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                setSales(loadedSales.sort((a, b) => b.timestamp - a.timestamp));
            } else {
                setSales([]);
            }
        });
    }, []);

    useEffect(() => {
        let result = sales;

        if (filterDate) {
            // Basic string match for date or ISO search
            result = result.filter(s => s.date.includes(filterDate) || new Date(s.timestamp).toISOString().slice(0,10) === filterDate);
        }
        if (filterEmployee) {
            result = result.filter(s => s.employeeName.includes(filterEmployee));
        }
        if (filterMarket) {
            result = result.filter(s => s.market === filterMarket);
        }

        // Permission check
        if (!user.canViewAllSales && user.role !== 'admin') {
            result = result.filter(s => s.employeeName === user.name);
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
                "السعر": item.price,
                "الكمية": item.qty,
                "الاجمالي": sale.total
            }))
        );
        exportToCSV(exportData, `Sales_Report_${new Date().toISOString().slice(0,10)}`);
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
                                {(user.role === 'admin' || user.name === sale.employeeName) && (
                                    <button onClick={() => handleDelete(sale.id!)} className="text-red-500 hover:bg-red-100 p-1 rounded">
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="opacity-50 text-right">
                                    <th>الصنف</th>
                                    <th>الكمية</th>
                                    <th>السعر</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(sale.items || []).map((item, idx) => (
                                    <tr key={idx} className="border-b border-gray-100/10">
                                        <td className="py-1">{item.name}</td>
                                        <td>{item.qty}</td>
                                        <td>{item.price}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="font-bold">
                                    <td colSpan={2} className="pt-2 text-left pl-4">الاجمالي:</td>
                                    <td className="pt-2">{sale.total} ج.م</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SalesLog;