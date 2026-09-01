import { onCachedValue } from "../firebaseCache";

import React, { useState, useEffect } from 'react';
import { ref, push, onValue, set, get, update, remove } from "firebase/database";
import { db } from '../firebase';
import { User, ProductItem, UserTarget } from '../types';
import { PRODUCTS_FACIAL, PRODUCTS_KITCHEN, PRODUCTS_TOILET, PRODUCTS_DOLPHIN } from '../constants';
import { Save, Plus, Calculator, Target, TrendingUp, AlertCircle, Edit, Trash2, Check, X } from 'lucide-react';

interface Props {
    user: User;
    markets: string[];
    theme: string;
    products: {id: string, name: string, category: string, order?: number}[];
}

const DailySales: React.FC<Props> = ({ user, markets, theme, products }) => {
    const [selectedMarket, setSelectedMarket] = useState('');
    const [salesItems, setSalesItems] = useState<ProductItem[]>([]);
    const [userTarget, setUserTarget] = useState<UserTarget | null>(null);
    const [myAchieved, setMyAchieved] = useState(0);
    
    // حالات التعديل الجديدة
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [tempName, setTempName] = useState('');
    const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

    const handleAddMarket = async () => {
        const newMarket = prompt("أدخل اسم الماركت الجديد:");
        if (newMarket && newMarket.trim()) {
            await push(ref(db, 'settings/markets'), { name: newMarket.trim(), createdBy: 'system' });
            alert("تم إضافة الماركت بنجاح");
        }
    };

    useEffect(() => {
        setSalesItems(prev => {
            return products.map(p => {
                const existing = prev.find(i => i.id === p.id);
                if (existing) {
                    return { ...existing, name: p.name, category: p.category };
                }
                return {
                    id: p.id,
                    name: p.name,
                    price: 0,
                    qty: 0,
                    category: p.category
                };
            });
        });
    }, [products]);

    useEffect(() => {
        if (user.key) {
            const targetRef = ref(db, `targets/${user.key}`);
            const unsub = onCachedValue(targetRef, 'targets', (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val() as UserTarget;
                    const now = new Date();
                    const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
                    
                    if (data.lastResetMonth !== currentMonth) {
                        const historyRef = ref(db, `target_history/${user.key}`);
                        push(historyRef, {
                            userId: data.userId || user.key,
                            employeeName: data.employeeName || user.name || 'غير معروف',
                            month: data.lastResetMonth,
                            targetAmount: data.finalTarget || 0,
                            achievedAmount: data.achieved || 0
                        });

                        update(targetRef, {
                            achieved: 0,
                            lastResetMonth: currentMonth
                        });
                    } else {
                        setUserTarget(data);
                    }
                } else {
                    setUserTarget(null);
                }
            });
            return () => unsub();
        }
    }, [user.key, user.name]);

    
    useEffect(() => {
        const salesRef = ref(db, 'sales');
        const unsubscribe = onCachedValue(salesRef, `sales`, (snapshot) => {
            if (snapshot.exists()) {
                const allSales = Object.values(snapshot.val() || {}) as any[];
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
                
                const sum = allSales.filter(s => {
                    const nameMatches = s.employeeName?.trim().toLowerCase() === user.name.trim().toLowerCase();
                    return nameMatches && s.timestamp >= start && s.timestamp <= end;
                }).reduce((acc, s) => acc + (Number(s.total) || 0), 0);
                
                setMyAchieved(sum);
            } else {
                setMyAchieved(0);
            }
        });
        return () => unsubscribe();
    }, [user.name]);

        const handleDragStart = (e: React.DragEvent, id: string) => {
        if (user.role !== 'admin') return;
        e.dataTransfer.setData('text/plain', id);
        setDraggedItemId(id);
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (user.role !== 'admin') return;
        e.preventDefault();
    };

    
    const handleCategoryDrop = async (e: React.DragEvent, targetCategory: string) => {
        if (user.role !== 'admin') return;
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId) return;

        // Only handle if dropping directly on the category container (not on an item)
        // Check if the drop target is the container itself
        if (e.target === e.currentTarget) {
            const draggedIndex = products.findIndex(p => p.id === draggedId);
            if (draggedIndex === -1) return;

            const newProducts = [...products];
            const [removed] = newProducts.splice(draggedIndex, 1);
            removed.category = targetCategory;
            
            // Append to the end of this category
            // We can just push it to the end of newProducts, or find the last item of this category
            const lastCatIndex = newProducts.findLastIndex(p => p.category === targetCategory);
            if (lastCatIndex !== -1) {
                newProducts.splice(lastCatIndex + 1, 0, removed);
            } else {
                newProducts.push(removed);
            }

            const updates: any = {};
            newProducts.forEach((p, idx) => {
                updates[`${p.id}/order`] = idx;
                if (p.id === draggedId) {
                    updates[`${p.id}/category`] = targetCategory;
                }
            });

            await update(ref(db, 'products'), updates);
            setDraggedItemId(null);
        }
    };


    const handleDrop = async (e: React.DragEvent, targetId: string, targetCategory: string) => {
        if (user.role !== 'admin') return;
        e.preventDefault();
        const draggedId = e.dataTransfer.getData('text/plain');
        if (!draggedId || draggedId === targetId) return;

        const draggedIndex = products.findIndex(p => p.id === draggedId);
        const targetIndex = products.findIndex(p => p.id === targetId);
        if (draggedIndex === -1 || targetIndex === -1) return;

        const newProducts = [...products];
        const [removed] = newProducts.splice(draggedIndex, 1);
        removed.category = targetCategory;
        newProducts.splice(targetIndex, 0, removed);

        const updates: any = {};
        newProducts.forEach((p, idx) => {
            updates[`${p.id}/order`] = idx;
            if (p.id === draggedId) {
                updates[`${p.id}/category`] = targetCategory;
            }
        });

        await update(ref(db, 'products'), updates);
        setDraggedItemId(null);
    };

    const updateItem = (id: string, field: string, value: any) => {
        setSalesItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
    };

    const deleteItem = async (id: string) => {
        if (confirm("هل تريد حذف هذا الصنف من القائمة الحالية؟")) {
            setSalesItems(prev => prev.filter(i => i.id !== id));
            if (user.role === 'admin') {
                await remove(ref(db, `products/${id}`));
            }
        }
    };

    const startEditingName = (id: string, currentName: string) => {
        setEditingItemId(id);
        setTempName(currentName);
    };

    const saveName = async (id: string) => {
        if (!tempName.trim()) return;
        const newName = tempName;
        setSalesItems(prev => prev.map(i => i.id === id ? { ...i, name: newName } : i));
        setEditingItemId(null);
        // Update in Firebase
        await update(ref(db, `products/${id}`), { name: newName });
    };

    const addCustomItem = async (category: string) => {
        const newItemName = prompt("ادخل اسم الصنف الجديد:");
        if (newItemName && newItemName.trim()) {
            const newRef = push(ref(db, 'products'));
            await set(newRef, { name: newItemName.trim(), category });
        }
    };

    const currentTotal = salesItems.reduce((sum, item) => sum + ((item.price || 0) * (item.qty || 0)), 0);

    const activeAchieved = myAchieved + currentTotal;
    const remaining = userTarget ? Math.max(0, Number(userTarget.finalTarget) - activeAchieved) : 0;
    const progressPercent = userTarget ? Math.min(100, Math.round((activeAchieved / Number(userTarget.finalTarget)) * 100)) : 0;

    const handleSave = async () => {
        const sold = salesItems.filter(i => i.qty > 0 && i.price > 0);
        if (!sold.length) return alert("أدخل بيانات صحيحة");

        await push(ref(db, 'sales'), {
            market: selectedMarket,
            employeeName: user.name,
            username: user.username,
            date: new Date().toLocaleDateString('ar-EG'),
            timestamp: Date.now(),
            items: sold,
            total: currentTotal
        });

        if (user.key && userTarget) {
            const targetRef = ref(db, `targets/${user.key}`);
            const newAchieved = myAchieved + currentTotal;
            await update(targetRef, { achieved: newAchieved });
        }

        alert("تم الحفظ بنجاح");
        setSalesItems(prev => prev.map(i => ({...i, price: 0, qty: 0})));
    };

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-white">المبيعات اليومية</h2>
                
                <div className="flex flex-wrap gap-4">
                    <div className="bg-blue-600/20 border border-blue-500/50 p-4 rounded-3xl flex items-center gap-4 shadow-lg min-w-[200px]">
                        <div className="bg-blue-600 p-2 rounded-2xl text-white">
                            <Calculator size={24} />
                        </div>
                        <div>
                            <div className="text-[10px] font-black opacity-60 text-white uppercase tracking-widest">إجمالي المبيعات الحالية</div>
                            <div className="text-2xl font-black text-blue-400">
                                {(currentTotal || 0).toLocaleString()} <span className="text-xs">ج.م</span>
                            </div>
                        </div>
                    </div>

                    {userTarget && (
                        <>
                            <div className="bg-purple-600/20 border border-purple-500/50 p-4 rounded-3xl flex items-center gap-4 shadow-lg min-w-[280px]">
                                <div className="bg-purple-600 p-2 rounded-2xl text-white">
                                    <Target size={24} />
                                </div>
                                <div className="flex-1">
                                    <div className="text-[10px] font-black opacity-60 text-white uppercase tracking-widest">التارجت الشهري</div>
                                    <div className="flex justify-between items-end">
                                        <div className="text-2xl font-black text-purple-400">
                                            {(userTarget.finalTarget || 0).toLocaleString()} <span className="text-xs">ج.م</span>
                                        </div>
                                        <div className="text-sm font-bold text-green-400">
                                            {progressPercent}%
                                        </div>
                                    </div>
                                    <div className="w-full bg-black/40 h-1.5 rounded-full mt-1 overflow-hidden">
                                        <div className="bg-green-500 h-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-orange-600/20 border border-orange-500/50 p-4 rounded-3xl flex items-center gap-4 shadow-lg min-w-[200px]">
                                <div className="bg-orange-600 p-2 rounded-2xl text-white">
                                    <TrendingUp size={24} />
                                </div>
                                <div>
                                    <div className="text-[10px] font-black opacity-60 text-white uppercase tracking-widest">المتبقي من التارجت</div>
                                    <div className="text-2xl font-black text-orange-400">
                                        {(remaining || 0).toLocaleString()} <span className="text-xs">ج.م</span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <label className="text-white text-sm font-bold opacity-80">الماركت</label>
                    {user.role === 'admin' && (
                        <button onClick={handleAddMarket} className="text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-1">
                            <Plus size={12}/> إضافة ماركت
                        </button>
                    )}
                </div>
                <select className="w-full p-4 rounded-2xl bg-gray-800 text-white border border-white/10" value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                    <option value="">اختر الماركت من القائمة...</option>
                    {markets.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>

            {[
                { label: 'مناديل السحب (Facial)', key: 'Facial' },
                { label: 'مناديل المطبخ (Kitchen)', key: 'Kitchen' },
                { label: 'تواليت (Toilet)', key: 'Toilet' },
                { label: 'دولفن (Dolphin)', key: 'Dolphin' }
            ].map(cat => (
                <div key={cat.key} className="bg-gray-800 p-4 rounded-3xl border border-white/5 shadow-xl">
                    <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
                        <h3 className="font-bold text-blue-400">{cat.label}</h3>
                        <button 
                            onClick={() => addCustomItem(cat.key)}
                            className="bg-green-600 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 shadow-lg active:scale-95 transition"
                        >
                            <Plus size={14}/> أضف صنف
                        </button>
                    </div>
                    
                    <div className="grid grid-cols-12 gap-2 mb-2 px-2 text-[10px] font-black opacity-60 uppercase text-white">
                        <div className="col-span-4 pr-2">الصنف</div>
                        <div className="col-span-2 text-center">السعر</div>
                        <div className="col-span-2 text-center">الكمية</div>
                        <div className="col-span-2 text-center">المجموع</div>
                        <div className="col-span-2 text-center">إجراء</div>
                    </div>

                    <div className="space-y-2 min-h-[50px] pb-4" onDragOver={handleDragOver} onDrop={(e) => handleCategoryDrop(e, cat.key)}>
                        {salesItems.filter(i => i.category === cat.key).map(item => (
                            <div 
        key={item.id} 
        draggable={user.role === 'admin'}
        onDragStart={(e) => handleDragStart(e, item.id)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, item.id, cat.key)}
        className={`grid grid-cols-12 gap-2 items-center bg-black/20 p-2 rounded-2xl border transition ${draggedItemId === item.id ? 'opacity-50 border-dashed border-white/50' : 'border-transparent hover:border-white/10'} ${user.role === 'admin' ? 'cursor-move' : ''}`}
    >
                                <div className="col-span-4 pr-2 font-bold text-white">
                                    {editingItemId === item.id ? (
                                        <div className="flex gap-1">
                                            <select 
                                                className="w-full bg-gray-700 border border-blue-500/50 p-1.5 rounded-lg text-white text-[10px] font-bold"
                                                value={tempName}
                                                onChange={e => setTempName(e.target.value)}
                                                autoFocus
                                            >
                                                <option value="">-- اختر الصنف --</option>
                                                {Array.from(new Set([...PRODUCTS_FACIAL, ...PRODUCTS_KITCHEN, ...PRODUCTS_TOILET, ...PRODUCTS_DOLPHIN, ...products.map(p => p.name)])).sort().map(pName => (
                                                    <option key={pName} value={pName}>{pName}</option>
                                                ))}
                                            </select>
                                            <button onClick={() => saveName(item.id)} className="text-green-400 p-1 hover:bg-green-400/10 rounded"><Check size={14}/></button>
                                            <button onClick={() => setEditingItemId(null)} className="text-red-400 p-1 hover:bg-red-400/10 rounded"><X size={14}/></button>
                                        </div>
                                    ) : (
                                        <span className="text-[11px] whitespace-normal break-words block" title={item.name}>{item.name}</span>
                                    )}
                                </div>
                                <div className="col-span-2">
                                    <input type="number" placeholder="0" className="w-full bg-gray-700 border border-white/10 p-2 rounded-xl text-white text-center text-xs font-bold" value={item.price || ''} onChange={e => updateItem(item.id, 'price', parseFloat(e.target.value))} />
                                </div>
                                <div className="col-span-2">
                                    <input type="number" placeholder="0" className="w-full bg-gray-700 border border-white/10 p-2 rounded-xl text-white text-center text-xs font-bold" value={item.qty || ''} onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value))} />
                                </div>
                                <div className="col-span-2 text-center font-black text-xs text-green-400">
                                    {((item.price || 0) * (item.qty || 0)).toLocaleString()}
                                </div>
                                <div className="col-span-2 flex justify-center gap-1">
                                    {user.role === 'admin' && editingItemId !== item.id && (
                                        <button onClick={() => startEditingName(item.id, item.name)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-xl transition" title="تعديل المسمى">
                                            <Edit size={14} />
                                        </button>
                                    )}
                                    <button onClick={() => deleteItem(item.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition" title="حذف">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            
            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-50">
                <button onClick={handleSave} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-3xl font-black shadow-2xl flex justify-center items-center gap-2 transform active:scale-95 transition">
                    <Save size={20} /> حفظ وترحيل المبيعات
                </button>
            </div>
        </div>
    );
};

export default DailySales;
