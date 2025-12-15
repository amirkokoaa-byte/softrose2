import React, { useState, useEffect } from 'react';
import { ref, push, set } from "firebase/database";
import { db } from '../firebase';
import { User } from '../types';
import { PRODUCTS_FACIAL, PRODUCTS_KITCHEN, PRODUCTS_TOILET, PRODUCTS_DOLPHIN } from '../constants';
import { Save, Plus } from 'lucide-react';

interface Props {
    user: User;
    markets: string[];
    theme: string;
}

const InventoryRegistration: React.FC<Props> = ({ user, markets, theme }) => {
    const [selectedMarket, setSelectedMarket] = useState('');
    const [items, setItems] = useState<{name: string, qty: number, category: string}[]>([]);

    const allCategories = [
        { name: 'مناديل السحب (Facial)', items: PRODUCTS_FACIAL, key: 'Facial' },
        { name: 'مناديل المطبخ (Kitchen)', items: PRODUCTS_KITCHEN, key: 'Kitchen' },
        { name: 'مناديل تواليت (Toilet)', items: PRODUCTS_TOILET, key: 'Toilet' },
        { name: 'مناديل دولفن (Dolphin)', items: PRODUCTS_DOLPHIN, key: 'Dolphin' },
    ];

    useEffect(() => {
        // Init logic
        const initItems: any[] = [];
        allCategories.forEach(cat => {
            cat.items.forEach(prod => {
                initItems.push({ name: prod, qty: 0, category: cat.key });
            });
        });
        setItems(initItems);
    }, []);

    const handleQtyChange = (name: string, qty: number) => {
        setItems(prev => prev.map(item => item.name === name ? { ...item, qty } : item));
    };

    const handleSave = async () => {
        if (!selectedMarket) return alert("اختر الماركت");
        
        const inventoryData = {
            market: selectedMarket,
            date: new Date().toLocaleDateString('ar-EG'),
            timestamp: Date.now(),
            employeeName: user.name,
            items: items.filter(i => i.qty > 0)
        };

        if (inventoryData.items.length === 0) return alert("الكميات كلها صفر");

        try {
            await push(ref(db, 'inventory'), inventoryData);
            alert("تم حفظ المخزون");
            setItems(prev => prev.map(i => ({...i, qty: 0})));
        } catch (e) {
            console.error(e);
        }
    };

    const handleAddMarket = async () => {
         const name = prompt("ادخل اسم الماركت الجديد:");
         if (name) {
              await push(ref(db, 'settings/markets'), name);
         }
    };

    const inputClass = theme === 'win10' || theme === 'light' 
        ? "border border-gray-300 p-2 rounded w-full text-black" 
        : "bg-white/10 border border-white/20 p-2 rounded w-full text-white";

    return (
        <div>
            <div className="flex justify-between mb-6">
                <h2 className="text-2xl font-bold">تسجيل المخزون</h2>
                <div className="flex gap-2">
                    <select className={inputClass} value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                        <option value="">اختر الماركت</option>
                        {markets.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button onClick={handleAddMarket} className="bg-blue-500 text-white p-2 rounded"><Plus /></button>
                </div>
            </div>

            {allCategories.map(cat => (
                <div key={cat.key} className="mb-6">
                    <h3 className="bg-gray-400 text-black font-bold p-2 text-center rounded mb-2">{cat.name}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {items.filter(i => i.category === cat.key).map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center p-2 border-b border-gray-500/30">
                                <span>{item.name}</span>
                                <input 
                                    type="number" 
                                    value={item.qty || ''}
                                    onChange={e => handleQtyChange(item.name, parseFloat(e.target.value))}
                                    className={`w-24 p-1 rounded ${theme === 'light' ? 'bg-gray-100' : 'bg-black/20'} text-center`}
                                    placeholder="الكمية"
                                />
                            </div>
                        ))}
                    </div>
                </div>
            ))}

            <button onClick={handleSave} className="w-full bg-green-600 text-white py-3 rounded-lg font-bold flex justify-center items-center gap-2">
                <Save /> حفظ المخزون
            </button>
        </div>
    );
};

export default InventoryRegistration;