import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue } from "firebase/database";
import { User, InventoryRecord } from '../types';
import { exportToCSV } from '../utils';
import { FileSpreadsheet } from 'lucide-react';

interface Props {
    user: User;
    markets: string[];
    theme: string;
}

const InventoryLog: React.FC<Props> = ({ user, markets, theme }) => {
    const [logs, setLogs] = useState<InventoryRecord[]>([]);
    const [selectedMarket, setSelectedMarket] = useState('');

    useEffect(() => {
        const invRef = ref(db, 'inventory');
        onValue(invRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const arr = Object.values(data) as InventoryRecord[];
                setLogs(arr.sort((a,b) => b.timestamp - a.timestamp));
            }
        });
    }, []);

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
                    <div key={idx} className={`p-4 rounded border ${theme === 'dark' ? 'bg-gray-800' : 'bg-white shadow'}`}>
                        <div className="flex justify-between font-bold border-b pb-2 mb-2 text-blue-500">
                            <span>{log.market}</span>
                            <span>{log.date}</span>
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
        </div>
    );
};

export default InventoryLog;