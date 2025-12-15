import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, push, set, onValue, remove } from "firebase/database";
import { User } from '../types';
import { COMPANIES } from '../constants';
import { Save, Plus, Trash } from 'lucide-react';

interface Props {
    user: User;
    markets: string[];
    theme: string;
}

const CompetitorPrices: React.FC<Props> = ({ user, markets, theme }) => {
    const [selectedMarket, setSelectedMarket] = useState('');
    const [selectedCompany, setSelectedCompany] = useState('');
    const [companies, setCompanies] = useState<string[]>(COMPANIES);
    
    // Structure: items for current view
    const [items, setItems] = useState<{category: string, name: string, price: number}[]>([]);

    useEffect(() => {
        onValue(ref(db, 'settings/companies'), s => {
            if(s.exists()) setCompanies(Object.values(s.val()));
        });
    }, []);

    // Clear previous data when market/company changes (as requested)
    useEffect(() => {
        setItems([]);
    }, [selectedMarket, selectedCompany]);

    const addItem = (category: string) => {
        setItems(prev => [...prev, { category, name: '', price: 0 }]);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        // @ts-ignore
        newItems[index][field] = value;
        setItems(newItems);
    };

    const handleSave = async () => {
        if (!selectedMarket || !selectedCompany) return alert("اكمل البيانات");
        
        const data = {
            market: selectedMarket,
            company: selectedCompany,
            date: new Date().toLocaleDateString('ar-EG'),
            items: items.filter(i => i.name && i.price)
        };
        
        await push(ref(db, 'competitor_prices'), data);
        alert("تم حفظ اسعار المنافسين");
        setItems([]); // Clear after save
    };

    const addCompany = async () => {
        if (user.role !== 'admin') return;
        const name = prompt("اسم الشركة:");
        if(name) await push(ref(db, 'settings/companies'), name);
    };

    const deleteMarket = async () => {
        if(user.role !== 'admin') return;
        // This is complex as markets are stored as a simple list usually. 
        // For now, we'll just show an alert as implemented fully requires ID tracking for markets
        alert("خاصية الحذف تحتاج تحديد الماركت من الاعدادات");
    };

    const categories = ['مناديل سحب (Facial)', 'مناديل مطبخ (Kitchen)', 'تواليت (Toilet)'];

    const inputClass = "border p-1 rounded w-full text-black";

    return (
        <div className="space-y-4">
            <h2 className="text-2xl font-bold">تسجيل أسعار المنافسين</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label>الماركت</label>
                    <div className="flex gap-2">
                        <select className={inputClass} value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                            <option value="">اختر الماركت</option>
                            {markets.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        {user.role === 'admin' && (
                            <button onClick={deleteMarket} className="bg-red-500 text-white p-2 rounded"><Trash size={16}/></button>
                        )}
                    </div>
                </div>
                <div>
                    <label>الشركة</label>
                    <div className="flex gap-2">
                         <select className={inputClass} value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                            <option value="">اختر الشركة</option>
                            {companies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                         {user.role === 'admin' && (
                            <button onClick={addCompany} className="bg-blue-500 text-white p-2 rounded"><Plus size={16}/></button>
                        )}
                    </div>
                </div>
            </div>

            {categories.map(cat => (
                <div key={cat} className="border p-4 rounded bg-white/5">
                    <h3 className="font-bold mb-2 text-yellow-500">{cat}</h3>
                    {items.map((item, idx) => item.category === cat && (
                        <div key={idx} className="flex gap-2 mb-2">
                            <input 
                                placeholder="اسم الصنف" 
                                className={inputClass} 
                                value={item.name} 
                                onChange={e => updateItem(idx, 'name', e.target.value)}
                            />
                            <input 
                                type="number" 
                                placeholder="السعر" 
                                className={inputClass} 
                                value={item.price || ''}
                                onChange={e => updateItem(idx, 'price', e.target.value)}
                            />
                        </div>
                    ))}
                    <button onClick={() => addItem(cat)} className="text-sm bg-gray-200 text-black px-2 py-1 rounded">+ اضف منتج</button>
                </div>
            ))}

            <button onClick={handleSave} className="bg-green-600 w-full py-3 text-white rounded font-bold">حفظ الأسعار</button>
        </div>
    );
};

export default CompetitorPrices;