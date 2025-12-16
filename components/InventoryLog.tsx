import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, remove, update } from "firebase/database";
import { User, InventoryRecord } from '../types';
import { exportToCSV } from '../utils';
import { FileSpreadsheet, Trash2, Edit, Save, X } from 'lucide-react';

interface Props {
    user: User;
    markets: string[];
    theme: string;
}

const InventoryLog: React.FC<Props> = ({ user, markets, theme }) => {
    const [logs, setLogs] = useState<InventoryRecord[]>([]);
    const [selectedMarket, setSelectedMarket] = useState('');
    const [editingLog, setEditingLog] = useState<InventoryRecord | null>(null);

    useEffect(() => {
        const invRef = ref(db, 'inventory');
        onValue(invRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                let arr = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                })) as InventoryRecord[];

                // DATA PRIVACY: Filter by user unless admin
                if (user.role !== 'admin') {
                    arr = arr.filter(l => l.employeeName === user.name);
                }

                setLogs(arr.sort((a,b) => b.timestamp - a.timestamp));
            } else {
                setLogs([]);
            }
        });
    }, [user]);

    const filteredLogs = selectedMarket ? logs.filter(l => l.market === selectedMarket) : logs;

    const handleExport = () => {
        const data = filteredLogs.flatMap(log => 
            (log.items || []).map(item => ({
                "التاريخ": log.date,
                "الماركت": log.market,
                "بواسطة": log.employeeName,
                "الصنف": item.name,
                "الكمية": item.qty
            }))
        );
        exportToCSV(data, 'Inventory_Report');
    };

    const handleDelete = async (id: string) => {
        if(confirm("هل أنت متأكد من حذف هذا السجل؟")) {
            await remove(ref(db, `inventory/${id}`));
        }
    };

    const saveEdit = async () => {
        if(!editingLog || !editingLog.id) return;
        try {
            await update(ref(db, `inventory/${editingLog.id}`), {
                items: editingLog.items
            });
            setEditingLog(null);
            alert("تم تعديل المخزون");
        } catch (e) {
            console.error(e);
        }
    };

    const updateEditItem = (index: number, qty: number) => {
        if(!editingLog) return;
        const newItems = [...editingLog.items];
        newItems[index].qty = qty;
        setEditingLog({...editingLog, items: newItems});
    };

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold">سجل المخزون</h2>
            <div className="flex gap-4 mb-4">
                <select 
                    className="p-2 border rounded w-full md:w-1/3 text-black"
                    value={selectedMarket}
                    onChange={e => setSelectedMarket(e.target.value)}
                >
                    <option value="">كل الماركتات</option>
                    {markets.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button onClick={handleExport} className="bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2">
                    <FileSpreadsheet /> تصدير
                </button>
            </div>

            <div className="space-y-4">
                {filteredLogs.map((log, idx) => (
                    <div key={log.id} className={`p-4 rounded border ${theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow'}`}>
                        <div className="flex justify-between font-bold border-b pb-2 mb-2 text-blue-500">
                            <div>
                                <span className="ml-2">{log.market}</span>
                                <span className="opacity-50 font-normal">| {log.date}</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingLog(log)} className="text-blue-500 hover:text-blue-700"><Edit size={18} /></button>
                                {(user.role === 'admin' || user.name === log.employeeName) && (
                                    <button onClick={() => handleDelete(log.id!)} className="text-red-500 hover:text-red-700"><Trash2 size={18} /></button>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                            {(log.items || []).map((item, i) => (
                                <div key={i} className="flex justify-between bg-black/5 p-1 rounded px-2">
                                    <span>{item.name}</span>
                                    <span className="font-bold">{item.qty}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Edit Modal */}
            {editingLog && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 overflow-y-auto p-4">
                    <div className={`w-full max-w-lg rounded-lg shadow-2xl p-6 ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}>
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="font-bold text-xl">تعديل المخزون</h3>
                            <button onClick={() => setEditingLog(null)}><X /></button>
                        </div>
                        <div className="max-h-[60vh] overflow-y-auto space-y-2 mb-4">
                            {editingLog.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 border-b border-gray-100/10">
                                    <span>{item.name}</span>
                                    <input 
                                        type="number" 
                                        value={item.qty} 
                                        onChange={e => updateEditItem(idx, Number(e.target.value))}
                                        className="w-20 p-1 border rounded text-center text-black"
                                    />
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingLog(null)} className="px-4 py-2 bg-gray-500 text-white rounded">إلغاء</button>
                            <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded flex items-center gap-2"><Save size={16}/> حفظ</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryLog;