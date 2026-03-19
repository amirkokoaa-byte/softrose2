
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, push, set, onValue } from "firebase/database";
import { User } from '../types';
import { COMPANIES, PRODUCTS_FACIAL, PRODUCTS_KITCHEN, PRODUCTS_TOILET, FINE_FACIAL, FINE_KITCHEN, FINE_TOILET, ZEINA_FACIAL, ZEINA_KITCHEN, ZEINA_TOILET, PAPIA_FACIAL, PAPIA_KITCHEN, PAPIA_TOILET, WHITE_FACIAL, WHITE_KITCHEN, WHITE_TOILET } from '../constants';
import { Save, Building2, User as UserIcon, Plus } from 'lucide-react';

interface Props {
    user: User;
    markets: string[];
    theme: string;
}

const CompetitorPrices: React.FC<Props> = ({ user, markets, theme }) => {
    const [selectedMarket, setSelectedMarket] = useState('');
    const [selectedCompany, setSelectedCompany] = useState('');
    const [items, setItems] = useState<{category: string, name: string, price: number, isCustom?: boolean}[]>([]);

    useEffect(() => {
        if (!selectedCompany) return;
        
        const generateItems = (facial: string[], kitchen: string[], toilet: string[]) => {
            return [
                ...facial.map(n => ({ category: 'Facial', name: n, price: 0 })),
                ...kitchen.map(n => ({ category: 'Kitchen', name: n, price: 0 })),
                ...toilet.map(n => ({ category: 'Toilet', name: n, price: 0 })),
            ];
        };

        switch(selectedCompany) {
            case 'Soft Rose': setItems(generateItems(PRODUCTS_FACIAL, PRODUCTS_KITCHEN, PRODUCTS_TOILET)); break;
            case 'Fine': setItems(generateItems(FINE_FACIAL, FINE_KITCHEN, FINE_TOILET)); break;
            case 'Zeina': setItems(generateItems(ZEINA_FACIAL, ZEINA_KITCHEN, ZEINA_TOILET)); break;
            case 'Papia Familia': setItems(generateItems(PAPIA_FACIAL, PAPIA_KITCHEN, PAPIA_TOILET)); break;
            case 'White': setItems(generateItems(WHITE_FACIAL, WHITE_KITCHEN, WHITE_TOILET)); break;
            default: setItems([]); break;
        }
    }, [selectedCompany]);

    const addCustomItem = (category: string) => {
        const name = prompt("ادخل اسم الصنف المنافس (English Only):");
        if (name) {
            // التحقق من اللغة (منع العربية)
            const containsArabic = /[\u0600-\u06FF]/.test(name);
            if (containsArabic) {
                alert("يرجى كتابة اسم الصنف باللغة الإنجليزية فقط");
                return;
            }
            setItems(prev => [...prev, { category, name, price: 0, isCustom: true }]);
        }
    };

    const handleSaveReport = async () => {
        if (!selectedMarket || !selectedCompany) return alert("اكمل البيانات");
        const validItems = items.filter(i => i.price > 0);
        if (validItems.length === 0) return alert("يرجى إدخال الأسعار");

        await push(ref(db, 'competitor_prices'), {
            market: selectedMarket,
            company: selectedCompany,
            date: new Date().toLocaleDateString('ar-EG'),
            timestamp: Date.now(),
            employeeName: user.name,
            items: validItems
        });
        alert("تم الحفظ بنجاح");
        setItems(prev => prev.map(i => ({...i, price: 0})));
    };

    const inputClass = "w-full p-4 rounded-2xl bg-gray-700 text-white border border-white/10 font-bold";

    return (
        <div className="space-y-6 pb-20">
            <h2 className="text-2xl font-bold text-white">تسجيل أسعار المنافسين</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-800 p-6 rounded-3xl border border-white/10 shadow-2xl">
                <div>
                    <label className="block text-xs font-bold mb-1 opacity-60 text-white">الماركت / الفرع</label>
                    <select className={inputClass} value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                        <option value="">اختر الماركت...</option>
                        {markets.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs font-bold mb-1 opacity-60 text-white">الشركة المنافسة</label>
                    <select className={inputClass} value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                        <option value="">اختر الشركة...</option>
                        {COMPANIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="space-y-4">
                {items.length > 0 && ['Facial', 'Kitchen', 'Toilet'].map(cat => (
                    <div key={cat} className="bg-gray-800 p-4 rounded-3xl border border-white/5">
                        <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                            <h3 className="font-bold text-blue-400">{cat}</h3>
                            <button 
                                onClick={() => addCustomItem(cat)}
                                className="bg-green-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition"
                            >
                                <Plus size={14}/> أضف صنف
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {items.filter(i => i.category === cat).map((item, idx) => (
                                <div key={idx} className="flex items-center gap-2 bg-black/20 p-2 rounded-xl">
                                    <span className="flex-1 text-xs text-white truncate font-bold">{item.name}</span>
                                    <input 
                                        type="number" 
                                        placeholder="السعر" 
                                        className="w-24 p-2 bg-gray-700 rounded-lg text-white text-center text-xs font-black"
                                        value={item.price || ''}
                                        onChange={e => {
                                            const newItems = [...items];
                                            const actualIdx = items.indexOf(item);
                                            newItems[actualIdx].price = parseFloat(e.target.value);
                                            setItems(newItems);
                                        }}
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50">
                <button onClick={handleSaveReport} className="bg-green-600 hover:bg-green-700 w-full py-5 text-white rounded-3xl font-black shadow-2xl flex items-center justify-center gap-2 transform active:scale-95 transition">
                    <Save size={20}/> حفظ وترحيل أسعار المنافسين
                </button>
            </div>
        </div>
    );
};

export default CompetitorPrices;
