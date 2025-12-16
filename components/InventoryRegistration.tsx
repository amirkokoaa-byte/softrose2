import React, { useState, useEffect } from 'react';
import { ref, push, set } from "firebase/database";
import { db } from '../firebase';
import { User } from '../types';
import { PRODUCTS_FACIAL, PRODUCTS_KITCHEN, PRODUCTS_TOILET, PRODUCTS_DOLPHIN } from '../constants';
import { Save, Plus, Trash2 } from 'lucide-react';

interface Props {
    user: User;
    markets: string[];
    theme: string;
}

interface InventoryItem {
    id: string;
    name: string;
    qty: number;
    category: string;
    isCustom: boolean;
}

const InventoryRegistration: React.FC<Props> = ({ user, markets, theme }) => {
    const [selectedMarket, setSelectedMarket] = useState('');
    const [items, setItems] = useState<InventoryItem[]>([]);

    const allCategories = [
        { name: 'مناديل السحب (Facial)', items: PRODUCTS_FACIAL, key: 'Facial', allowAdd: true },
        { name: 'مناديل المطبخ (Kitchen)', items: PRODUCTS_KITCHEN, key: 'Kitchen', allowAdd: true },
        { name: 'مناديل تواليت (Toilet)', items: PRODUCTS_TOILET, key: 'Toilet', allowAdd: false },
        { name: 'مناديل دولفن (Dolphin)', items: PRODUCTS_DOLPHIN, key: 'Dolphin', allowAdd: true },
    ];

    useEffect(() => {
        const initItems: InventoryItem[] = [];
        allCategories.forEach(cat => {
            cat.items.forEach(prod => {
                initItems.push({
                    id: prod, // Use name as ID for standard items
                    name: prod,
                    qty: 0,
                    category: cat.key,
                    isCustom: false
                });
            });
        });
        setItems(initItems);
    }, []);

    const updateItem = (id: string, field: 'qty' | 'name', value: any) => {
        setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const handleAddCustomItem = (category: string) => {
        const customCount = items.filter(i => i.category === category && i.isCustom).length;
        if (customCount >= 20) {
            alert("لقد وصلت للحد الأقصى للإضافات (20 صنف)");
            return;
        }

        const newItem: InventoryItem = {
            id: `custom_${Date.now()}_${Math.random()}`,
            name: '',
            qty: 0,
            category,
            isCustom: true
        };
        setItems(prev => [...prev, newItem]);
    };

    const removeCustomItem = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const handleSave = async () => {
        if (!selectedMarket) return alert("اختر الماركت");
        
        // Validation: Custom items must have names if qty > 0
        const invalidItems = items.filter(i => i.qty > 0 && i.isCustom && !i.name.trim());
        if (invalidItems.length > 0) return alert("يرجى كتابة اسم الأصناف المضافة التي لها كمية");

        const inventoryData = {
            market: selectedMarket,
            date: new Date().toLocaleDateString('ar-EG'),
            timestamp: Date.now(),
            employeeName: user.name,
            items: items.filter(i => i.qty > 0).map(i => ({
                name: i.name,
                qty: i.qty,
                category: i.category
            }))
        };

        if (inventoryData.items.length === 0) return alert("الكميات كلها صفر");

        try {
            await push(ref(db, 'inventory'), inventoryData);
            alert("تم حفظ المخزون");
            // Reset quantities only, keeping the form structure
            setItems(prev => prev.map(i => ({...i, qty: 0})));
        } catch (e) {
            console.error(e);
            alert("حدث خطأ");
        }
    };

    const handleAddMarket = async () => {
         const name = prompt("ادخل اسم الماركت الجديد:");
         if (name) {
              await push(ref(db, 'settings/markets'), name);
         }
    };

    const inputClass = theme === 'win10' || theme === 'light' 
        ? "border border-gray-300 p-2 rounded text-black" 
        : "bg-white/10 border border-white/20 p-2 rounded text-white";

    return (
        <div className="pb-20">
            <div className="flex justify-between mb-6">
                <h2 className="text-2xl font-bold">تسجيل المخزون</h2>
                <div className="flex gap-2">
                    <select className={`${inputClass} w-48`} value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                        <option value="">اختر الماركت</option>
                        {markets.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <button onClick={handleAddMarket} className="bg-blue-500 text-white p-2 rounded"><Plus /></button>
                </div>
            </div>

            {allCategories.map(cat => (
                <div key={cat.key} className="mb-6 bg-white/5 p-4 rounded-lg">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-500/20 pb-2">
                        <h3 className="text-xl font-bold text-blue-500">{cat.name}</h3>
                        {cat.allowAdd && (
                             <button 
                                onClick={() => handleAddCustomItem(cat.key)}
                                className="bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded flex items-center gap-1 transition shadow"
                             >
                                <Plus size={14}/> اضف صنف
                             </button>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {items.filter(i => i.category === cat.key).map((item) => (
                            <div key={item.id} className="flex justify-between items-center gap-2 p-2 border-b border-gray-500/10">
                                <div className="flex-1">
                                    {item.isCustom ? (
                                        <input 
                                            type="text"
                                            value={item.name}
                                            onChange={e => updateItem(item.id, 'name', e.target.value)}
                                            className={`${inputClass} w-full text-sm`}
                                            placeholder="اسم الصنف الجديد..."
                                        />
                                    ) : (
                                        <span className="text-sm font-medium">{item.name}</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number" 
                                        value={item.qty || ''}
                                        onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value))}
                                        className={`${inputClass} w-20 text-center`}
                                        placeholder="الكمية"
                                    />
                                    {item.isCustom && (
                                        <button onClick={() => removeCustomItem(item.id)} className="text-red-500 hover:bg-red-500/10 p-1 rounded transition">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
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