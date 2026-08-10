import { onCachedValue } from "../firebaseCache";

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, push, update, remove, onValue } from "firebase/database";
import { User } from '../types';
import { COMPANIES, PRODUCTS_FACIAL, PRODUCTS_KITCHEN, PRODUCTS_TOILET, FINE_FACIAL, FINE_KITCHEN, FINE_TOILET, ZEINA_FACIAL, ZEINA_KITCHEN, ZEINA_TOILET, PAPIA_FACIAL, PAPIA_KITCHEN, PAPIA_TOILET, WHITE_FACIAL, WHITE_KITCHEN, WHITE_TOILET } from '../constants';
import { Save, Building2, User as UserIcon, Plus, Edit, Trash2, Check } from 'lucide-react';

interface Props {
    user: User;
    markets: string[];
    theme: string;
    products: {id: string, name: string, category: string}[];
}

const CompetitorPrices: React.FC<Props> = ({ user, markets, theme, products }) => {
    const [selectedMarket, setSelectedMarket] = useState('');
    const [selectedCompany, setSelectedCompany] = useState('');
    const [pricesState, setPricesState] = useState<Record<string, number>>({});
    const [editedNames, setEditedNames] = useState<Record<string, string>>({});
    const [customCompanies, setCustomCompanies] = useState<string[]>([]);
    
    // Global template for competitor products
    const [competitorProductsDB, setCompetitorProductsDB] = useState<Record<string, any>>({});

    useEffect(() => {
        const unsubCompanies = onCachedValue(ref(db, 'settings/companies'), 'settings_companies', snapshot => {
            if (snapshot.exists()) {
                const companies = Object.values(snapshot.val()).map((c: any) => {
                    if (typeof c === 'string') return c;
                    if (c && typeof c === 'object') {
                        let extractedName = c.name;
                        if (typeof extractedName === 'object' && extractedName !== null) {
                            extractedName = extractedName.name || String(extractedName);
                        }
                        return extractedName;
                    }
                    return String(c);
                }).filter(n => typeof n === 'string' && n !== '[object Object]');
                setCustomCompanies(companies);
            } else {
                setCustomCompanies([]);
            }
        });

        const unsubProducts = onCachedValue(ref(db, 'settings/competitor_products'), 'settings_competitor_products', snap => {
            if (snap.exists()) {
                setCompetitorProductsDB(snap.val());
            } else {
                setCompetitorProductsDB({});
            }
        });
        return () => { unsubCompanies(); unsubProducts(); };
    }, []);

    const allCompanies = Array.from(new Set([...COMPANIES, ...customCompanies]));

    const generateItems = (facial: string[], kitchen: string[], toilet: string[]) => {
        return [
            ...facial.map(n => ({ category: 'Facial', name: n })),
            ...kitchen.map(n => ({ category: 'Kitchen', name: n })),
            ...toilet.map(n => ({ category: 'Toilet', name: n })),
        ];
    };

    const seedCompanyToFirebase = async (company: string, editedOldName?: string, editedNewName?: string) => {
        let itemsToSeed: { category: string, name: string }[] = [];
        switch(company) {
            case 'Fine': itemsToSeed = generateItems(FINE_FACIAL, FINE_KITCHEN, FINE_TOILET); break;
            case 'Zeina': itemsToSeed = generateItems(ZEINA_FACIAL, ZEINA_KITCHEN, ZEINA_TOILET); break;
            case 'Papia Familia': itemsToSeed = generateItems(PAPIA_FACIAL, PAPIA_KITCHEN, PAPIA_TOILET); break;
            case 'White': itemsToSeed = generateItems(WHITE_FACIAL, WHITE_KITCHEN, WHITE_TOILET); break;
            default: return; // no constants available
        }
        
        const updates: any = {};
        for (const item of itemsToSeed) {
            const newRef = push(ref(db, `settings/competitor_products/${company}`));
            if (editedOldName && editedNewName && item.name === editedOldName) {
                updates[newRef.key!] = { ...item, name: editedNewName };
            } else {
                updates[newRef.key!] = item;
            }
        }
        await update(ref(db, `settings/competitor_products/${company}`), updates);
    };

    const currentTemplate = React.useMemo(() => {
        if (!selectedCompany) return [];
        if (selectedCompany === 'Soft Rose') {
            return products.map(p => ({ id: p.id, category: p.category, name: p.name }));
        }

        if (competitorProductsDB[selectedCompany]) {
            return Object.entries(competitorProductsDB[selectedCompany]).map(([k, v]: any) => ({ id: k, category: v.category, name: v.name }));
        }

        // Fallback to constants
        switch(selectedCompany) {
            case 'Fine': return generateItems(FINE_FACIAL, FINE_KITCHEN, FINE_TOILET).map((i, idx) => ({ id: `fallback-${idx}`, ...i }));
            case 'Zeina': return generateItems(ZEINA_FACIAL, ZEINA_KITCHEN, ZEINA_TOILET).map((i, idx) => ({ id: `fallback-${idx}`, ...i }));
            case 'Papia Familia': return generateItems(PAPIA_FACIAL, PAPIA_KITCHEN, PAPIA_TOILET).map((i, idx) => ({ id: `fallback-${idx}`, ...i }));
            case 'White': return generateItems(WHITE_FACIAL, WHITE_KITCHEN, WHITE_TOILET).map((i, idx) => ({ id: `fallback-${idx}`, ...i }));
            default: return [];
        }
    }, [selectedCompany, products, competitorProductsDB]);

    const handleInlineEditSave = async (item: any, newName: string) => {
        if (user.role !== 'admin' || selectedCompany === 'Soft Rose') return;
        if (!newName || !newName.trim() || newName.trim() === item.name) return;
        
        let companyId = selectedCompany;
        
        if (item.id.startsWith('fallback-')) {
            if (confirm('سيتم تهيئة وحفظ أصناف هذه الشركة في قاعدة البيانات لتتمكن من التعديل. هل توافق؟')) {
                await seedCompanyToFirebase(selectedCompany, item.name, newName.trim());
                setEditedNames(prev => { const n = {...prev}; delete n[item.id]; return n; });
            }
            return;
        }

        await update(ref(db, `settings/competitor_products/${companyId}/${item.id}`), { name: newName.trim() });
        setEditedNames(prev => { const n = {...prev}; delete n[item.id]; return n; });
    };

    const handleDeleteItem = async (item: any) => {
        if (user.role !== 'admin') return;
        if (selectedCompany === 'Soft Rose') return alert("لا يمكن حذف أصناف الشركة من هذه الشاشة.");
        
        if (item.id.startsWith('fallback-')) {
             return alert("يجب تهيئة أصناف هذه الشركة أولاً بالضغط على تعديل.");
        }
        
        if (confirm('هل أنت متأكد من حذف هذا الصنف؟')) {
            await remove(ref(db, `settings/competitor_products/${selectedCompany}/${item.id}`));
            // Remove from local prices
            setPricesState(prev => {
                const next = { ...prev };
                delete next[item.id];
                return next;
            });
        }
    };

    const handleAddCustomItem = async (category: string) => {
        if (selectedCompany === 'Soft Rose') return alert("أضف أصناف شركتك من الإعدادات.");
        
        if (!competitorProductsDB[selectedCompany] && ['Fine', 'Zeina', 'Papia Familia', 'White'].includes(selectedCompany)) {
            // Seed first if it relies on fallbacks
            if (confirm('سيتم تهيئة وحفظ أصناف هذه الشركة أولاً قبل إضافة صنف جديد. هل توافق؟')) {
                await seedCompanyToFirebase(selectedCompany);
            } else {
                return;
            }
        }

        const name = prompt(`أدخل اسم الصنف الجديد لقسم ${category}:`);
        if (name && name.trim()) {
            await push(ref(db, `settings/competitor_products/${selectedCompany}`), { category, name: name.trim() });
        }
    };

    const handleAddMarket = async () => {
        const newMarket = prompt("أدخل اسم الماركت الجديد:");
        if (newMarket && newMarket.trim()) {
            await push(ref(db, 'settings/markets'), { name: newMarket.trim(), createdBy: 'system' });
            alert("تم إضافة الماركت بنجاح");
        }
    };

    const handleAddCompany = async () => {
        const newCompany = prompt("أدخل اسم الشركة الجديدة:");
        if (newCompany && newCompany.trim()) {
            await push(ref(db, 'settings/companies'), { name: newCompany.trim(), createdBy: 'system' });
            alert("تم إضافة الشركة بنجاح");
        }
    };

    const handleSaveReport = async () => {
        if (!selectedMarket || !selectedCompany) return alert("اكمل البيانات");
        
        const validItems = currentTemplate
            .filter(i => pricesState[i.id] && pricesState[i.id] > 0)
            .map(i => ({ 
                category: i.category, 
                name: i.name, 
                price: pricesState[i.id] 
            }));
            
        if (validItems.length === 0) return alert("يرجى إدخال أسعار بعض الأصناف");

        await push(ref(db, 'competitor_prices'), {
            market: selectedMarket,
            company: selectedCompany,
            date: new Date().toLocaleDateString('ar-EG'),
            timestamp: Date.now(),
            employeeName: user.name,
            items: validItems
        });
        alert("تم الحفظ بنجاح");
        setPricesState({});
    };

    const inputClass = "w-full p-4 rounded-2xl bg-gray-700 text-white border border-white/10 font-bold";

    return (
        <div className="space-y-6 pb-20">
            <h2 className="text-2xl font-bold text-white">تسجيل أسعار المنافسين</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-800 p-6 rounded-3xl border border-white/10 shadow-2xl">
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold opacity-60 text-white">الماركت / الفرع</label>
                        {user.role === 'admin' && (
                            <button onClick={handleAddMarket} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                                <Plus size={12}/> إضافة ماركت
                            </button>
                        )}
                    </div>
                    <select className={inputClass} value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                        <option value="">اختر الماركت...</option>
                        {markets.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                </div>
                <div>
                    <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs font-bold opacity-60 text-white">الشركة المنافسة</label>
                        {user.role === 'admin' && (
                            <button onClick={handleAddCompany} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                                <Plus size={12}/> إضافة شركة
                            </button>
                        )}
                    </div>
                    <select className={inputClass} value={selectedCompany} onChange={e => {
                        setSelectedCompany(e.target.value);
                        setPricesState({}); // Reset prices when company changes
                    }}>
                        <option value="">اختر الشركة...</option>
                        {allCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                </div>
            </div>
            
            <div className="space-y-4">
                {currentTemplate.length > 0 && ['Facial', 'Kitchen', 'Toilet'].map(cat => {
                    const catItems = currentTemplate.filter(i => i.category === cat);
                    if (catItems.length === 0 && selectedCompany === 'Soft Rose') return null;
                    return (
                        <div key={cat} className="bg-gray-800 p-4 rounded-3xl border border-white/5">
                            <div className="flex justify-between items-center mb-3 border-b border-white/10 pb-2">
                                <h3 className="font-bold text-blue-400">
                                    {cat === 'Facial' ? 'مناديل وجه' : cat === 'Kitchen' ? 'مناديل مطبخ' : 'مناديل تواليت'} ({cat})
                                </h3>
                                {user.role === 'admin' && selectedCompany !== 'Soft Rose' && (
                                    <button 
                                        onClick={() => handleAddCustomItem(cat)}
                                        className="bg-green-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 active:scale-95 transition"
                                    >
                                        <Plus size={14}/> أضف صنف
                                    </button>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {catItems.map((item, idx) => {
                                    const isEditing = editedNames[item.id] !== undefined;
                                    const currentName = isEditing ? editedNames[item.id] : item.name;
                                    const nameChanged = isEditing && currentName !== item.name && currentName.trim() !== '';
                                    return (
                                    <div key={item.id || idx} className="flex flex-col gap-1 bg-black/20 p-2 rounded-xl">
                                        <div className="flex justify-between items-center bg-gray-900/50 px-2 py-1 rounded-lg">
                                            {user.role === 'admin' && selectedCompany !== 'Soft Rose' ? (
                                                <input
                                                    type="text"
                                                    value={currentName || ''}
                                                    onChange={e => setEditedNames(prev => ({...prev, [item.id]: e.target.value}))}
                                                    className="w-full text-xs text-white bg-transparent border-b border-transparent focus:border-blue-400 outline-none font-bold"
                                                />
                                            ) : (
                                                <span className="text-xs text-white whitespace-normal break-words font-bold flex-1">{item.name}</span>
                                            )}
                                            {user.role === 'admin' && selectedCompany !== 'Soft Rose' && (
                                                <div className="flex items-center gap-1 ml-2 border-l border-white/10 pl-2">
                                                    {nameChanged && (
                                                        <button onClick={() => handleInlineEditSave(item, currentName)} className="text-green-400 hover:text-green-300 p-1 bg-green-500/20 rounded-lg" title="حفظ"><Check size={14} /></button>
                                                    )}
                                                    <button onClick={() => handleDeleteItem(item)} className="text-red-400 hover:text-red-300 p-1" title="حذف"><Trash2 size={14} /></button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-end mt-1 px-1">
                                            <input 
                                                type="number" 
                                                placeholder="أدخل السعر..." 
                                                className="w-full max-w-[120px] p-2 bg-gray-700/50 rounded-lg text-white text-center text-xs font-black border border-white/5 focus:border-blue-400 focus:bg-gray-700 outline-none transition"
                                                value={pricesState[item.id] || ''}
                                                onChange={e => {
                                                    setPricesState(prev => ({
                                                        ...prev,
                                                        [item.id]: parseFloat(e.target.value) || 0
                                                    }));
                                                }}
                                            />
                                        </div>
                                    </div>
                                )})}
                                {catItems.length === 0 && <div className="text-white/40 text-xs col-span-2 text-center p-2">لا يوجد أصناف في هذا القسم.</div>}
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50">
                <button onClick={handleSaveReport} disabled={Object.keys(pricesState).length === 0} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:active:scale-100 w-full py-5 text-white rounded-3xl font-black shadow-2xl flex items-center justify-center gap-2 transform active:scale-95 transition">
                    <Save size={20}/> حفظ وترحيل أسعار المنافسين
                </button>
            </div>
        </div>
    );
};

export default CompetitorPrices;
