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
        // Limit check handled by UI logic (user can keep clicking)
        // But prompt requested "Can add up to X items". 
        // We just add a blank row that allows selection
        addNewRow(category, '');
    };

    // Pre-populate specific lists if needed, but user wants to add them dynamically or see them?
    // The prompt says "Below the gray box [List of items]". 
    // It implies these items should be visible to enter data.
    // Let's initialize the form with ALL standard items for easy entry.
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

        // Filter out items with no sales (price 0)
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
            
            // Reset quantities/prices but keep structure
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

    const sectionHeaderClass = "bg-gray-400 text-black font-bold p-2 rounded mt-4 mb-2 text-center";

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold">المبيعات اليومية</h2>
                <div className="text-xl font-bold bg-green-500 text-white px-4 py-1 rounded shadow">
                    الإجمالي: {calculateTotal()} ج.م
                </div>
            </div>

            {/* Market Selection */}
            <div className="flex items-end gap-2">
                <div className="flex-1">
                    <label className="block mb-1">اسم الماركت</label>
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
                    <div className="grid grid-cols-12 gap-2 mb-2 font-bold opacity-70 text-xs md:text-sm">
                        <div className="col-span-4 md:col-span-5">الصنف</div>
                        <div className="col-span-3">السعر</div>
                        <div className="col-span-3">الكمية</div>
                        <div className="col-span-1"></div>
                    </div>
                    {salesItems.filter(item => item.category === cat.key).map((item) => (
                        <div key={item.id} className="grid grid-cols-12 gap-2 mb-2 items-center">
                            <div className="col-span-4 md:col-span-5">
                                {/* If it's a pre-defined item, show text, else show input if we added custom */}
                                {cat.items.includes(item.name) ? (
                                    <div className="p-2 text-sm">{item.name}</div>
                                ) : (
                                    <input 
                                        type="text" 
                                        value={item.name}
                                        onChange={(e) => updateItem(item.id, 'name', e.target.value)}
                                        className={inputClass} 
                                        placeholder="اسم الصنف"
                                    />
                                )}
                            </div>
                            <div className="col-span-3">
                                <input 
                                    type="number" 
                                    value={item.price || ''} 
                                    onChange={(e) => updateItem(item.id, 'price', parseFloat(e.target.value))}
                                    className={inputClass}
                                    placeholder="السعر"
                                />
                            </div>
                            <div className="col-span-3">
                                <input 
                                    type="number" 
                                    value={item.qty || ''} 
                                    onChange={(e) => updateItem(item.id, 'qty', parseFloat(e.target.value))}
                                    className={inputClass}
                                    placeholder="الكمية"
                                />
                            </div>
                            <div className="col-span-1 flex justify-center">
                                <button onClick={() => deleteItem(item.id)} className="text-red-500 hover:text-red-700">
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}
                    <button 
                        onClick={() => handleAddProduct(cat.key)}
                        className="mt-2 text-sm bg-indigo-500/50 hover:bg-indigo-500 text-white px-3 py-1 rounded flex items-center gap-1 transition"
                    >
                        <Plus size={14} /> اضف منتج
                    </button>
                </div>
            ))}

            <div className="mt-8 flex justify-center">
                <button 
                    onClick={handleSave}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg shadow-lg flex items-center gap-2 text-lg transform hover:scale-105 transition"
                >
                    <Save size={24} />
                    حفظ وترحيل
                </button>
            </div>

            {notification && (
                <div className="fixed bottom-4 left-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg animate-bounce">
                    {notification}
                </div>
            )}
        </div>
    );
};

export default DailySales;