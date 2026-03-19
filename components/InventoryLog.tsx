
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, remove, update } from "firebase/database";
import { User, InventoryRecord } from '../types';
import { exportToCSV } from '../utils';
import { FileSpreadsheet, Trash2, Edit, Save, X, Calendar, User as UserIcon } from 'lucide-react';

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
                let arr = Object.keys(data).map(key => ({ id: key, ...data[key] })) as InventoryRecord[];
                if (user.role !== 'admin' && !user.canViewAllSales) {
                    arr = arr.filter(l => l.employeeName === user.name);
                }
                setLogs(arr.sort((a,b) => b.timestamp - a.timestamp));
            } else { setLogs([]); }
        });
    }, [user]);

    const filteredLogs = selectedMarket ? logs.filter(l => l.market === selectedMarket) : logs;

    const handleDelete = async (id: string) => {
        if(confirm("هل أنت متأكد من حذف هذا السجل؟")) {
            await remove(ref(db, `inventory/${id}`));
        }
    };

    const saveEdit = async () => {
        if(!editingLog || !editingLog.id) return;
        await update(ref(db, `inventory/${editingLog.id}`), { items: editingLog.items });
        setEditingLog(null);
        alert("تم تحديث المخزون");
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">سجل المخزون</h2>
            <div className="flex flex-col md:flex-row gap-4 bg-gray-800 p-5 rounded-3xl border border-white/10">
                <select className="flex-1 p-3 rounded-xl bg-gray-700 text-white" value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                    <option value="">كل الماركتات</option>
                    {markets.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <button onClick={() => exportToCSV(filteredLogs.flatMap(l => (l.items || []).map(i => ({ تاريخ: l.date, ماركت: l.market, صنف: i.name, كمية: i.qty }))), 'Inventory_Log')} className="bg-green-600 text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg">
                    <FileSpreadsheet size={18} /> تصدير التقرير
                </button>
            </div>

            <div className="space-y-4">
                {filteredLogs.map((log) => (
                    <div key={log.id} className="p-5 rounded-3xl border bg-gray-800 border-white/10 text-white shadow-xl">
                        <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-3">
                            <div>
                                <div className="font-bold text-xl text-blue-400">{log.market}</div>
                                <div className="flex items-center gap-3 text-[10px] opacity-60 font-bold mt-1">
                                    <span className="flex items-center gap-1"><Calendar size={12}/> {log.date}</span>
                                    <span>بواسطة: {log.employeeName}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setEditingLog(log)} className="p-2 text-indigo-400 hover:bg-white/5 rounded-xl transition"><Edit size={18} /></button>
                                {(user.role === 'admin' || user.name === log.employeeName) && (
                                    <button onClick={() => handleDelete(log.id!)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition"><Trash2 size={18} /></button>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {(log.items || []).map((item, i) => (
                                <div key={i} className="flex justify-between bg-black/30 p-3 rounded-2xl border border-white/5 text-[11px]">
                                    <span className="opacity-70 font-bold">{item.name}</span>
                                    <span className="font-black text-blue-400">{item.qty}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {editingLog && (
                <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100] p-4 backdrop-blur-xl">
                    <div className="w-full max-w-xl bg-gray-900 border border-white/10 rounded-3xl p-6 flex flex-col max-h-[85vh]">
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <h3 className="font-bold text-xl text-blue-400">تعديل المخزون</h3>
                            <button onClick={() => setEditingLog(null)} className="p-2 hover:bg-white/10 rounded-full text-white"><X/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {editingLog.items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-white/5 rounded-2xl border border-white/5">
                                    <span className="text-xs font-bold text-white truncate max-w-[200px]">{item.name}</span>
                                    <input type="number" value={item.qty} onChange={e => {
                                        const n = [...editingLog.items];
                                        n[idx].qty = Number(e.target.value);
                                        setEditingLog({...editingLog, items: n});
                                    }} className="w-24 p-2 rounded-lg bg-gray-800 text-white text-center text-xs font-black border border-white/10"/>
                                </div>
                            ))}
                        </div>
                        <button onClick={saveEdit} className="mt-6 w-full bg-blue-600 text-white py-4 rounded-2xl font-black shadow-2xl flex justify-center items-center gap-2 active:scale-95 transition">
                            <Save size={20}/> تحديث بيانات المخزون
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InventoryLog;
