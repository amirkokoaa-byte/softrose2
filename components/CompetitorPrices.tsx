import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, push, set, onValue, remove } from "firebase/database";
import { User } from '../types';
import { COMPANIES } from '../constants';
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
    
    // Structure: items for current view
    const [items, setItems] = useState<{category: string, name: string, price: number}[]>([]);

    // Load Companies list
    useEffect(() => {
        onValue(ref(db, 'settings/companies'), s => {
            if(s.exists()) setCompanies(Object.values(s.val()));
        });
    }, []);

    // Helper to generate a safe Firebase path for templates
    const getTemplatePath = () => {
        if (!selectedMarket || !selectedCompany || !user.username) return null;
        // Sanitize strings to be safe for Firebase paths
        const safeUser = user.username.replace(/[.#$/[\]]/g, "_");
        const safeMarket = selectedMarket.replace(/[.#$/[\]]/g, "_");
        const safeCompany = selectedCompany.replace(/[.#$/[\]]/g, "_");
        return `competitor_templates/${safeUser}/${safeMarket}/${safeCompany}`;
    };

    // Load Template when Market/Company changes
    useEffect(() => {
        const path = getTemplatePath();
        if (path) {
            const templateRef = ref(db, path);
            const unsubscribe = onValue(templateRef, (snapshot) => {
                if (snapshot.exists()) {
                    setItems(snapshot.val());
                } else {
                    setItems([]); // Clear if no template exists
                }
            });
            return () => unsubscribe();
        } else {
            setItems([]);
        }
    }, [selectedMarket, selectedCompany, user.username]);

    // Update Template in Firebase
    const updateTemplate = async (newItems: any[]) => {
        const path = getTemplatePath();
        if (path) {
            await set(ref(db, path), newItems);
        }
    };

    const addItem = (category: string) => {
        if (!selectedMarket || !selectedCompany) {
            alert("يرجى اختيار الماركت والشركة أولاً");
            return;
        }
        const newItems = [...items, { category, name: '', price: 0 }];
        setItems(newItems);
        updateTemplate(newItems);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        // @ts-ignore
        newItems[index][field] = value;
        setItems(newItems);
        // We update template on name change to save the "Item Name", 
        // price updates are also saved but are transient until "Save Report".
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
        
        if (validItems.length === 0) {
            return alert("لا يوجد أصناف مسعرة للحفظ");
        }

        const data = {
            market: selectedMarket,
            company: selectedCompany,
            date: new Date().toLocaleDateString('ar-EG'),
            employeeName: user.name,
            items: validItems
        };
        
        await push(ref(db, 'competitor_prices'), data);
        alert("تم حفظ تقرير أسعار المنافسين");
        
        // Optional: Reset prices to 0 after report submission but keep names?
        // For now, based on request "Fix items", we leave them as is.
    };

    const addCompany = async () => {
        if (user.role !== 'admin') return;
        const name = prompt("اسم الشركة:");
        if(name) await push(ref(db, 'settings/companies'), name);
    };

    const deleteMarket = async () => {
        if(user.role !== 'admin') return;
        alert("خاصية الحذف تحتاج تحديد الماركت من الاعدادات");
    };

    const categories = ['مناديل سحب (Facial)', 'مناديل مطبخ (Kitchen)', 'تواليت (Toilet)'];

    const inputClass = "border p-2 rounded w-full text-black";

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">تسجيل أسعار المنافسين</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/5 p-4 rounded-lg">
                <div>
                    <label className="block mb-1">الماركت</label>
                    <div className="flex gap-2">
                        <select className={inputClass} value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                            <option value="">اختر الماركت</option>
                            {markets.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        {user.role === 'admin' && (
                            <button onClick={deleteMarket} className="bg-red-500 text-white p-2 rounded shrink-0"><Trash size={18}/></button>
                        )}
                    </div>
                </div>
                <div>
                    <label className="block mb-1">الشركة</label>
                    <div className="flex gap-2">
                         <select className={inputClass} value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                            <option value="">اختر الشركة</option>
                            {companies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                         {user.role === 'admin' && (
                            <button onClick={addCompany} className="bg-blue-500 text-white p-2 rounded shrink-0"><Plus size={18}/></button>
                        )}
                    </div>
                </div>
            </div>

            {/* Hint Message */}
            {selectedMarket && selectedCompany && (
                <div className="text-sm text-blue-500 bg-blue-100 p-2 rounded">
                    ملاحظة: الأصناف التي تقوم بتسجيلها هنا سيتم تثبيتها لحسابك ({user.name}) لهذا الماركت والشركة.
                </div>
            )}

            {categories.map(cat => (
                <div key={cat} className="border border-gray-200/20 p-4 rounded bg-white/5">
                    <h3 className="font-bold mb-3 text-yellow-600 border-b border-gray-200/10 pb-2">{cat}</h3>
                    <div className="space-y-3">
                        {items.map((item, idx) => item.category === cat && (
                            <div key={idx} className="flex flex-col md:flex-row gap-2 items-center">
                                <input 
                                    placeholder="اسم الصنف" 
                                    className={`${inputClass} md:w-2/3`} 
                                    value={item.name} 
                                    onChange={e => updateItem(idx, 'name', e.target.value)}
                                />
                                <input 
                                    type="number" 
                                    placeholder="السعر" 
                                    className={`${inputClass} md:w-1/3`} 
                                    value={item.price || ''}
                                    onChange={e => updateItem(idx, 'price', e.target.value)}
                                />
                                <button 
                                    onClick={() => deleteItem(idx)}
                                    className="p-2 text-red-500 hover:bg-red-100 rounded transition"
                                    title="حذف الصنف"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <button onClick={() => addItem(cat)} className="mt-3 text-sm bg-gray-200 hover:bg-white text-black px-4 py-2 rounded shadow transition w-full md:w-auto">+ اضف منتج</button>
                </div>
            ))}

            <button onClick={handleSaveReport} className="bg-green-600 hover:bg-green-700 w-full py-3 text-white rounded-lg font-bold shadow-lg text-lg transition">حفظ التقرير (ترحيل)</button>
        </div>
    );
};

export default CompetitorPrices;