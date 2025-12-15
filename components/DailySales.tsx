import React, { useState, useEffect } from 'react';
import { ref, push, set } from "firebase/database";
import { db } from '../firebase';
import { User, ProductItem } from '../types';
import { PRODUCTS_FACIAL, PRODUCTS_KITCHEN, PRODUCTS_TOILET, PRODUCTS_DOLPHIN } from '../constants';
import { Plus, Trash2, Save } from 'lucide-react';

interface Props {
    user: User;
    markets: string[];
    theme: string;
}

const DailySales: React.FC<Props> = ({ user, markets, theme }) => {
    const [selectedMarket, setSelectedMarket] = useState('');
    const [salesItems, setSalesItems] = useState<ProductItem[]>([]);
    const [newProductCategory, setNewProductCategory] = useState('Facial');
    const [notification, setNotification] = useState('');

    const allCategories = [
        { name: 'مناديل السحب (Facial)', items: PRODUCTS_FACIAL, key: 'Facial' },
        { name: 'مناديل المطبخ (Kitchen)', items: PRODUCTS_KITCHEN, key: 'Kitchen' },
        { name: 'مناديل تواليت (Toilet)', items: PRODUCTS_TOILET, key: 'Toilet' },
        { name: 'مناديل دولفن (Dolphin)', items: PRODUCTS_DOLPHIN, key: 'Dolphin' },
    ];

    const addNewRow = (category: string, defaultName: string = '') => {
        const newItem: ProductItem = {
            id: Date.now().toString() + Math.random(),
            category,
            name: defaultName,
            price: 0,
            qty: 0
        };
        setSalesItems(prev => [...prev, newItem]);
    };

    const handleAddProduct = (category: string) => {
        addNewRow(category, '');
    };

    useEffect(() => {
        const initialItems: ProductItem[] = [];
        allCategories.forEach(cat => {
            cat.items.forEach(itemName => {
                initialItems.push({
                    id: itemName + Math.random(),
                    category: cat.key,
                    name: itemName,
                    price: 0,
                    qty: 0
                });
            });
        });
        setSalesItems(initialItems);
    }, []);


    const updateItem = (id: string, field: keyof ProductItem, value: any) => {
        setSalesItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
    };

    const deleteItem = (id: string) => {
        setSalesItems(prev => prev.filter(item => item.id !== id));
    };

    const calculateTotal = () => {
        return salesItems.reduce((sum, item) => sum + (Number(item.price) || 0), 0);
    };

    const handleSave = async () => {
        if (!selectedMarket) {
            alert("الرجاء اختيار الماركت");
            return;
        }

        const soldItems = salesItems.filter(item => item.price > 0 || item.qty > 0);
        
        if (soldItems.length === 0) {
            alert("لا يوجد مبيعات مسجلة للحفظ");
            return;
        }

        const saleData = {
            market: selectedMarket,
            employeeName: user.name,
            date: new Date().toLocaleDateString('ar-EG'),
            timestamp: Date.now(),
            items: soldItems,
            total: calculateTotal()
        };

        try {
            const newSaleRef = push(ref(db, 'sales'));
            await set(newSaleRef, saleData);
            setNotification('تم حفظ المبيعات بنجاح!');
            
            setSalesItems(prev => prev.map(item => ({...item, price: 0, qty: 0})));
            setTimeout(() => setNotification(''), 3000);
        } catch (error) {
            console.error(error);
            alert("حدث خطأ أثناء الحفظ");
        }
    };

    const handleAddMarket = async () => {
        const name = prompt("ادخل اسم الماركت الجديد:");
        if (name) {
             const newRef = push(ref(db, 'settings/markets'));
             await set(newRef, name);
        }
    };

    const inputClass = theme === 'win10' || theme === 'light' 
        ? "border border-gray-300 p-2 rounded w-full text-black" 
        : "bg-white/10 border border-white/20 p-2 rounded w-full text-white placeholder-gray-400";

    const sectionHeaderClass = "bg-gray-400 text-black font-bold p-2 rounded mt-4 mb-2 text-center shadow-sm";

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold">المبيعات اليومية</h2>
                <div className="text-xl font-bold bg-green-500 text-white px-4 py-2 rounded shadow w-full md:w-auto text-center">
                    الإجمالي: {calculateTotal()} ج.م
                </div>
            </div>

            {/* Market Selection */}
            <div className="flex items-end gap-2">
                <div className="flex-1">
                    <label className="block mb-1 font-semibold">اسم الماركت</label>
                    <select 
                        value={selectedMarket} 
                        onChange={(e) => setSelectedMarket(e.target.value)}
                        className={inputClass}
                    >
                        <option value="">اختر الماركت...</option>
                        {markets.map((m, idx) => <option key={idx} value={m}>{m}</option>)}
                    </select>
                </div>
                <button onClick={handleAddMarket} className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded mb-[2px]">
                    <Plus size={24} />
                </button>
            </div>

            {/* Products Lists */}
            {allCategories.map(cat => (
                <div key={cat.key}>
                    <div className={sectionHeaderClass}>{cat.name}</div>
                    
                    {/* Header Row */}
                    <div className="grid grid-cols-12 gap-2 mb-2 font-bold opacity-70 text-xs md:text-sm px-1">
                        <div className="col-span-5">الصنف</div>
                        <div className="col-span-3">السعر</div>
                        <div className="col-span-3">الكمية</div>
                        <div className="col-span-1"></div>
                    </div>

                    <div className="space-y-2">
                        {salesItems.filter(item => item.category === cat.key).map((item) => (
                            <div key={item.id} className="grid grid-cols-12 gap-2 items-center bg-black/5 p-1 rounded">
                                <div className="col-span-5">
                                    {cat.items.includes(item.name) ? (
                                        <div className="p-2 text-xs md:text-sm font-medium leading-tight">{item.name}</div>
                                    ) : (
                                        <input 
                                            type="text" 
                                            value={item.name}
                                            onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                            className={`${inputClass} text-xs`} 
                                            placeholder="اسم الصنف"
                                        />
                                    )}
                                </div>
                                <div className="col-span-3">
                                    <input 
                                        type="number" 
                                        value={item.price || ''} 
                                        onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value))}
                                        className={`${inputClass} text-center`}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="col-span-3">
                                    <input 
                                        type="number" 
                                        value={item.qty || ''} 
                                        onChange={(e) => updateItem(item.id, 'qty', parseFloat(e.target.value))}
                                        className={`${inputClass} text-center`}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="col-span-1 flex justify-center">
                                    <button onClick={() => deleteItem(item.id)} className="text-red-500 hover:text-red-700 bg-red-100/50 p-1 rounded">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button 
                        onClick={() => handleAddProduct(cat.key)}
                        className="mt-2 text-sm bg-indigo-500/10 hover:bg-indigo-500 hover:text-white text-indigo-500 border border-indigo-500 px-3 py-1 rounded flex items-center gap-1 transition w-full md:w-auto justify-center"
                    >
                        <Plus size={14} /> اضف منتج
                    </button>
                </div>
            ))}

            <div className="mt-8 flex justify-center sticky bottom-4 z-10">
                <button 
                    onClick={handleSave}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-full shadow-xl flex items-center gap-2 text-lg transform hover:scale-105 transition w-full md:w-auto justify-center"
                >
                    <Save size={24} />
                    حفظ وترحيل
                </button>
            </div>

            {notification && (
                <div className="fixed bottom-4 left-4 right-4 md:right-auto bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg animate-bounce text-center z-50">
                    {notification}
                </div>
            )}
        </div>
    );
};

export default DailySales;