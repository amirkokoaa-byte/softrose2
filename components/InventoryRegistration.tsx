
import React, { useState, useEffect } from 'react';
import { ref, push, set, remove } from "firebase/database";
import { db } from '../firebase';
import { User } from '../types';
import { PRODUCTS_FACIAL, PRODUCTS_KITCHEN, PRODUCTS_TOILET, PRODUCTS_DOLPHIN } from '../constants';
import { Save, Plus, Trash2 } from 'lucide-react';

interface Props {
    user: User;
    markets: string[];
    theme: string;
    products: {id: string, name: string, category: string}[];
}

interface InventoryItem {
    id: string;
    name: string;
    qty: number;
    category: string;
    isCustom: boolean;
}

const InventoryRegistration: React.FC<Props> = ({ user, markets, theme, products }) => {
    const [selectedMarket, setSelectedMarket] = useState('');
    const [items, setItems] = useState<InventoryItem[]>([]);

    const allCategories = [
        { name: 'مناديل السحب (Facial)', key: 'Facial', allowAdd: true },
        { name: 'مناديل المطبخ (Kitchen)', key: 'Kitchen', allowAdd: true },
        { name: 'مناديل تواليت (Toilet)', key: 'Toilet', allowAdd: false },
        { name: 'مناديل دولفن (Dolphin)', key: 'Dolphin', allowAdd: true },
    ];

    useEffect(() => {
        setItems(prev => {
            return products.map(p => {
                const existing = prev.find(i => i.id === p.id);
                if (existing) {
                    return { ...existing, name: p.name, category: p.category };
                }
                return {
                    id: p.id,
                    name: p.name,
                    qty: 0,
                    category: p.category,
                    isCustom: false
                };
            });
        });
    }, [products]);

    const updateItem = (id: string, field: 'qty' | 'name', value: any) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleAddCustomItem = async (category: string) => {
        const newItemName = prompt("ادخل اسم الصنف الجديد:");
        if (newItemName && newItemName.trim()) {
            const newRef = push(ref(db, 'products'));
            await set(newRef, { name: newItemName.trim(), category });
        }
    };

    const removeCustomItem = async (id: string) => {
        if (user.role === 'admin') {
            await remove(ref(db, `products/${id}`));
            setItems(prev => prev.filter(i => i.id !== id));
        } else {
            setItems(prev => prev.filter(i => i.id !== id));
        }
    };

    const handleSave = async () => {
        if (!selectedMarket) return alert("اختر الماركت");
        
        const inventoryData = {
            market: selectedMarket,
            date: new Date().toLocaleDateString('ar-EG'),
            timestamp: Date.now(),
            employeeName: user.name,
            items: items.filter(i => i.qty > 0).map(i => ({ name: i.name, qty: i.qty, category: i.category }))
        };
        if (inventoryData.items.length === 0) return alert("الكميات كلها صفر");
        await push(ref(db, 'inventory'), inventoryData);
        alert("تم حفظ المخزون");
        setItems(prev => prev.map(i => ({...i, qty: 0})));
    };

    const dropdownClass = "w-48 bg-[#808080] text-white border border-white/20 p-2.5 rounded-xl font-bold outline-none";
    const inputClass = "bg-white/10 border border-white/20 p-2 rounded text-white";

    return (
        <div className="pb-20">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">تسجيل المخزون</h2>
                <div className="flex gap-2">
                    <select className={dropdownClass} value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                        <option value="">اختر الماركت</option>
                        {markets.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
            </div>

            {allCategories.map(cat => (
                <div key={cat.key} className="mb-6 bg-white/5 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-500/20 pb-2">
                        <h3 className="text-xl font-bold text-blue-500">{cat.name}</h3>
                        {cat.allowAdd && (
                             <button onClick={() => handleAddCustomItem(cat.key)} className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 shadow"><Plus size={14}/> أضف صنف</button>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {items.filter(i => i.category === cat.key).map((item) => (
                            <div key={item.id} className="flex justify-between items-center gap-2 p-2 border-b border-gray-500/10">
                                <div className="flex-1">
                                    {item.isCustom ? (
                                        <input type="text" value={item.name} onChange={e => updateItem(item.id, 'name', e.target.value)} className={`${inputClass} w-full text-sm`} placeholder="اسم الصنف..." />
                                    ) : (
                                        <span className="text-sm font-medium whitespace-normal break-words block">{item.name}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input type="number" value={item.qty || ''} onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value))} className={`${inputClass} w-20 text-center`} placeholder="الكمية" />
                                    {item.isCustom && <button onClick={() => removeCustomItem(item.id)} className="text-red-500 hover:bg-red-500/10 p-1 rounded transition"><Trash2 size={16} /></button>}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-8 md:w-auto flex justify-center z-10">
                <button 
                    onClick={handleSave} 
                    className="w-full md:w-64 bg-green-600 hover:bg-green-700 text-white py-3 rounded-full font-bold shadow-xl flex justify-center items-center gap-2 transform transition hover:scale-105"
                >
                    <Save size={20} /> حفظ المخزون
                </button>
            </div>
        </div>
    );
};

export default InventoryRegistration;
