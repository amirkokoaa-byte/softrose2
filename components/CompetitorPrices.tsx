
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, push, set, onValue } from "firebase/database";
import { User } from '../types';
import { 
    COMPANIES, 
    PRODUCTS_FACIAL, PRODUCTS_KITCHEN, PRODUCTS_TOILET, 
    FINE_FACIAL, FINE_KITCHEN, FINE_TOILET,
    ZEINA_FACIAL, ZEINA_KITCHEN, ZEINA_TOILET,
    PAPIA_FACIAL, PAPIA_KITCHEN, PAPIA_TOILET,
    WHITE_FACIAL, WHITE_KITCHEN, WHITE_TOILET
} from '../constants';
import { Save, Plus, Trash2 } from 'lucide-react';

interface Props {
    user: User;
    markets: string[];
    theme: string;
}

const CompetitorPrices: React.FC<Props> = ({ user, markets, theme }) => {
    const [selectedMarket, setSelectedMarket] = useState('');
    const [selectedCompany, setSelectedCompany] = useState('');
    const [companies, setCompanies] = useState<string[]>(COMPANIES);
    const [items, setItems] = useState<{category: string, name: string, price: number}[]>([]);

    useEffect(() => {
        // فلترة الشركات بخصوصية
        onValue(ref(db, 'settings/companies'), s => {
            const systemCompanies = COMPANIES.map(name => ({ name, createdBy: 'system' }));
            const dbCompanies = s.exists() ? Object.values(s.val()).map((c: any) => 
                typeof c === 'string' ? { name: c, createdBy: 'system' } : c
            ) : [];

            const allCombined = [...systemCompanies, ...dbCompanies];
            
            let filtered;
            if (user.role === 'admin') {
                filtered = allCombined;
            } else {
                filtered = allCombined.filter(c => c.createdBy === 'system' || c.createdBy === user.username);
            }
            
            const uniqueNames = Array.from(new Set(filtered.map(c => c.name)));
            setCompanies(uniqueNames);
        });
    }, [user.username, user.role]);

    const getTemplatePath = () => {
        if (!selectedMarket || !selectedCompany || !user.username) return null;
        const safeUser = user.username.replace(/[.#$/[\]]/g, "_");
        const safeMarket = selectedMarket.replace(/[.#$/[\]]/g, "_");
        const safeCompany = selectedCompany.replace(/[.#$/[\]]/g, "_");
        return `competitor_templates/${safeUser}/${safeMarket}/${safeCompany}`;
    };

    const generateDefaultsFromList = (facial: string[], kitchen: string[], toilet: string[]) => {
        const defaultItems: {category: string, name: string, price: number}[] = [];
        facial.forEach(name => defaultItems.push({ category: 'مناديل سحب (Facial)', name, price: 0 }));
        kitchen.forEach(name => defaultItems.push({ category: 'مناديل مطبخ (Kitchen)', name, price: 0 }));
        toilet.forEach(name => defaultItems.push({ category: 'تواليت (Toilet)', name, price: 0 }));
        return defaultItems;
    };

    useEffect(() => {
        const path = getTemplatePath();
        if (path) {
            onValue(ref(db, path), (snapshot) => {
                if (snapshot.exists()) {
                    setItems(snapshot.val());
                } else {
                    if (selectedCompany === 'Soft Rose') setItems(generateDefaultsFromList(PRODUCTS_FACIAL, PRODUCTS_KITCHEN, PRODUCTS_TOILET));
                    else if (selectedCompany === 'Fine') setItems(generateDefaultsFromList(FINE_FACIAL, FINE_KITCHEN, FINE_TOILET));
                    else if (selectedCompany === 'Zeina') setItems(generateDefaultsFromList(ZEINA_FACIAL, ZEINA_KITCHEN, ZEINA_TOILET));
                    else if (selectedCompany === 'Papia Familia') setItems(generateDefaultsFromList(PAPIA_FACIAL, PAPIA_KITCHEN, PAPIA_TOILET));
                    else if (selectedCompany === 'White') setItems(generateDefaultsFromList(WHITE_FACIAL, WHITE_KITCHEN, WHITE_TOILET));
                    else setItems([]);
                }
            });
        }
    }, [selectedMarket, selectedCompany]);

    const updateTemplate = async (newItems: any[]) => {
        const path = getTemplatePath();
        if (path) await set(ref(db, path), newItems);
    };

    const addItem = (category: string) => {
        const newItems = [...items, { category, name: '', price: 0 }];
        setItems(newItems);
        updateTemplate(newItems);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        // @ts-ignore
        newItems[index][field] = value;
        setItems(newItems);
        updateTemplate(newItems);
    };

    const handleSaveReport = async () => {
        if (!selectedMarket || !selectedCompany) return alert("اكمل البيانات");
        const validItems = items.filter(i => i.name && i.price > 0);
        const data = {
            market: selectedMarket,
            company: selectedCompany,
            date: new Date().toLocaleDateString('ar-EG'),
            employeeName: user.name,
            items: validItems
        };
        await push(ref(db, 'competitor_prices'), data);
        alert("تم الحفظ");
        setItems(items.map(i => ({...i, price: 0})));
        updateTemplate(items.map(i => ({...i, price: 0})));
    };

    const handleAddMarket = async () => {
        const name = prompt("ادخل اسم الماركت الجديد:");
        if (name) await push(ref(db, 'settings/markets'), { name, createdBy: user.username });
    };

    const addCompany = async () => {
        const name = prompt("اسم الشركة الجديدة:");
        if(name) await push(ref(db, 'settings/companies'), { name, createdBy: user.username });
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">تسجيل أسعار المنافسين</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-100 p-4 rounded-lg">
                <div>
                    <label className="block mb-1 font-bold">الماركت</label>
                    <div className="flex gap-2">
                        <select className="border p-2 rounded w-full" value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                            <option value="">اختر الماركت</option>
                            {markets.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <button onClick={handleAddMarket} className="bg-blue-600 text-white p-2 rounded"><Plus size={18}/></button>
                    </div>
                </div>
                <div>
                    <label className="block mb-1 font-bold">الشركة</label>
                    <div className="flex gap-2">
                         <select className="border p-2 rounded w-full" value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                            <option value="">اختر الشركة</option>
                            {companies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                         <button onClick={addCompany} className="bg-blue-500 text-white p-2 rounded"><Plus size={18}/></button>
                    </div>
                </div>
            </div>

            {['مناديل سحب (Facial)', 'مناديل مطبخ (Kitchen)', 'تواليت (Toilet)'].map(cat => (
                <div key={cat} className="border p-4 rounded-xl">
                    <h3 className="font-bold mb-4 text-blue-600 border-b pb-2">{cat}</h3>
                    <div className="space-y-2">
                        {items.filter(i => i.category === cat).map((item, idx) => {
                            const actualIdx = items.indexOf(item);
                            return (
                                <div key={actualIdx} className="flex gap-2 items-center">
                                    <input className="flex-1 border p-2 rounded text-sm" value={item.name} onChange={e => updateItem(actualIdx, 'name', e.target.value)} placeholder="اسم المنتج" />
                                    <input type="number" className="w-24 border p-2 rounded text-center" value={item.price || ''} onChange={e => updateItem(actualIdx, 'price', e.target.value)} placeholder="السعر" />
                                    <button onClick={() => { const n = items.filter((_, i) => i !== actualIdx); setItems(n); updateTemplate(n); }} className="text-red-500"><Trash2 size={18}/></button>
                                </div>
                            );
                        })}
                    </div>
                    <button onClick={() => addItem(cat)} className="mt-2 text-xs bg-gray-200 p-2 rounded flex items-center gap-1"><Plus size={14}/> صنف جديد</button>
                </div>
            ))}
            <button onClick={handleSaveReport} className="bg-green-600 w-full py-4 text-white rounded-xl font-bold shadow-lg">حفظ وترحيل البيانات</button>
        </div>
    );
};

export default CompetitorPrices;
