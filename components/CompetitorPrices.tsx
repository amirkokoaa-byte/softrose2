
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, push, set, onValue, remove } from "firebase/database";
import { User } from '../types';
import { 
    COMPANIES, 
    PRODUCTS_FACIAL, PRODUCTS_KITCHEN, PRODUCTS_TOILET, 
    FINE_FACIAL, FINE_KITCHEN, FINE_TOILET,
    ZEINA_FACIAL, ZEINA_KITCHEN, ZEINA_TOILET,
    PAPIA_FACIAL, PAPIA_KITCHEN, PAPIA_TOILET,
    WHITE_FACIAL, WHITE_KITCHEN, WHITE_TOILET
} from '../constants';
import { Save, Plus, Trash, Trash2, X } from 'lucide-react';

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
        onValue(ref(db, 'settings/companies'), s => {
            if(s.exists()) {
                const data = s.val();
                const allCompanies: any[] = Object.keys(data).map(key => {
                    if (typeof data[key] === 'string') return { name: data[key], createdBy: 'system' };
                    return data[key];
                });

                if (user.role === 'admin') {
                    setCompanies(allCompanies.map(c => c.name));
                } else {
                    const filtered = allCompanies.filter(c => c.createdBy === 'system' || c.createdBy === user.username);
                    setCompanies(filtered.map(c => c.name));
                }
            }
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
            const templateRef = ref(db, path);
            const unsubscribe = onValue(templateRef, (snapshot) => {
                if (snapshot.exists()) {
                    setItems(snapshot.val());
                } else {
                    if (selectedCompany === 'Soft Rose') {
                        setItems(generateDefaultsFromList(PRODUCTS_FACIAL, PRODUCTS_KITCHEN, PRODUCTS_TOILET));
                    } else if (selectedCompany === 'Fine') {
                        setItems(generateDefaultsFromList(FINE_FACIAL, FINE_KITCHEN, FINE_TOILET));
                    } else if (selectedCompany === 'Zeina') {
                        setItems(generateDefaultsFromList(ZEINA_FACIAL, ZEINA_KITCHEN, ZEINA_TOILET));
                    } else if (selectedCompany === 'Papia Familia') {
                        setItems(generateDefaultsFromList(PAPIA_FACIAL, PAPIA_KITCHEN, PAPIA_TOILET));
                    } else if (selectedCompany === 'White') {
                        setItems(generateDefaultsFromList(WHITE_FACIAL, WHITE_KITCHEN, WHITE_TOILET));
                    } else {
                        setItems([]);
                    }
                }
            });
            return () => unsubscribe();
        } else {
            setItems([]);
        }
    }, [selectedMarket, selectedCompany, user.username]);

    const updateTemplate = async (newItems: any[]) => {
        const path = getTemplatePath();
        if (path) await set(ref(db, path), newItems);
    };

    const addItem = (category: string) => {
        if (!selectedMarket || !selectedCompany) return alert("يرجى اختيار الماركت والشركة أولاً");
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

    const deleteItem = (index: number) => {
        if (confirm("هل تريد حذف هذا الصنف من القائمة المثبتة؟")) {
            const newItems = items.filter((_, i) => i !== index);
            setItems(newItems);
            updateTemplate(newItems);
        }
    };

    const handleSaveReport = async () => {
        if (!selectedMarket || !selectedCompany) return alert("اكمل البيانات");
        const validItems = items.filter(i => i.name && i.price > 0);
        if (validItems.length === 0) return alert("لا يوجد أصناف مسعرة للحفظ");
        const data = {
            market: selectedMarket,
            company: selectedCompany,
            date: new Date().toLocaleDateString('ar-EG'),
            employeeName: user.name,
            items: validItems
        };
        await push(ref(db, 'competitor_prices'), data);
        alert("تم حفظ تقرير أسعار المنافسين");
        const clearedItems = items.map(item => ({ ...item, price: 0 }));
        setItems(clearedItems);
        updateTemplate(clearedItems);
    };

    const addCompany = async () => {
        const name = prompt("اسم الشركة:");
        if(name) await push(ref(db, 'settings/companies'), { name, createdBy: user.username });
    };

    const handleAddMarket = async () => {
        const name = prompt("ادخل اسم الماركت الجديد:");
        if (name) await push(ref(db, 'settings/markets'), { name, createdBy: user.username });
    };

    const categories = ['مناديل سحب (Facial)', 'مناديل مطبخ (Kitchen)', 'تواليت (Toilet)'];
    const inputClass = "border p-2 rounded w-full text-black";

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">تسجيل أسعار المنافسين</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 p-4 rounded-lg text-black">
                <div>
                    <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">الماركت</label>
                    <div className="flex gap-2">
                        <select className={inputClass} value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                            <option value="">اختر الماركت</option>
                            {markets.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <button onClick={handleAddMarket} className="bg-blue-600 text-white p-2 rounded shrink-0" title="إضافة ماركت جديد">
                            <Plus size={18}/>
                        </button>
                    </div>
                </div>
                <div>
                    <label className="block mb-1 font-bold text-gray-700 dark:text-gray-300">الشركة</label>
                    <div className="flex gap-2">
                         <select className={inputClass} value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                            <option value="">اختر الشركة</option>
                            {companies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                         <button onClick={addCompany} className="bg-blue-500 text-white p-2 rounded shrink-0"><Plus size={18}/></button>
                    </div>
                </div>
            </div>

            {selectedMarket && selectedCompany && (
                <div className="text-sm text-blue-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
                    ملاحظة: الأصناف المثبتة خاصة بحسابك فقط لهذا الماركت والشركة.
                </div>
            )}

            {categories.map(cat => (
                <div key={cat} className="border border-gray-200/20 p-4 rounded-xl bg-white/5">
                    <h3 className="font-bold mb-4 text-yellow-600 border-b border-gray-200/10 pb-2 text-lg">{cat}</h3>
                    <div className="flex gap-2 mb-2 px-1 text-[10px] md:text-xs font-bold opacity-60 uppercase">
                        <div className="flex-1">اسم الصنف</div>
                        <div className="w-24 md:w-32 text-center">السعر</div>
                        <div className="w-8"></div>
                    </div>
                    <div className="space-y-2">
                        {items.map((item, idx) => item.category === cat && (
                            <div key={idx} className="flex flex-row gap-2 items-center">
                                <div className="flex-1 min-w-0">
                                    <input placeholder="اسم الصنف" className={`${inputClass} text-xs md:text-sm h-10`} value={item.name} onChange={e => updateItem(idx, 'name', e.target.value)} />
                                </div>
                                <div className="w-24 md:w-32 flex-shrink-0">
                                    <input type="number" placeholder="السعر" className={`${inputClass} text-center text-xs md:text-sm h-10`} value={item.price || ''} onChange={e => updateItem(idx, 'price', e.target.value)} />
                                </div>
                                <button onClick={() => deleteItem(idx)} className="p-1.5 text-red-500 hover:bg-red-50 rounded transition shrink-0"><Trash2 size={16} /></button>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => addItem(cat)} className="mt-4 text-xs bg-gray-100 hover:bg-white text-black px-4 py-2 rounded-lg shadow-sm border border-gray-200 transition w-full md:w-auto flex items-center justify-center gap-1">
                        <Plus size={14}/> اضف منتج جديد
                    </button>
                </div>
            ))}
            <button onClick={handleSaveReport} className="bg-green-600 hover:bg-green-700 w-full py-4 text-white rounded-2xl font-bold shadow-xl text-lg transition transform active:scale-[0.98] flex items-center justify-center gap-2">
                <Save size={24} /> حفظ التقرير وترحيله
            </button>
        </div>
    );
};

export default CompetitorPrices;
