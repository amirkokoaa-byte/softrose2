import { onCachedValue } from "../firebaseCache";

import React, { useState, useEffect, useMemo } from 'react';
import { ref, push, onValue, set, get, update, remove } from "firebase/database";
import { db } from '../firebase';
import { User, ProductItem, UserTarget } from '../types';
import { PRODUCTS_FACIAL, PRODUCTS_KITCHEN, PRODUCTS_TOILET, PRODUCTS_DOLPHIN, INITIAL_MARKETS } from '../constants';
import { Save, Plus, Calculator, Target, TrendingUp, AlertCircle, Edit, Trash2, Check, X, Clock } from 'lucide-react';

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
    const [showDailyLimitModal, setShowDailyLimitModal] = useState(false);

    // إجمالي التارجت والمحقق والمتبقي الخاص بصلاحيات المدير (Admin)
    const [adminTotalTarget, setAdminTotalTarget] = useState(0);
    const [adminTotalAchieved, setAdminTotalAchieved] = useState(0);
    const [adminTargetsList, setAdminTargetsList] = useState<UserTarget[]>([]);
    const [currentMonthSalesList, setCurrentMonthSalesList] = useState<any[]>([]);
    const [usersList, setUsersList] = useState<User[]>([]);
    const [employeeRouteBranches, setEmployeeRouteBranches] = useState<string[]>([]);
    
    // جلب الفروع المسجلة في خط السير للموظف لحظياً
    useEffect(() => {
        const routesRef = ref(db, 'routes');
        const unsubRoutes = onCachedValue(routesRef, 'routes', (snapRoutes) => {
            const usersRef = ref(db, 'users');
            const unsubUsers = onCachedValue(usersRef, 'users', (snapUsers) => {
                const allRoutes = snapRoutes.exists() ? snapRoutes.val() : {};
                const allUsers = snapUsers.exists() ? snapUsers.val() : {};

                let userKey = user.key;
                if (!userKey && allUsers) {
                    const foundKey = Object.keys(allUsers).find(k => 
                        allUsers[k]?.username?.toString().trim() === user.username?.trim() ||
                        allUsers[k]?.name?.toString().trim() === user.name?.trim()
                    );
                    if (foundKey) userKey = foundKey;
                }

                let rawRoute: any = null;
                if (userKey && allRoutes[userKey]) {
                    rawRoute = allRoutes[userKey];
                } else if (user.username && allRoutes[user.username]) {
                    rawRoute = allRoutes[user.username];
                } else if (user.name && allRoutes[user.name]) {
                    rawRoute = allRoutes[user.name];
                } else if (userKey && allUsers[userKey]?.branches) {
                    rawRoute = allUsers[userKey].branches;
                } else if (user.branches) {
                    rawRoute = user.branches;
                }

                if (rawRoute) {
                    let branches: string[] = [];
                    if (Array.isArray(rawRoute)) {
                        branches = rawRoute;
                    } else if (typeof rawRoute === 'object') {
                        branches = Object.values(rawRoute);
                    }
                    const clean = branches
                        .map(b => (typeof b === 'string' ? b.trim() : ''))
                        .filter(Boolean);
                    setEmployeeRouteBranches(clean);
                } else {
                    setEmployeeRouteBranches([]);
                }
            });
            return () => unsubUsers();
        });
        return () => unsubRoutes();
    }, [user.key, user.username, user.name, user.branches]);

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
            const unsub = onCachedValue(targetRef, `targets_${user.key}`, (snapshot, isCached) => {
                if (snapshot.exists()) {
                    const data = snapshot.val() as UserTarget;
                    const now = new Date();
                    const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
                    
                    if (!isCached && data && typeof data.finalTarget !== 'undefined' && data.lastResetMonth !== currentMonth) {
                        if (data.lastResetMonth) {
                            const historyRef = ref(db, `target_history/${user.key}`);
                            push(historyRef, {
                                userId: data.userId || user.key,
                                employeeName: data.employeeName || user.name || 'غير معروف',
                                month: data.lastResetMonth,
                                targetAmount: data.finalTarget || 0,
                                achievedAmount: data.achieved || 0
                            });
                        }

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

    // حصر القائمة فقط على الفروع المسجلة في خط السير للموظف
    const allAvailableMarkets = useMemo(() => {
        if (employeeRouteBranches.length > 0) {
            return employeeRouteBranches;
        }
        if (user.role === 'admin') {
            const set = new Set<string>(markets);
            if (selectedMarket) set.add(selectedMarket);
            INITIAL_MARKETS.forEach(m => set.add(m));
            return Array.from(set).filter(Boolean).sort();
        }
        return [];
    }, [employeeRouteBranches, user.role, markets, selectedMarket]);

    useEffect(() => {
        if (allAvailableMarkets.length > 0) {
            if (!selectedMarket || !allAvailableMarkets.includes(selectedMarket)) {
                setSelectedMarket(allAvailableMarkets[0]);
            }
        }
    }, [allAvailableMarkets, selectedMarket]);
    
    useEffect(() => {
        if (user.role === 'admin') {
            const usersRef = ref(db, 'users');
            const unsubUsers = onCachedValue(usersRef, 'users', (snapshot) => {
                if (snapshot.exists()) {
                    const list: User[] = [];
                    snapshot.forEach((child) => {
                        list.push({ key: child.key!, ...child.val() });
                    });
                    setUsersList(list);
                } else {
                    setUsersList([]);
                }
            });
            return () => unsubUsers();
        }
    }, [user.role]);

    useEffect(() => {
        if (user.role === 'admin') {
            const targetsRef = ref(db, 'targets');
            const unsubTargets = onCachedValue(targetsRef, 'targets', (snapshot) => {
                if (snapshot.exists()) {
                    const targetsData = Object.values(snapshot.val() || {}) as UserTarget[];
                    setAdminTargetsList(targetsData);
                    const sum = targetsData.reduce((acc, t) => acc + (Number(t.finalTarget) || 0), 0);
                    setAdminTotalTarget(sum);
                } else {
                    setAdminTargetsList([]);
                    setAdminTotalTarget(0);
                }
            });
            return () => unsubTargets();
        }
    }, [user.role]);

    useEffect(() => {
        const salesRef = ref(db, 'sales');
        const unsubscribe = onCachedValue(salesRef, `sales`, (snapshot) => {
            if (snapshot.exists()) {
                const allSales = Object.values(snapshot.val() || {}) as any[];
                setCurrentMonthSalesList(allSales);
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
                
                const sum = allSales.filter(s => {
                    const nameMatches = s.employeeName?.trim().toLowerCase() === user.name.trim().toLowerCase();
                    const t = Number(s.timestamp) || (s.date ? new Date(s.date).getTime() : 0);
                    return nameMatches && t >= start && t <= end;
                }).reduce((acc, s) => acc + (Number(s.total) || 0), 0);
                
                setMyAchieved(sum);

                if (user.role === 'admin') {
                    const allSum = allSales.filter(s => {
                        const t = Number(s.timestamp) || (s.date ? new Date(s.date).getTime() : 0);
                        return t >= start && t <= end;
                    }).reduce((acc, s) => acc + (Number(s.total) || 0), 0);
                    setAdminTotalAchieved(allSum);
                }
            } else {
                setCurrentMonthSalesList([]);
                setMyAchieved(0);
                setAdminTotalAchieved(0);
            }
        });
        return () => unsubscribe();
    }, [user.name, user.role]);

    // حسابات التارجت والمحقق لكل موظف لحظياً للمدير (مع استبعاد المؤرشفين وحسابات المدير)
    const employeeTargetCards = useMemo(() => {
        if (user.role !== 'admin') return [];
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

        const archivedEmployeeNames = new Set(
            usersList.filter(u => u.isArchived).map(u => (u.name || '').trim().toLowerCase())
        );
        const adminNames = new Set(
            usersList.filter(u => u.role === 'admin').map(u => (u.name || '').trim().toLowerCase())
        );

        return adminTargetsList
            .filter(t => {
                const name = (t.employeeName || '').trim();
                const lowerName = name.toLowerCase();
                if (!name) return false;
                if (archivedEmployeeNames.has(lowerName)) return false;
                if (adminNames.has(lowerName)) return false;
                return true;
            })
            .map(t => {
                const name = t.employeeName.trim();
                const lowerName = name.toLowerCase();
                const target = Number(t.finalTarget) || 0;

                const achieved = currentMonthSalesList
                    .filter(s => {
                        const empMatches = s.employeeName?.trim().toLowerCase() === lowerName;
                        const userMatches = t.userId && s.username && s.username === t.userId;
                        const timestamp = Number(s.timestamp) || (s.date ? new Date(s.date).getTime() : 0);
                        return (empMatches || userMatches) && timestamp >= start && timestamp <= end;
                    })
                    .reduce((sum, s) => sum + (Number(s.total) || 0), 0);

                return {
                    id: t.userId || name,
                    name,
                    target,
                    achieved
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    }, [adminTargetsList, currentMonthSalesList, usersList, user.role]);

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

    // حسابات الإدارة المحدثة لحظياً
    const adminActiveAchieved = adminTotalAchieved + currentTotal;
    const adminRemaining = Math.max(0, adminTotalTarget - adminActiveAchieved);
    const adminProgressPercent = adminTotalTarget > 0 ? Math.min(100, Math.round((adminActiveAchieved / adminTotalTarget) * 100)) : 0;

    // حساب عدد مرات تسجيل المبيعات لليوم الحالي
    const isSaleFromToday = (s: any, now: Date, todayStart: number, todayEnd: number) => {
        const t = Number(s.timestamp);
        if (t && !isNaN(t) && t > 0) {
            return t >= todayStart && t <= todayEnd;
        }
        if (s.date) {
            const todayArabic = now.toLocaleDateString('ar-EG');
            const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            return s.date === todayArabic || s.date === todayIso;
        }
        return false;
    };

    const todaySalesCount = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

        return currentMonthSalesList.filter(s => {
            const isUser = (s.username && s.username === user.username) ||
                           (s.employeeName && s.employeeName.trim().toLowerCase() === user.name.trim().toLowerCase());
            return isUser && isSaleFromToday(s, now, todayStart, todayEnd);
        }).length;
    }, [currentMonthSalesList, user.username, user.name]);

    const handleSave = async () => {
        // 1. فحص التوقيت: يبدأ تسجيل المبيعات من الساعة 12 مساء وينتهي 12 صباحا
        const now = new Date();
        const currentHour = now.getHours(); // 0 to 23
        if (currentHour < 12) {
            alert("تسجيل المبيعات من ١٢ مساء حتي ١٢ صباحا فقط");
            return;
        }

        // 2. فحص عدد مرات التسجيل في اليوم: تسجيل مبيعات واحدة فقط في اليوم
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
        const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();

        try {
            const salesSnap = await get(ref(db, 'sales'));
            const allSales = salesSnap.exists() ? (Object.values(salesSnap.val() || {}) as any[]) : currentMonthSalesList;
            const userTodaySales = allSales.filter(s => {
                const isUser = (s.username && s.username === user.username) ||
                               (s.employeeName && s.employeeName.trim().toLowerCase() === user.name.trim().toLowerCase());
                return isUser && isSaleFromToday(s, now, todayStart, todayEnd);
            });

            if (userTodaySales.length >= 1) {
                setShowDailyLimitModal(true);
                return;
            }
        } catch (err) {
            if (todaySalesCount >= 1) {
                setShowDailyLimitModal(true);
                return;
            }
        }

        let finalMarket = (selectedMarket || '').trim();
        if (!finalMarket && userTarget?.market) {
            finalMarket = userTarget.market.trim();
        }
        if (!finalMarket && user.key) {
            try {
                const targetSnap = await get(ref(db, `targets/${user.key}`));
                if (targetSnap.exists() && targetSnap.val()?.market) {
                    finalMarket = String(targetSnap.val().market).trim();
                }
            } catch (e) {
                console.error("Error fetching target market:", e);
            }
        }
        if (!finalMarket && (user.name?.toLowerCase().includes('malak') || user.username?.includes('ملك') || user.name?.toLowerCase().includes('asmaa') || user.username?.includes('اسماء'))) {
            finalMarket = 'محلاوي الحي العاشر';
        }
        if (!finalMarket && (user.name?.toLowerCase().includes('omnia') || user.username?.includes('امنيه') || user.username?.includes('أمنية'))) {
            finalMarket = 'جمال سلامه ميدان الجامع';
        }
        if (!finalMarket && (user.name?.toLowerCase().includes('toqa') || user.username?.includes('تقي') || user.username?.includes('تقى'))) {
            finalMarket = 'محلاوي التجمع الخامس';
        }
        if (!finalMarket && (user.name?.toLowerCase().includes('mena') || user.username?.includes('منه') || user.username?.includes('منة'))) {
            finalMarket = 'فرجاني ترعه الجبل';
        }
        if (!finalMarket && user.market) {
            finalMarket = user.market.trim();
        }
        if (!finalMarket && user.branches && user.branches.length > 0) {
            finalMarket = user.branches[0].trim();
        }
        if (!finalMarket) {
            const prevSaleWithMarket = currentMonthSalesList.find(s => 
                ((s.username && s.username === user.username) || (s.employeeName && s.employeeName.trim().toLowerCase() === user.name.trim().toLowerCase())) && 
                s.market && s.market.trim()
            );
            if (prevSaleWithMarket) {
                finalMarket = prevSaleWithMarket.market.trim();
            }
        }

        if (!finalMarket) {
            alert("يرجى اختيار الماركت أولاً");
            return;
        }

        if (selectedMarket !== finalMarket) {
            setSelectedMarket(finalMarket);
        }

        const sold = salesItems.filter(i => i.qty > 0 && i.price > 0);
        if (!sold.length) return alert("أدخل بيانات صحيحة");

        await push(ref(db, 'sales'), {
            market: finalMarket,
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
                
                {user.role === 'admin' ? (
                    /* بطاقات الإدارة المحدثة لحظياً: إجمالي التارجت والمحقق والمتبقي بجانب بعض في الأعلى */
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-4 w-full md:w-auto">
                        {/* 1. إجمالي التارجت */}
                        <div className="bg-purple-600/20 border border-purple-500/50 p-2 sm:p-4 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-center sm:gap-4 shadow-lg min-w-0">
                            <div className="bg-purple-600 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl text-white hidden sm:block">
                                <Target size={22} />
                            </div>
                            <div className="text-center sm:text-right min-w-0 w-full">
                                <div className="text-[9px] sm:text-[10px] font-black opacity-70 text-white uppercase tracking-tight truncate">إجمالي التارجت</div>
                                <div className="text-xs sm:text-2xl font-black text-purple-400 truncate">
                                    {(adminTotalTarget || 0).toLocaleString()} <span className="text-[9px] sm:text-xs">ج.م</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. المحقق */}
                        <div className="bg-emerald-600/20 border border-emerald-500/50 p-2 sm:p-4 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-center sm:gap-4 shadow-lg min-w-0">
                            <div className="bg-emerald-600 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl text-white hidden sm:block">
                                <TrendingUp size={22} />
                            </div>
                            <div className="text-center sm:text-right min-w-0 w-full">
                                <div className="flex items-center justify-center sm:justify-between gap-1">
                                    <span className="text-[9px] sm:text-[10px] font-black opacity-70 text-white uppercase tracking-tight truncate">المحقق</span>
                                    <span className="text-[8px] sm:text-xs font-bold text-emerald-400 font-mono hidden sm:inline">{adminProgressPercent}%</span>
                                </div>
                                <div className="text-xs sm:text-2xl font-black text-emerald-400 truncate">
                                    {(adminActiveAchieved || 0).toLocaleString()} <span className="text-[9px] sm:text-xs">ج.م</span>
                                </div>
                                <div className="w-full bg-black/40 h-1 sm:h-1.5 rounded-full mt-0.5 sm:mt-1 overflow-hidden">
                                    <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${adminProgressPercent}%` }}></div>
                                </div>
                            </div>
                        </div>

                        {/* 3. المتبقي */}
                        <div className="bg-orange-600/20 border border-orange-500/50 p-2 sm:p-4 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-center sm:gap-4 shadow-lg min-w-0">
                            <div className="bg-orange-600 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl text-white hidden sm:block">
                                <Calculator size={22} />
                            </div>
                            <div className="text-center sm:text-right min-w-0 w-full">
                                <div className="text-[9px] sm:text-[10px] font-black opacity-70 text-white uppercase tracking-tight truncate">المتبقي</div>
                                <div className="text-xs sm:text-2xl font-black text-orange-400 truncate">
                                    {(adminRemaining || 0).toLocaleString()} <span className="text-[9px] sm:text-xs">ج.م</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* بطاقات حسابات الموظفين */
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-4 w-full md:w-auto">
                        <div className="bg-blue-600/20 border border-blue-500/50 p-2 sm:p-4 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-center sm:gap-4 shadow-lg min-w-0">
                            <div className="bg-blue-600 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl text-white hidden sm:block">
                                <Calculator size={22} />
                            </div>
                            <div className="text-center sm:text-right min-w-0 w-full">
                                <div className="text-[9px] sm:text-[10px] font-black opacity-70 text-white uppercase tracking-tight truncate">إجمالي البيع اليومي</div>
                                <div className="text-xs sm:text-2xl font-black text-blue-400 truncate">
                                    {(currentTotal || 0).toLocaleString()} <span className="text-[9px] sm:text-xs">ج.م</span>
                                </div>
                            </div>
                        </div>

                        {userTarget ? (
                            <>
                                <div className="bg-purple-600/20 border border-purple-500/50 p-2 sm:p-4 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-center sm:gap-4 shadow-lg min-w-0">
                                    <div className="bg-purple-600 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl text-white hidden sm:block">
                                        <Target size={22} />
                                    </div>
                                    <div className="text-center sm:text-right min-w-0 w-full">
                                        <div className="text-[9px] sm:text-[10px] font-black opacity-70 text-white uppercase tracking-tight truncate">التارجت الشهري</div>
                                        <div className="flex items-center justify-center sm:justify-between gap-1">
                                            <div className="text-xs sm:text-2xl font-black text-purple-400 truncate">
                                                {(userTarget.finalTarget || 0).toLocaleString()} <span className="text-[9px] sm:text-xs">ج.م</span>
                                            </div>
                                            <div className="text-[10px] sm:text-sm font-bold text-green-400 hidden sm:block">
                                                {progressPercent}%
                                            </div>
                                        </div>
                                        <div className="w-full bg-black/40 h-1 sm:h-1.5 rounded-full mt-0.5 sm:mt-1 overflow-hidden">
                                            <div className="bg-green-500 h-full transition-all duration-1000" style={{ width: `${progressPercent}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-orange-600/20 border border-orange-500/50 p-2 sm:p-4 rounded-2xl sm:rounded-3xl flex flex-col sm:flex-row items-center sm:gap-4 shadow-lg min-w-0">
                                    <div className="bg-orange-600 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl text-white hidden sm:block">
                                        <TrendingUp size={22} />
                                    </div>
                                    <div className="text-center sm:text-right min-w-0 w-full">
                                        <div className="text-[9px] sm:text-[10px] font-black opacity-70 text-white uppercase tracking-tight truncate">المتبقي من التارجت</div>
                                        <div className="text-xs sm:text-2xl font-black text-orange-400 truncate">
                                            {(remaining || 0).toLocaleString()} <span className="text-[9px] sm:text-xs">ج.م</span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="bg-purple-600/10 border border-purple-500/20 p-2 sm:p-4 rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center text-center opacity-60">
                                    <span className="text-[9px] sm:text-xs font-bold text-white">التارجت</span>
                                    <span className="text-[10px] sm:text-sm font-mono">-</span>
                                </div>
                                <div className="bg-orange-600/10 border border-orange-500/20 p-2 sm:p-4 rounded-2xl sm:rounded-3xl flex flex-col items-center justify-center text-center opacity-60">
                                    <span className="text-[9px] sm:text-xs font-bold text-white">المتبقي</span>
                                    <span className="text-[10px] sm:text-sm font-mono">-</span>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* مربعات التارجت والمحقق لكل موظف - محدث لحظياً للمدير */}
            {user.role === 'admin' && employeeTargetCards.length > 0 && (
                <div className="bg-gray-900/60 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-white/5 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-400 px-1">
                        <span>تارجت ومحقق الموظفين (محدث لحظياً):</span>
                        <span className="text-[10px] text-purple-400 font-mono font-bold">{employeeTargetCards.length} موظف</span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 w-full">
                        {employeeTargetCards.map(emp => (
                            <div 
                                key={emp.id} 
                                className="bg-gray-800/90 hover:bg-gray-800 border border-white/10 p-2.5 sm:p-3 rounded-2xl text-right shadow transition flex flex-col justify-between"
                            >
                                {/* سطر 1: الاسم */}
                                <div className="font-bold text-white text-xs sm:text-sm truncate pb-1 border-b border-white/5">
                                    {emp.name}
                                </div>
                                <div className="space-y-1 mt-1.5">
                                    {/* سطر 2: التارجت في سطر واحد واضح */}
                                    <div className="flex items-center justify-between font-bold text-[11px] sm:text-xs">
                                        <span className="text-gray-400">التارجت:</span>
                                        <span className="text-purple-400 font-mono">
                                            {emp.target.toLocaleString()} <span className="text-[9px]">ج.م</span>
                                        </span>
                                    </div>
                                    {/* سطر 3: المحقق في سطر واحد واضح */}
                                    <div className="flex items-center justify-between font-bold text-[11px] sm:text-xs">
                                        <span className="text-gray-400">المحقق:</span>
                                        <span className="text-emerald-400 font-mono">
                                            {emp.achieved.toLocaleString()} <span className="text-[9px]">ج.م</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

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
                    <option value="">{allAvailableMarkets.length > 0 ? "اختر الماركت (خط السير)..." : "لا توجد فروع مسجلة في خط السير"}</option>
                    {allAvailableMarkets.map(m => <option key={m} value={m}>{m}</option>)}
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
                        <div className={`${user.role === 'admin' ? 'col-span-4' : 'col-span-6'} pr-2`}>الصنف</div>
                        <div className="col-span-2 text-center">السعر</div>
                        <div className="col-span-2 text-center">الكمية</div>
                        <div className="col-span-2 text-center">المجموع</div>
                        {user.role === 'admin' && <div className="col-span-2 text-center">إجراء</div>}
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
                                <div className={`${user.role === 'admin' ? 'col-span-4' : 'col-span-6'} pr-2 font-bold text-white`}>
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
                                    <input type="number" placeholder="0" className="w-full bg-gray-700 border border-white/10 p-2 rounded-xl text-white text-center text-base font-bold" value={item.price || ''} onChange={e => updateItem(item.id, 'price', parseFloat(e.target.value))} />
                                </div>
                                <div className="col-span-2">
                                    <input type="number" placeholder="0" className="w-full bg-gray-700 border border-white/10 p-2 rounded-xl text-white text-center text-base font-bold" value={item.qty || ''} onChange={e => updateItem(item.id, 'qty', parseFloat(e.target.value))} />
                                </div>
                                <div className="col-span-2 text-center font-black text-xs text-green-400">
                                    {((item.price || 0) * (item.qty || 0)).toLocaleString()}
                                </div>
                                {user.role === 'admin' && (
                                    <div className="col-span-2 flex justify-center gap-1">
                                        {editingItemId !== item.id && (
                                            <button onClick={() => startEditingName(item.id, item.name)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded-xl transition" title="تعديل المسمى">
                                                <Edit size={14} />
                                            </button>
                                        )}
                                        <button onClick={() => deleteItem(item.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-xl transition" title="حذف">
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                )}
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

            {/* نافذة منبثقة عند تجاوز الحد اليومي لتسجيل المبيعات */}
            {showDailyLimitModal && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-white/20 w-full max-w-md rounded-3xl p-6 shadow-2xl text-center space-y-5 animate-in zoom-in-95">
                        <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center mx-auto">
                            <AlertCircle size={32} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg sm:text-xl font-bold text-white">تنبيه تسجيل المبيعات</h3>
                            <p className="text-sm sm:text-base text-gray-200 font-bold leading-relaxed">
                                لا يمكن تسجيل اكثر من مبيعات واحدة يوميا
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowDailyLimitModal(false)}
                            className="w-full bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 rounded-2xl transition shadow-lg active:scale-95 text-sm sm:text-base cursor-pointer"
                        >
                            إغلاق
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DailySales;
