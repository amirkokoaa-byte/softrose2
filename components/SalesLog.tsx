import { onCachedValue } from "../firebaseCache";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { ref, onValue, remove, update, get, set, push } from "firebase/database";
import { User, SaleRecord, ProductItem, UserTarget, TargetHistory } from '../types';
import { 
    Trash2, Edit, FileSpreadsheet, Save, X, Calendar, User as UserIcon, TrendingUp, Star, Trophy, Download, Filter, Target, History, Copy, Search, Package, ShoppingBag, Calculator, ChevronDown, ChevronUp, Printer
} from 'lucide-react';
import { exportToCSV } from '../utils';
import { Share2, FileDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';

interface Props {
    user: User;
    markets: string[];
    theme: string;
    products: ProductItem[];
}

const SalesLog: React.FC<Props> = ({ user, markets, theme, products }) => {
    const [sales, setSales] = useState<SaleRecord[]>([]);
    const [filteredSales, setFilteredSales] = useState<SaleRecord[]>([]);
    const [selectedSalesIds, setSelectedSalesIds] = useState<string[]>([]);
    const [visibleCount, setVisibleCount] = useState(15);
    const [selectedTargetEmployeeToShare, setSelectedTargetEmployeeToShare] = useState<string>('');
    const [usersList, setUsersList] = useState<User[]>([]);
    const [filterDate, setFilterDate] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterMarket, setFilterMarket] = useState('');
    
    // Target Management State
    const [showTargetModal, setShowTargetModal] = useState(false);
    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [archiveEmployee, setArchiveEmployee] = useState('all');
    const [archiveSearch, setArchiveSearch] = useState('');
    const [archiveData, setArchiveData] = useState<TargetHistory[]>([]);
    const [expandedArchiveMonths, setExpandedArchiveMonths] = useState<Record<string, boolean>>({});
    
    // Product Sales Report State
    const [showProductSalesModal, setShowProductSalesModal] = useState(false);
    const [reportItem, setReportItem] = useState('all');
    const [reportMarket, setReportMarket] = useState('all');
    const [reportStart, setReportStart] = useState('');
    const [reportEnd, setReportEnd] = useState('');

    const [targetMarket, setTargetMarket] = useState('');
    const [targetEmployeeKey, setTargetEmployeeKey] = useState('');
    const [targetPrintEmployee, setTargetPrintEmployee] = useState('');
    const [suggestedTarget, setSuggestedTarget] = useState(0);
    const [growthPercent, setGrowthPercent] = useState(0);
    const [finalTarget, setFinalTarget] = useState(0);
    const [currentActiveTarget, setCurrentActiveTarget] = useState(0);

    const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportStart, setExportStart] = useState('');
    const [exportEnd, setExportEnd] = useState('');
    const [exportMarket, setExportMarket] = useState('');

    const [showCurrentTargetsModal, setShowCurrentTargetsModal] = useState(false);
    const [selectedTargetMonth, setSelectedTargetMonth] = useState<string>('current');
    const [showPastTargetsModal, setShowPastTargetsModal] = useState(false);
    const [targetsList, setTargetsList] = useState<UserTarget[]>([]);

    useEffect(() => {
        let unsubUsers, unsubTargets, unsubHistory;
        const unsubSales = onCachedValue(ref(db, 'sales'), 'sales', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                let loadedSales: SaleRecord[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                if (user.role !== 'admin' && !user.canViewAllSales) {
                    loadedSales = loadedSales.filter(s => s.employeeName === user.name);
                }
                setSales(loadedSales.sort((a, b) => b.timestamp - a.timestamp));
            } else { setSales([]); }
        });

        if (user.role === 'admin') {
            unsubUsers = onCachedValue(ref(db, 'users'), 'users', (snap) => {
                if (snap.exists()) {
                    const list: User[] = [];
                    snap.forEach(child => { list.push({ key: child.key!, ...child.val() }); });
                    setUsersList(list);
                }
            });
            unsubTargets = onCachedValue(ref(db, 'targets'), 'targets', snap => {
                if (snap.exists()) {
                    setTargetsList(Object.values(snap.val()));
                } else {
                    setTargetsList([]);
                }
            });
            unsubHistory = onCachedValue(ref(db, 'target_history'), 'target_history', snap => {
                if (snap.exists()) {
                    const data: TargetHistory[] = [];
                    snap.forEach(userSnap => {
                        userSnap.forEach(historySnap => {
                            data.push({ id: historySnap.key!, ...historySnap.val() });
                        });
                    });
                    setArchiveData(data);
                } else {
                    setArchiveData([]);
                }
            });
        }
        return () => {
            unsubSales();
            if (unsubUsers) unsubUsers();
            if (unsubTargets) unsubTargets();
            if (unsubHistory) unsubHistory();
        };
    }, [user]);

    useEffect(() => {
        let result = sales;
        if (filterDate) result = result.filter(s => s.date.includes(filterDate));
        if (filterEmployee) result = result.filter(s => s.employeeName.includes(filterEmployee));
        if (filterMarket) result = result.filter(s => s.market === filterMarket);
        setFilteredSales(result);
    }, [sales, filterDate, filterEmployee, filterMarket]);

    // حساب التارجت المقترح تلقائياً مع جلب التارجت الحالي
    useEffect(() => {
        if (targetEmployeeKey) {
            const employee = usersList.find(u => u.key === targetEmployeeKey);
            if (employee) {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                const end = new Date(now.getFullYear(), now.getMonth(), 30, 23, 59, 59).getTime();
                
                const employeeSales = sales.filter(s => 
                    s.employeeName === employee.name && 
                    s.timestamp >= start && 
                    s.timestamp <= end
                );
                const sum = employeeSales.reduce((acc, s) => acc + s.total, 0);
                setSuggestedTarget(sum);

                // Fetch existing valid target for the selected employee
                const activeTgt = targetsList.find(t => t.userId === targetEmployeeKey);
                if (activeTgt) {
                    setCurrentActiveTarget(activeTgt.finalTarget);
                } else {
                    setCurrentActiveTarget(0);
                }
            }
        } else {
            setCurrentActiveTarget(0);
        }
    }, [targetEmployeeKey, sales, usersList, targetsList]);

    // حساب التارجت النهائي تلقائياً
    useEffect(() => {
        const final = suggestedTarget + (suggestedTarget * (growthPercent / 100));
        setFinalTarget(Math.round(final));
    }, [suggestedTarget, growthPercent]);

    // استخراج قائمة الأصناف الفريدة والأسواق التي بها مبيعات
const normalizeName = (name: string) => {
        if (!name) return '';
        return name.trim().replace(/\s+/g, ' ');
    };

    const uniqueItems = useMemo(() => {
        const set = new Set<string>();
        sales.forEach(s => s.items?.forEach(i => set.add(normalizeName(i.name))));
        return Array.from(set).sort();
    }, [sales]);

    const groupedItems = useMemo(() => {
        const groups: Record<string, string[]> = {
            'Facial': [],
            'Kitchen': [],
            'Toilet': [],
            'Dolphin': [],
            'Uncategorized': []
        };
        
        uniqueItems.forEach(itemName => {
            // إخفاء منتجات Soft Rose باللغة الإنجليزية من القوائم المنبثقة
            if (/[a-zA-Z]/.test(itemName)) return;
            const product = products.find(p => normalizeName(p.name) === itemName);
            const cat = product?.category || 'Uncategorized';
            if (groups[cat]) {
                groups[cat].push(itemName);
            } else {
                if (!groups['Uncategorized']) groups['Uncategorized'] = [];
                groups['Uncategorized'].push(itemName);
            }
        });
        
        return groups;
    }, [uniqueItems, products]);

    const categoryLabels: Record<string, string> = {
        'Facial': 'مناديل السحب (Facial)',
        'Kitchen': 'مناديل المطبخ (Kitchen)',
        'Toilet': 'تواليت (Toilet)',
        'Dolphin': 'دولفن (Dolphin)',
        'Uncategorized': 'أصناف أخرى'
    };

    const marketsWithSales = useMemo(() => {
        const set = new Set<string>();
        sales.forEach(s => set.add(s.market));
        return Array.from(set).sort();
    }, [sales]);

    // حساب نتائج تقرير مبيعات الأصناف
    const reportResults = useMemo<{ 
        totalQty: number; 
        totalValue: number; 
        itemsGrouped: Record<string, { price: number; qty: number; total: number }>;
        categoryGrouped: Record<string, number>;
    }>(() => {
        let results = sales;
        if (reportMarket !== 'all') results = results.filter(s => s.market === reportMarket);
        if (reportStart) {
            const startTS = new Date(reportStart).setHours(0,0,0,0);
            results = results.filter(s => s.timestamp >= startTS);
        }
        if (reportEnd) {
            const endTS = new Date(reportEnd).setHours(23,59,59,999);
            results = results.filter(s => s.timestamp <= endTS);
        }

        let totalQty = 0;
        let totalValue = 0;
        const itemsGrouped: Record<string, { price: number, qty: number, total: number }> = {};
        const categoryGrouped: Record<string, number> = {};

        results.forEach(s => {
            (s.items || []).forEach(i => {
                const nName = normalizeName(i.name);
                // إخفاء منتجات Soft Rose باللغة الإنجليزية من التقرير
                if (/[a-zA-Z]/.test(nName)) return;
                if (reportItem === 'all' || nName === reportItem) {
                    totalQty += i.qty;
                    totalValue += (i.qty * i.price);
                    
                    if (!itemsGrouped[nName]) {
                        itemsGrouped[nName] = { price: i.price, qty: 0, total: 0 };
                    }
                    itemsGrouped[nName].qty += i.qty;
                    itemsGrouped[nName].total += (i.qty * i.price);
                    
                    // compute category
                    const prod = products.find(p => normalizeName(p.name) === nName);
                    const cat = prod?.category || 'Uncategorized';
                    if (!categoryGrouped[cat]) categoryGrouped[cat] = 0;
                    categoryGrouped[cat] += (i.qty * i.price);
                }
            });
        });

        return { totalQty, totalValue, itemsGrouped, categoryGrouped };
    }, [sales, reportItem, reportMarket, reportStart, reportEnd, products]);

    
    const handleShareSales = async (asPdf: boolean) => {
        let element = document.getElementById('selected-sales-print-area');
        if (!element) return;
        try {
            const canvas = await html2canvas(element, {
                backgroundColor: '#111827',
                scale: 8000 / 1000, // 8K resolution assuming 1000px container width
                width: 1000
            });
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            
            // if we need pdf we could use jspdf, but they asked for 8K image exported.
            // "يتم التقاط صورة للعناصر المحددة وإرسالها أو تصديرها كصورة فائقة الجودة"
            // So we'll just download the image for both cases, or use Share API for Share.
            if (!asPdf && navigator.share) {
                const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 1.0));
                if (blob) {
                    const file = new File([blob], 'sales.png', { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: 'مبيعات' });
                        return;
                    }
                }
            }
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `sales_export_${new Date().getTime()}.png`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                }
            }, 'image/png', 1.0);
        } catch (err) {
            console.error("Failed to capture image", err);
            alert("حدث خطأ أثناء استخراج الصورة");
        }
    };
    
    const handleShareTarget = async () => {
        let element = document.getElementById('selected-target-print-area');
        if (!element) return;
        try {
            const canvas = await html2canvas(element, {
                backgroundColor: '#111827',
                scale: 8000 / 1000,
                width: 1000
            });
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            
            if (navigator.share) {
                const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 1.0));
                if (blob) {
                    const file = new File([blob], 'target.png', { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: 'التارجت' });
                        return;
                    }
                }
            }
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `target_export_${new Date().getTime()}.png`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                }
            }, 'image/png', 1.0);
        } catch (err) {
            console.error("Failed to capture target image", err);
            alert("حدث خطأ أثناء استخراج الصورة");
        }
    };

    const handleUpdateActiveTarget = async () => {
        if (!targetEmployeeKey) return alert('اختر الموظف أولاً');
        await update(ref(db, `targets/${targetEmployeeKey}`), { finalTarget: currentActiveTarget });
        alert('تم تعديل التارجت الحالي بنجاح وسيظهر التعديل فوراً للموظف');
    };

    const handleSaveTarget = async () => {
        if (!targetEmployeeKey || !targetMarket || finalTarget <= 0) return alert("يرجى إكمال البيانات");
        const employee = usersList.find(u => u.key === targetEmployeeKey);
        if (!employee) return;

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;

        const targetData: UserTarget = {
            userId: targetEmployeeKey,
            employeeName: employee.name,
            market: targetMarket,
            suggestedAmount: suggestedTarget,
            growthPercent: growthPercent,
            finalTarget: finalTarget,
            achieved: 0,
            lastResetMonth: currentMonth
        };

        await set(ref(db, `targets/${targetEmployeeKey}`), targetData);
        alert("تم اعتماد وإضافة التارجت بنجاح");
        setShowTargetModal(false);
    };

    const handleEditCurrentTarget = async (userId: string, currentVal: number) => {
        const newVal = prompt("أدخل التارجت الشهري الجديد:", currentVal.toString());
        if (newVal !== null && !isNaN(Number(newVal)) && Number(newVal) > 0) {
            await update(ref(db, `targets/${userId}`), { finalTarget: Number(newVal) });
            alert("تم التعديل بنجاح");
        }
    };

    const handleDeleteCurrentTarget = async (userId: string) => {
        if (confirm("هل أنت متأكد من حذف هذا التارجت؟")) {
            await remove(ref(db, `targets/${userId}`));
            alert("تم الحذف بنجاح");
        }
    };

    const handleEditPastTarget = async (userId: string, employeeName: string, monthKey: string, historical: any, currentVal: number, achieved: number) => {
        const newVal = prompt("أدخل التارجت الجديد لهذا الشهر:", currentVal.toString());
        if (newVal !== null && !isNaN(Number(newVal)) && Number(newVal) > 0) {
            if (historical && historical.id) {
                await update(ref(db, `target_history/${userId}/${historical.id}`), { targetAmount: Number(newVal), isDeleted: null });
            } else {
                await push(ref(db, `target_history/${userId}`), {
                    userId: userId || 'unknown', employeeName: employeeName || 'unknown', month: monthKey, targetAmount: Number(newVal), achievedAmount: achieved
                });
            }
            alert("تم التعديل بنجاح");
        }
    };

    const handleDeletePastTarget = async (userId: string, employeeName: string, monthKey: string, historical: any) => {
        if (confirm("هل أنت متأكد من حذف التارجت لهذا الشهر؟")) {
            if (historical && historical.id) {
                await update(ref(db, `target_history/${userId}/${historical.id}`), { isDeleted: true });
            } else {
                await push(ref(db, `target_history/${userId}`), {
                    userId: userId || 'unknown', employeeName: employeeName || 'unknown', month: monthKey, targetAmount: 0, achievedAmount: 0, isDeleted: true
                });
            }
            alert("تم الحذف بنجاح");
        }
    };

    const loadArchive = async () => {
        const archiveRef = ref(db, 'target_history');
        const snap = await get(archiveRef);
        if (snap.exists()) {
            const data: TargetHistory[] = [];
            snap.forEach(userSnap => {
                userSnap.forEach(historySnap => {
                    data.push({ id: historySnap.key!, ...historySnap.val() });
                });
            });
            setArchiveData(data);
            setShowArchiveModal(true);
        } else {
            alert("لا توجد سجلات أرشيفية");
        }
    };

    const copyArchiveData = () => {
        const filtered = getFilteredArchive();
        const text = filtered.map(h => `${h.employeeName} | الشهر: ${h.month} | التارجت: ${h.targetAmount} | المحقق: ${h.achievedAmount}`).join('\n');
        navigator.clipboard.writeText(text);
        alert("تم نسخ البيانات المصفاة بنجاح");
    };

    const getFilteredArchive = () => {
        return archiveData.filter(h => 
            (archiveEmployee === 'all' || h.userId === archiveEmployee) &&
            (h.month.includes(archiveSearch) || h.employeeName.includes(archiveSearch))
        );
    };

    const computeAchieved = (employeeName: string, year: number, month: number, userId?: string) => {
        const start = new Date(year, month, 1).getTime();
        const end = new Date(year, month + 1, 0, 23, 59, 59).getTime(); // last day of month
        return sales
            .filter(s => {
                const nameMatches = s.employeeName?.trim().toLowerCase() === employeeName?.trim().toLowerCase();
                const userMatches = userId && s.username && (s.username.replace(/[.#$/[\]]/g, "_") === userId || s.username === userId);
                return (nameMatches || userMatches) && s.timestamp >= start && s.timestamp <= end;
            })
            .reduce((sum, s) => sum + s.total, 0);
    };

    const pastMonthsList = useMemo(() => {
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthsSet = new Set<string>();
        sales.forEach(s => {
            const date = new Date(s.timestamp);
            const mKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (mKey !== currentMonthKey) {
                 monthsSet.add(mKey);
            }
        });
        return Array.from(monthsSet).sort((a,b) => b.localeCompare(a));
    }, [sales]);

    const renderTargetsList = () => {
        const now = new Date();
        const targetsWithAchieved = targetsList.map(t => {
            const achieved = computeAchieved(t.employeeName, now.getFullYear(), now.getMonth(), t.userId);
            
            const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
            const employeeSales = sales.filter(s => {
                const nameMatches = s.employeeName?.trim().toLowerCase() === t.employeeName?.trim().toLowerCase();
                const userMatches = t.userId && s.username && (s.username.replace(/[.#$/[\]]/g, "_") === t.userId || s.username === t.userId);
                return (nameMatches || userMatches) && s.timestamp >= start && s.timestamp <= end;
            });
            const activeMarkets = Array.from(new Set(employeeSales.map(s => s.market))).sort().join('، ');

            return { ...t, achieved, activeMarkets };
        });

        let finalTargets = targetsWithAchieved;
        if (targetPrintEmployee) {
            finalTargets = finalTargets.filter(t => t.userId === targetPrintEmployee);
        }
        const totalTarget = finalTargets.reduce((sum, t) => sum + t.finalTarget, 0);
        const totalAchieved = targetsWithAchieved.reduce((sum, t) => sum + t.achieved, 0);
        const totalPerc = totalTarget > 0 ? ((totalAchieved / totalTarget) * 100).toFixed(1) : 0;

        return (
            <>
                {finalTargets.map(t => {
                    const perc = t.finalTarget > 0 ? ((t.achieved / t.finalTarget) * 100).toFixed(1) : 0;
                    return (
                        <div key={t.userId} className="bg-black/30 border border-white/5 p-4 rounded-2xl">
                            <div className="flex justify-between items-center mb-2">
                                <div>
                                    <div className="font-bold text-white text-lg">{t.employeeName}</div>
                                    <div className="text-xs opacity-60 text-white">{t.market}</div>
                                    {t.activeMarkets && (
                                        <div className="text-[11px] text-blue-300 mt-1 font-medium break-words whitespace-normal md:max-w-md">
                                            الفروع: {t.activeMarkets}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button data-html2canvas-ignore="true" onClick={() => handleEditCurrentTarget(t.userId, t.finalTarget)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded-lg transition" title="تعديل"><Edit size={16}/></button>
                                    <button data-html2canvas-ignore="true" onClick={() => handleDeleteCurrentTarget(t.userId)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition" title="حذف"><Trash2 size={16}/></button>
                                    <div className="text-left flex flex-col ml-3 pl-3 border-l border-white/10">
                                        <span className="text-xs opacity-60 text-white">نسبة التحقيق</span>
                                        <span className="font-black text-blue-400">{perc}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center bg-gray-800 p-3 rounded-xl">
                                <div className="flex flex-col">
                                    <span className="text-[10px] opacity-50 text-white uppercase font-black">التارجت</span>
                                    <span className="font-black text-yellow-400">{t.finalTarget.toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-[10px] opacity-50 text-white uppercase font-black">المحقق</span>
                                    <span className="font-black text-green-400">{t.achieved.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {targetsWithAchieved.length > 0 && (
                    <div className="mt-4 p-4 rounded-2xl bg-orange-600/20 border border-orange-500/30">
                        <div className="flex justify-between items-center">
                            <div className="font-bold text-white text-lg">{targetPrintEmployee ? "الإجمالي المحقق" : "الإجمالي لجميع الحسابات"}</div>
                            <div className="flex items-center gap-2">
                                <div className="text-left flex flex-col pl-3 border-l border-white/20">
                                    <span className="text-xs opacity-70 text-white">متوسط النسبة</span>
                                    <span className="font-black text-orange-400">{totalPerc}%</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 flex justify-between items-center bg-black/40 p-3 rounded-xl">
                            <div className="flex flex-col">
                                <span className="text-[10px] opacity-70 text-white uppercase font-black">إجمالي التارجت</span>
                                <span className="font-black text-yellow-400">{totalTarget.toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-[10px] opacity-70 text-white uppercase font-black">إجمالي المحقق</span>
                                <span className="font-black text-green-400">{totalAchieved.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                )}
                
                {targetsWithAchieved.length === 0 && <div className="text-center py-10 opacity-50 text-white">لا يوجد تارجت مسجل</div>}
            </>
        );
    };

    const getPastMonthTargetsData = (mKey: string) => {
        const [yStr, mStr] = mKey.split('-');
        const year = parseInt(yStr);
        const month = parseInt(mStr) - 1; // Month index (0-11)
        
        const exactNames = findExactEmployeeNames();
        const targetNames = [exactNames.omnia, exactNames.toqa, exactNames.mena];

        const candidates = new Map<string, { userId: string; employeeName: string; market: string }>();

        targetsList.forEach(t => {
            candidates.set(t.employeeName, {
                userId: t.userId,
                employeeName: t.employeeName,
                market: t.market
            });
        });

        archiveData.forEach(h => {
            if (h.month === mKey && !(h as any).isDeleted) {
                let market = '';
                const existing = candidates.get(h.employeeName);
                if (existing) {
                    market = existing.market;
                } else {
                    const foundTarget = targetsList.find(t => t.employeeName === h.employeeName);
                    if (foundTarget) {
                        market = foundTarget.market;
                    } else {
                        const foundSale = sales.find(s => s.employeeName === h.employeeName);
                        market = foundSale ? foundSale.market : 'غير محدد';
                    }
                }
                candidates.set(h.employeeName, {
                    userId: h.userId,
                    employeeName: h.employeeName,
                    market: market || 'غير محدد'
                });
            }
        });

        if (mKey === "2026-06") {
            targetNames.forEach(empName => {
                if (!candidates.has(empName)) {
                    const u = usersList.find(usr => usr.name === empName);
                    const t = targetsList.find(tg => tg.employeeName === empName);
                    let market = t ? t.market : '';
                    if (!market) {
                        const foundSale = sales.find(s => s.employeeName === empName);
                        market = foundSale ? foundSale.market : 'غير محدد';
                    }
                    candidates.set(empName, {
                        userId: u?.key || empName,
                        employeeName: empName,
                        market: market || 'غير محدد'
                    });
                }
            });
        }

        const resultList = Array.from(candidates.values()).map(c => {
            const historical = archiveData.find(a => a.userId === c.userId && a.month === mKey);
            
            let targetAmount = 0;
            if (historical) {
                if ((historical as any).isDeleted) return null;
                targetAmount = historical.targetAmount;
            } else {
                const t = targetsList.find(x => x.employeeName === c.employeeName);
                targetAmount = t ? t.finalTarget : 0;
            }

            let achievedAmount = computeAchieved(c.employeeName, year, month, c.userId);
            const start = new Date(year, month, 1).getTime();
            const end = new Date(year, month + 1, 0, 23, 59, 59).getTime();
            const employeeSales = sales.filter(s => {
                const nameMatches = s.employeeName?.trim().toLowerCase() === c.employeeName?.trim().toLowerCase();
                const userMatches = c.userId && s.username && (s.username.replace(/[.#$/\[\]]/g, "_") === c.userId || s.username === c.userId);
                return (nameMatches || userMatches) && s.timestamp >= start && s.timestamp <= end;
            });
            const activeMarkets = Array.from(new Set(employeeSales.map(s => s.market))).sort().join('، ');
            if (mKey === "2026-06" && targetNames.includes(c.employeeName)) {
                achievedAmount = computeAchieved(c.employeeName, 2026, 5, c.userId); // June
            }

            if (targetAmount === 0 && achievedAmount === 0) return null;

            return {
                userId: c.userId,
                employeeName: c.employeeName,
                market: c.market,
                targetAmount,
                achievedAmount,
                activeMarkets
            };
        }).filter(Boolean) as { userId: string; employeeName: string; market: string; targetAmount: number; achievedAmount: number; activeMarkets?: string; }[];

        return resultList;
    };

    const renderPastMonthTargetsList = (mKey: string) => {
        let dataList = getPastMonthTargetsData(mKey);
        if (targetPrintEmployee) {
            dataList = dataList.filter(t => t.userId === targetPrintEmployee);
        }

        const totalTarget = dataList.reduce((sum, item) => sum + item.targetAmount, 0);
        const totalAchieved = dataList.reduce((sum, item) => sum + item.achievedAmount, 0);
        const totalPerc = totalTarget > 0 ? ((totalAchieved / totalTarget) * 100).toFixed(1) : "0.0";

        return (
            <div className="space-y-4">
                <div className="p-4 bg-orange-600/10 border border-orange-500/30 rounded-2xl flex items-center justify-between">
                    <div>
                        <span className="text-[10px] opacity-70 text-white uppercase font-black block">شهر الأرشيف المختار</span>
                        <span className="font-black text-lg text-white">{mKey}</span>
                    </div>
                </div>
                <div className="space-y-2">
                    {dataList.map(item => {
                        const perc = item.targetAmount > 0 ? ((item.achievedAmount / item.targetAmount) * 100).toFixed(1) : "0.0";
                        return (
                            <div key={`${item.userId}-${mKey}`} className="flex justify-between items-center bg-black/20 p-4 rounded-xl border border-white/5">
                                <div className="min-w-[160px] max-w-[200px] flex flex-col justify-center text-right pr-2">
                                    <div className="font-bold text-white text-sm break-words whitespace-normal">{item.employeeName}</div>
                                    <div className="text-[11px] text-blue-300 mt-1 font-medium break-words whitespace-normal">{item.market}</div>
                                    {item.activeMarkets && (
                                        <div className="text-[11px] text-blue-300 mt-1 font-medium break-words whitespace-normal">
                                            الفروع: {item.activeMarkets}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 flex justify-center gap-6">
                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] opacity-50 text-white uppercase font-black">التارجت</span>
                                        <span className="font-black text-yellow-400 text-sm">{item.targetAmount.toLocaleString()} ج.م</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] opacity-50 text-white uppercase font-black">المحقق</span>
                                        <span className="font-black text-green-400 text-sm">{item.achievedAmount.toLocaleString()} ج.م</span>
                                    </div>
                                </div>
                                <div className="w-20 text-left border-l border-white/10 pl-2 ml-2 flex flex-col justify-center">
                                    <span className="text-[10px] opacity-50 text-white uppercase font-black block text-center">النسبة</span>
                                    <span className="font-black text-blue-400 text-sm text-center">{perc}%</span>
                                </div>
                            </div>
                        );
                    })}
                    {dataList.length === 0 && <div className="text-center py-10 opacity-50 text-white">لا توجد بيانات لهذا الشهر</div>}
                </div>
                {dataList.length > 0 && (
                    <div className="mt-4 p-4 rounded-2xl bg-orange-600/20 border border-orange-500/30">
                        <div className="flex justify-between items-center">
                            <div className="font-bold text-white text-lg">{targetPrintEmployee ? "الإجمالي المحقق" : "الإجمالي لجميع الحسابات"}</div>
                            <div className="flex items-center gap-2">
                                <div className="text-left flex flex-col pl-3 border-l border-white/20">
                                    <span className="text-xs opacity-70 text-white">متوسط النسبة</span>
                                    <span className="font-black text-orange-400">{totalPerc}%</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 flex justify-between items-center bg-black/40 p-3 rounded-xl">
                            <div className="flex flex-col">
                                <span className="text-[10px] opacity-70 text-white uppercase font-black">إجمالي التارجت</span>
                                <span className="font-black text-yellow-400">{totalTarget.toLocaleString()} ج.م</span>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-[10px] opacity-70 text-white uppercase font-black">إجمالي المحقق</span>
                                <span className="font-black text-green-400">{totalAchieved.toLocaleString()} ج.م</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const handleDownloadImage = async (asShare = false) => {
        let element = document.getElementById('current-targets-print-area');
        if (!element || element.offsetParent === null) {
            element = document.getElementById('hidden-print-area');
        }
        if (!element) return;
        try {
            const canvas = await html2canvas(element, {
                backgroundColor: '#111827',
                scale: 8000 / element.offsetWidth, 
            });
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            
            if (asShare && navigator.share) {
                const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 1.0));
                if (blob) {
                    const file = new File([blob], 'targets.png', { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: 'التارجت' });
                        return;
                    }
                }
            }
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `targets-${new Date().toISOString().split('T')[0]}.png`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                }
            }, 'image/png', 1.0);
        } catch (err) {
            console.error("Failed to capture image", err);
            alert("حدث خطأ أثناء تحميل الصورة");
        }
    };

    const findExactEmployeeNames = () => {
        const allNames = new Set<string>();
        sales.forEach(s => { if (s.employeeName) allNames.add(s.employeeName); });
        usersList.forEach(u => { if (u.name) allNames.add(u.name); });
        
        const targets = {
            omnia: 'Omnia',
            toqa: 'Toqa',
            mena: 'Mena Ahmed'
        };
        
        allNames.forEach(name => {
            const lower = name.toLowerCase();
            if (lower.includes('omnia') || lower.includes('أمنية') || lower.includes('امنية')) {
                targets.omnia = name;
            }
            if (lower.includes('toqa') || lower.includes('تقى') || lower.includes('تقي')) {
                targets.toqa = name;
            }
            if (lower.includes('mena') || lower.includes('مينا')) {
                targets.mena = name;
            }
        });
        return targets;
    };

    const handleDownloadPastMonthImage = async (mKey: string, asShare = false) => {
        const element = document.getElementById('past-targets-print-area-' + mKey) || document.getElementById('current-targets-print-area');
        if (!element) return;
        try {
            const canvas = await html2canvas(element, {
                backgroundColor: '#111827',
                scale: 8000 / element.offsetWidth,
            });
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            
            if (asShare && navigator.share) {
                const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 1.0));
                if (blob) {
                    const file = new File([blob], 'targets_' + mKey + '.png', { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: 'تارجت ' + mKey });
                        return;
                    }
                }
            }
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `targets-${mKey}.png`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                }
            }, 'image/png', 1.0);
        } catch (err) {
            console.error("Failed to capture image", err);
            alert("حدث خطأ أثناء تحميل الصورة");
        }
    };

    const handleExportCurrent = () => {
        if (filteredSales.length === 0) return alert("لا توجد بيانات للتصدير");
        const exportData = filteredSales.map(s => ({
            "اسم الموظف": s.employeeName,
            "اليوم": new Date(s.timestamp).toLocaleDateString('ar-EG', { weekday: 'long' }),
            "التاريخ": s.date,
            "اسم الفرع": s.market,
            "إجمالي مبيعات اليوم": s.total.toLocaleString()
        }));
        exportToCSV(exportData, "Current_Sales_Log");
    };

    const handleExportPeriod = () => {
        if (!exportStart || !exportEnd) return alert("اختر الفترة الزمنية");
        const startTS = new Date(exportStart).getTime();
        const endTS = new Date(exportEnd).getTime() + 86400000;
        const periodSales = sales.filter(s => s.timestamp >= startTS && s.timestamp <= endTS && (!exportMarket || s.market === exportMarket));
        
        if (periodSales.length === 0) return alert("لا توجد مبيعات");

        const itemsGrouped: Record<string, { price: number, qty: number, total: number }> = {};
        let grandTotalQty = 0;
        let grandTotalValue = 0;

        periodSales.forEach(s => {
            (s.items || []).forEach(i => {
                const nName = normalizeName(i.name);
                if (/[a-zA-Z]/.test(nName)) return;
                if (!itemsGrouped[nName]) {
                    itemsGrouped[nName] = { price: i.price, qty: 0, total: 0 };
                }
                itemsGrouped[nName].qty += i.qty;
                itemsGrouped[nName].total += (i.qty * i.price);
                itemsGrouped[nName].price = i.price; // Keep latest price or maybe not needed if it's constant
                grandTotalQty += i.qty;
                grandTotalValue += (i.qty * i.price);
            });
        });

        const exportData: any[] = Object.entries(itemsGrouped).map(([name, stats]) => ({
            "الصنف": name,
            "سعر القطعة": stats.price,
            "عدد القطع المباعة": stats.qty,
            "الإجمالي": stats.total
        }));

        exportData.push({
            "الصنف": "الإجمالي العام",
            "سعر القطعة": "",
            "عدد القطع المباعة": grandTotalQty,
            "الإجمالي": grandTotalValue
        });

        exportToCSV(exportData, `Sales_Report_${exportStart}_to_${exportEnd}`);
        setShowExportModal(false);
    };

    const handleExportProductSales = () => {
        const dataRows = (Object.entries(reportResults.itemsGrouped) as [string, { price: number; qty: number; total: number }][]).map(([name, stats]) => ({
            "اسم الصنف": name,
            "الفترة": `من ${reportStart || 'البداية'} إلى ${reportEnd || 'الآن'}`,
            "سعر القطعة": stats.price,
            "الكمية المباعة": stats.qty,
            "الإجمالي": stats.total
        }));
        
        dataRows.push({
            "اسم الصنف": "الإجمالي العام",
            "الفترة": "",
            "سعر القطعة": 0,
            "الكمية المباعة": reportResults.totalQty,
            "الإجمالي": reportResults.totalValue
        });

        exportToCSV(dataRows, `Product_Sales_Report_${reportStart}_to_${reportEnd}`);
    };

    const handleUpdateSale = async () => {
        if (!editingSale || !editingSale.id) return;
        const newTotal = editingSale.items.reduce((acc, item) => acc + (item.price * item.qty), 0);
        await update(ref(db, `sales/${editingSale.id}`), {
            items: editingSale.items,
            total: newTotal
        });
        alert("تم تحديث البيعة بنجاح");
        setEditingSale(null);
    };

    const updateEditingItem = (index: number, field: keyof ProductItem, value: any) => {
        if (!editingSale) return;
        const newItems = [...editingSale.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setEditingSale({ ...editingSale, items: newItems });
    };

    const getStarOfMonth = () => {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime(); // fixing to end of month
        const currentMonthSales = sales.filter(s => s.timestamp >= start && s.timestamp <= end);
        const totals: Record<string, number> = {};
        currentMonthSales.forEach(s => totals[s.employeeName] = (totals[s.employeeName] || 0) + s.total);
        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        
        let result: any = null;
        if (sorted.length > 0) {
            result = { 
                first: { name: sorted[0][0], total: sorted[0][1] },
                second: sorted.length > 1 ? { name: sorted[1][0], total: sorted[1][1] } : null
            };
        }
        return result;
    };

    const stars = getStarOfMonth();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-white"><FileSpreadsheet /> سجل المبيعات</h2>
                <div className="flex gap-2">
                    {user.role === 'admin' && (
                        <button onClick={() => setShowProductSalesModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold hover:bg-blue-700 transition">
                            <Package size={18}/> مبيعات صنف
                        </button>
                    )}
                    {user.role === 'admin' && (
                        <>
                            <button onClick={loadArchive} className="bg-gray-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold hover:bg-gray-600 transition">
                                <History size={18}/> تارجت سابق
                            </button>
                            <button onClick={() => setShowTargetModal(true)} className="bg-purple-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold hover:bg-purple-700 transition">
                                <Target size={18}/> إدارة التارجت
                            </button>
                            <button onClick={() => setShowCurrentTargetsModal(true)} className="bg-orange-600 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold hover:bg-orange-700 transition">
                                <Target size={18}/> تارجت الشهر
                            </button>
                        </>
                    )}
                </div>
            </div>
            
            {user.role === 'admin' && (
                <div className="flex flex-col md:flex-row gap-3">
                    <button onClick={() => setShowExportModal(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition active:scale-95"><Filter size={18}/> تصدير فترة معينة</button>
                    <button onClick={handleExportCurrent} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition active:scale-95"><Download size={18}/> تصدير السجل الحالي</button>
                </div>
            )}

            {stars && (
                <div className="bg-[#808080] p-6 rounded-3xl border border-white/20 shadow-2xl relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:rotate-12 transition-transform duration-700"><Trophy size={120} /></div>
                    <div className="text-center mb-6 relative z-10">
                        <Trophy className="text-yellow-400 animate-pulse mx-auto mb-2" size={40} />
                        <h3 className="text-xl font-black text-white uppercase tracking-widest">نجوم الشهر الحالي</h3>
                    </div>
                    
                    <div className="flex flex-col md:flex-row justify-center items-center gap-6 relative z-10">
                        {/* المركز الأول */}
                        <div className="flex flex-col items-center bg-white/10 p-4 rounded-2xl border border-yellow-400/50 min-w-[200px]">
                            <div className="text-yellow-400 text-sm font-black mb-1">المركز الأول</div>
                            <div className="text-2xl font-black text-white">{stars.first.name}</div>
                            <div className="text-sm font-bold opacity-80 text-white mt-2">مبيعات: <span className="text-green-300 font-black">{stars.first.total.toLocaleString()} ج.م</span></div>
                        </div>

                        {/* المركز الثاني */}
                        {stars.second && (
                            <div className="flex flex-col items-center bg-white/5 p-4 rounded-2xl border border-gray-400/50 min-w-[200px] md:scale-95">
                                <div className="text-gray-300 text-sm font-black mb-1">المركز الثاني</div>
                                <div className="text-xl font-black text-white">{stars.second.name}</div>
                                <div className="text-sm font-bold opacity-80 text-white mt-2">مبيعات: <span className="text-green-300 font-black">{stars.second.total.toLocaleString()} ج.م</span></div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {user.role === 'admin' && <input type="date" className="p-3 rounded-xl bg-gray-700 text-white border border-white/20" value={filterDate} onChange={e => setFilterDate(e.target.value)} />}
                <input type="text" placeholder="بحث باسم الموظف..." className="p-3 rounded-xl bg-gray-700 text-white border border-white/10 text-xs" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} />
                <select className="p-3 rounded-xl bg-gray-700 text-white border border-white/20" value={filterMarket} onChange={e => setFilterMarket(e.target.value)}>
                    <option value="">كل الماركتات</option>
                    {markets.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>
            
            <div className="flex items-center justify-between bg-gray-800 p-4 rounded-2xl border border-white/10 shadow-lg">
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="selectAll" className="w-5 h-5 accent-blue-500 rounded" 
                           checked={filteredSales.length > 0 && selectedSalesIds.length === filteredSales.length}
                           onChange={e => {
                               if (e.target.checked) setSelectedSalesIds(filteredSales.map(s => s.id));
                               else setSelectedSalesIds([]);
                           }} />
                    <label htmlFor="selectAll" className="text-white font-bold cursor-pointer">تحديد الكل ({filteredSales.length})</label>
                </div>
                {selectedSalesIds.length > 0 && (
                    <div className="flex gap-2">
                        <button onClick={() => handleShareSales(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition text-xs shadow-xl"><FileDown size={14}/> تصدير PDF</button>
                        <button onClick={() => handleShareSales(false)} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition text-xs shadow-xl"><Share2 size={14}/> مشاركة WhatsApp</button>
                    </div>
                )}
            </div>
            <div className="space-y-4">
                {filteredSales.slice(0, visibleCount).map(sale => (
                    <div key={sale.id} className="p-5 rounded-3xl border border-white/10 bg-gray-800 shadow-2xl">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-3">
        <input type="checkbox" className="w-5 h-5 accent-blue-500 rounded"
               checked={selectedSalesIds.includes(sale.id)} 
               onChange={e => {
                   if (e.target.checked) setSelectedSalesIds(prev => [...prev, sale.id]);
                   else setSelectedSalesIds(prev => prev.filter(id => id !== sale.id));
               }} />
        <div className="font-bold text-xl text-blue-400">{sale.market}</div>
    </div>
                                <div className="flex flex-wrap items-center gap-3 text-[10px] opacity-60 font-bold mt-1 text-white">
                                    <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(sale.timestamp).toLocaleDateString('ar-EG', { weekday: 'long' })} - {sale.date}</span>
                                    <span className="flex items-center gap-1"><UserIcon size={12}/> {sale.employeeName}</span>
                                    <span className="bg-white/10 px-2 py-0.5 rounded text-[9px] uppercase">{(sale as any).username || "System"}</span>
                                </div>
                            </div>
                            <div className="flex gap-2">
                            </div>
                        </div>
                        <div className="overflow-hidden rounded-2xl bg-black/20 border border-white/5">
                            <table className="w-full text-[11px] text-center">
                                <thead className="bg-white/5 text-white/50">
                                    <tr><th className="py-2 px-3 text-right text-white">الصنف</th><th className="py-2 text-white">السعر</th><th className="py-2 text-white">الكمية</th><th className="py-2 px-3 text-white">المجموع</th></tr>
                                </thead>
                                <tbody>
                                    {(sale.items || []).map((item, idx) => (
                                        <tr key={idx} className="border-t border-white/5 text-white"><td className="py-2 px-3 text-right font-bold">{item.name}</td><td className="py-2">{item.price}</td><td className="py-2 font-black">{item.qty}</td><td className="py-2 px-3 text-green-400 font-black">{(item.qty * item.price).toLocaleString()}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-white">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold opacity-60 uppercase tracking-tighter">إجمالي الفاتورة:</span>
                                <span className="text-xl font-black text-blue-400">{sale.total.toLocaleString()} ج.م</span>
                            </div>
                            {user.role === 'admin' && (
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingSale(sale)} className="bg-indigo-600/20 text-indigo-400 p-2.5 rounded-xl border border-indigo-500/30 hover:bg-indigo-600 hover:text-white transition shadow-lg flex items-center gap-2 text-xs font-bold">
                                        <Edit size={16}/> تعديل
                                    </button>
                                    <button onClick={() => { if(confirm("هل أنت متأكد من حذف هذه العملية؟")) remove(ref(db, `sales/${sale.id!}`)); }} className="bg-red-600/20 text-red-500 p-2.5 rounded-xl border border-red-500/30 hover:bg-red-600 hover:text-white transition shadow-lg flex items-center gap-2 text-xs font-bold">
                                        <Trash2 size={16}/> حذف
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* مودال تعديل البيعة */}
            {editingSale && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/20 w-full max-w-2xl rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-white flex items-center gap-2"><Edit className="text-indigo-500"/> تعديل تفاصيل المبيعات</h3>
                            <button onClick={() => setEditingSale(null)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                            {editingSale.items.map((item, idx) => (
                                <div key={idx} className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-3">
                                    <input 
                                        type="text" 
                                        className="w-full bg-gray-800 text-white p-3 rounded-xl border border-white/10 text-xs font-bold"
                                        value={item.name || ''}
                                        onChange={e => updateEditingItem(idx, 'name', e.target.value)}
                                        placeholder="اسم الصنف"
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">السعر</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-gray-800 text-white p-3 rounded-xl border border-white/10 text-center font-black"
                                                value={item.price || ''}
                                                onChange={e => updateEditingItem(idx, 'price', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">الكمية</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-gray-800 text-white p-3 rounded-xl border border-white/10 text-center font-black"
                                                value={item.qty || ''}
                                                onChange={e => updateEditingItem(idx, 'qty', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-left text-xs font-bold text-green-400">
                                        المجموع: {(item.price * item.qty).toLocaleString()} ج.م
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 border-t border-white/10 pt-4 flex justify-between items-center">
                            <div className="text-white">
                                <div className="text-[10px] font-black opacity-40 uppercase">إجمالي البيعة الجديد</div>
                                <div className="text-2xl font-black text-blue-400">
                                    {editingSale.items.reduce((acc, i) => acc + (i.price * i.qty), 0).toLocaleString()} ج.م
                                </div>
                            </div>
                            <button onClick={handleUpdateSale} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-2xl shadow-xl active:scale-[0.98] transition flex items-center gap-2">
                                <Save size={18}/> حفظ التعديلات
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* مودال إدارة التارجت */}
            {showTargetModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/20 w-full max-w-lg rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-white flex items-center gap-2"><Target className="text-purple-500"/> إدارة التارجت الذكي</h3>
                            <div className="flex items-center gap-3">
                                <button onClick={handleDownloadImage} className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm bg-blue-500/10 px-3 py-1.5 rounded-lg transition" title="تحميل صورة"><Printer size={16}/> تحميل التقرير</button>
                                <button onClick={() => setShowTargetModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">اختر الفرع</label>
                                <select className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold" value={targetMarket} onChange={e => setTargetMarket(e.target.value)}>
                                    <option value="">-- اختر الفرع --</option>
                                    {markets.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">الموظف</label>
                                <select className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold" value={targetEmployeeKey} onChange={e => setTargetEmployeeKey(e.target.value)}>
                                    <option value="">-- اختر الموظف --</option>
                                    {usersList.map(u => <option key={u.key} value={u.key}>{u.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">التارجت المقترح (محقق الشهر)</label>
                                    <input type="number" className="w-full p-4 rounded-2xl bg-gray-800 text-white border border-white/20 font-black text-lg" value={suggestedTarget} onChange={e => setSuggestedTarget(parseFloat(e.target.value) || 0)} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">نسبة النمو %</label>
                                    <input type="number" className="w-full p-4 rounded-2xl bg-gray-800 text-white border border-white/20 font-black text-lg" value={growthPercent} onChange={e => setGrowthPercent(parseFloat(e.target.value) || 0)} />
                                </div>
                            </div>
                            
                            {targetEmployeeKey && (
                                <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-2xl">
                                    <label className="block text-[10px] font-black opacity-60 uppercase mb-2 text-blue-400">تعديل التارجت (التارجت الحالي المسجل)</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="number" 
                                            className="flex-1 p-3 rounded-xl bg-gray-800 text-white border border-white/20 font-black text-lg" 
                                            value={currentActiveTarget} 
                                            onChange={e => setCurrentActiveTarget(parseFloat(e.target.value) || 0)} 
                                        />
                                        <button onClick={handleUpdateActiveTarget} className="bg-blue-600 hover:bg-blue-700 px-4 rounded-xl text-white font-bold transition whitespace-nowrap text-sm">
                                            حفظ التعديل
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="bg-purple-600/10 border border-purple-500/30 p-4 rounded-2xl">
                                <label className="block text-[10px] font-black opacity-60 uppercase mb-1 text-purple-400">التارجت النهائي المعتمد (جديد)</label>
                                <div className="text-3xl font-black text-white">{finalTarget.toLocaleString()} <span className="text-sm">ج.م</span></div>
                            </div>
                            <button onClick={handleSaveTarget} className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2 mt-2">
                                <Save size={20}/> اعتماد وإضافة التارجت الجديد
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showArchiveModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/20 w-full max-w-2xl rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-white flex items-center gap-2"><History className="text-blue-500"/> أرشيف التارجت</h3>
                            <button onClick={() => setShowArchiveModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="flex gap-2 mb-4">
                            <div className="flex-1 relative">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" size={16}/>
                                <input type="text" placeholder="بحث بالشهر أو الاسم..." className="w-full pr-10 p-3 rounded-xl bg-gray-800 text-white border border-white/10 text-xs" value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)} />
                            </div>
                            <select className="p-3 rounded-xl bg-[#808080] text-white border border-white/10 text-xs font-bold" value={archiveEmployee} onChange={e => setArchiveEmployee(e.target.value)}>
                                <option value="all">كل الموظفين</option>
                                {usersList.map(u => <option key={u.key} value={u.key}>{u.name}</option>)}
                            </select>
                            <button onClick={copyArchiveData} className="bg-blue-600 p-3 rounded-xl text-white hover:bg-blue-500 transition" title="نسخ البيانات">
                                <Copy size={18}/>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                            {(() => {
                                const filtered = getFilteredArchive();
                                const grouped = filtered.reduce((acc, h) => {
                                    if (!acc[h.month]) acc[h.month] = [];
                                    acc[h.month].push(h);
                                    return acc;
                                }, {} as Record<string, TargetHistory[]>);

                                // Ensure June ("2026-06") has Omnia, Toqa, Mena Ahmed's actual sales
                                const exactNames = findExactEmployeeNames();
                                const targetNames = [exactNames.omnia, exactNames.toqa, exactNames.mena];
                                
                                if (!grouped["2026-06"] && targetNames.length > 0) {
                                    grouped["2026-06"] = [];
                                }
                                
                                if (grouped["2026-06"]) {
                                    targetNames.forEach(empName => {
                                        const u = usersList.find(usr => usr.name === empName);
                                        const JuneAchieved = computeAchieved(empName, 2026, 5, u?.key); // Month index 5 is June
                                        const existingIdx = grouped["2026-06"].findIndex(h => h.employeeName === empName);
                                        if (existingIdx !== -1) {
                                            grouped["2026-06"][existingIdx].achievedAmount = JuneAchieved;
                                        } else {
                                            const t = targetsList.find(tg => tg.employeeName === empName);
                                            grouped["2026-06"].push({
                                                id: `temp-${empName}`,
                                                userId: u?.key || empName,
                                                employeeName: empName,
                                                month: "2026-06",
                                                targetAmount: t ? t.finalTarget : 0,
                                                achievedAmount: JuneAchieved
                                            });
                                        }
                                    });
                                }

                                const getMonthDateRange = (monthStr: string) => {
                                    if (!monthStr || !monthStr.includes('-')) return '';
                                    const [year, month] = monthStr.split('-');
                                    const m = parseInt(month, 10);
                                    const y = parseInt(year, 10);
                                    if (isNaN(m) || isNaN(y)) return monthStr;
                                    const lastDay = new Date(y, m, 0).getDate();
                                    return `من 1/${m}/${y} إلى ${lastDay}/${m}/${y}`;
                                };

                                const toggleArchiveMonth = (month: string) => {
                                    setExpandedArchiveMonths(prev => ({...prev, [month]: !prev[month]}));
                                };

                                return Object.entries(grouped)
                                    .sort((a, b) => b[0].localeCompare(a[0])) // Sort by month descending
                                    .map(([month, histories]) => {
                                        const isExpanded = expandedArchiveMonths[month] !== false; // Default to true (expanded) for new months
                                        const totalTarget = histories.reduce((sum, h) => sum + h.targetAmount, 0);
                                        const totalAchieved = histories.reduce((sum, h) => sum + h.achievedAmount, 0);
                                        const totalRemaining = Math.max(0, totalTarget - totalAchieved);
                                        const totalPerc = totalTarget > 0 ? Math.min(100, Math.round((totalAchieved / totalTarget) * 100)) : 0;

                                        return (
                                            <div key={month} className="p-4 rounded-2xl border border-white/10 bg-black/40 flex flex-col gap-3">
                                                <div 
                                                    className="flex justify-between items-center cursor-pointer"
                                                    onClick={() => toggleArchiveMonth(month)}
                                                >
                                                    <div className="flex-1">
                                                        <div className="font-bold text-lg text-white">شهر {month}</div>
                                                        <div className="text-xs opacity-60 text-white mt-1 mb-2">{getMonthDateRange(month)}</div>
                                                        <div className="flex flex-wrap gap-2 text-xs">
                                                            <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">إجمالي التارجت: {totalTarget.toLocaleString()}</span>
                                                            <span className="bg-green-500/20 text-green-300 px-2 py-1 rounded">المحقق: {totalAchieved.toLocaleString()}</span>
                                                            <span className="bg-red-500/20 text-red-300 px-2 py-1 rounded">المتبقي: {totalRemaining.toLocaleString()}</span>
                                                            <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded">النسبة: {totalPerc}%</span>
                                                        </div>
                                                    </div>
                                                    <button className="text-white/60 hover:text-white transition bg-white/5 p-2 rounded-xl">
                                                        {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                                                    </button>
                                                </div>

                                                {isExpanded && (
                                                    <div className="space-y-2 mt-2 pt-3 border-t border-white/10">
                                                        {histories.map(h => {
                                                            const perc = h.targetAmount > 0 ? Math.min(100, Math.round((h.achievedAmount / h.targetAmount) * 100)) : 0;
                                                            return (
                                                            <div key={h.id} className="p-3 rounded-xl border border-white/5 bg-gray-800/50 flex justify-between items-center hover:bg-gray-800 transition">
                                                                <div className="font-bold text-sm text-blue-400 flex items-center gap-2">
                                                                    {h.employeeName}
                                                                    <span className="text-xs bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">{perc}%</span>
                                                                </div>
                                                                <div className="text-left">
                                                                    <div className="text-[10px] font-bold opacity-40 uppercase mb-1">التارجت: {h.targetAmount.toLocaleString()}</div>
                                                                    <div className={`text-sm font-black ${h.achievedAmount >= h.targetAmount ? 'text-green-400' : 'text-orange-400'}`}>
                                                                        المحقق: {h.achievedAmount.toLocaleString()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                });
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {showProductSalesModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/20 w-full max-w-2xl rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh] my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-white flex items-center gap-2"><Package className="text-blue-500"/> تقرير مبيعات الأصناف</h3>
                            <button onClick={() => setShowProductSalesModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">الأصناف</label>
                                <select className="w-full p-3 rounded-xl bg-[#808080] text-white border border-white/10 text-xs font-bold" value={reportItem} onChange={e => setReportItem(e.target.value)}>
                                    <option value="all">كل الأصناف</option>
                                    {Object.entries(groupedItems).map(([cat, items]) => {
                                        if (items.length === 0) return null;
                                        const label = categoryLabels[cat] || cat;
                                        return (
                                            <optgroup key={cat} label={label}>
                                                {items.map(name => <option key={name} value={name}>{name}</option>)}
                                            </optgroup>
                                        );
                                    })}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">الماركت</label>
                                <select className="w-full p-3 rounded-xl bg-[#808080] text-white border border-white/10 text-xs font-bold" value={reportMarket} onChange={e => setReportMarket(e.target.value)}>
                                    <option value="all">كل الماركتات المسجلة</option>
                                    {marketsWithSales.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">من تاريخ</label>
                                <input type="date" className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10 text-xs" value={reportStart} onChange={e => setReportStart(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">إلى تاريخ</label>
                                <input type="date" className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10 text-xs" value={reportEnd} onChange={e => setReportEnd(e.target.value)} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-2xl flex items-center gap-3">
                                <ShoppingBag className="text-blue-400" size={24}/>
                                <div>
                                    <div className="text-[10px] font-black opacity-40 uppercase text-white">الكمية المباعة</div>
                                    <div className="text-xl font-black text-white">{reportResults.totalQty.toLocaleString()} <span className="text-[10px] opacity-60">قطعة</span></div>
                                </div>
                            </div>
                            <div className="bg-green-600/10 border border-green-500/30 p-4 rounded-2xl flex items-center gap-3">
                                <Calculator className="text-green-400" size={24}/>
                                <div>
                                    <div className="text-[10px] font-black opacity-40 uppercase text-white">القيمة الإجمالية</div>
                                    <div className="text-xl font-black text-white">{reportResults.totalValue.toLocaleString()} <span className="text-[10px] opacity-60">ج.م</span></div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/5 rounded-2xl bg-black/20 p-2">
                             <table className="w-full text-[10px] text-center">
                                <thead className="bg-white/5 text-white/50">
                                    <tr>
                                        <th className="py-2 px-2 text-right text-white">اسم الصنف</th>
                                        <th className="py-2 text-white">سعر القطعة</th>
                                        <th className="py-2 text-white">الكمية</th>
                                        <th className="py-2 px-2 text-white">الإجمالي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(Object.entries(reportResults.itemsGrouped) as [string, { price: number; qty: number; total: number }][]).map(([name, stats], idx) => (
                                        <tr key={idx} className="border-t border-white/5 text-white">
                                            <td className="py-2 px-2 text-right font-bold truncate max-w-[150px]">{name}</td>
                                            <td className="py-2">{stats.price.toLocaleString()}</td>
                                            <td className="py-2 font-black">{stats.qty.toLocaleString()}</td>
                                            <td className="py-2 px-2 text-green-400 font-black">{stats.total.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    {Object.keys(reportResults.itemsGrouped).length > 0 && (
                                        <tr className="border-t-2 border-white/20 bg-white/5 font-black text-white">
                                            <td className="py-3 px-2 text-right uppercase tracking-widest" colSpan={3}>الإجمالي العام</td>
                                            <td className="py-3 px-2 text-green-400 text-sm">{reportResults.totalValue.toLocaleString()}</td>
                                        </tr>
                                    )}
                                </tbody>
                             </table>
                        </div>

                        {reportItem === 'all' && Object.keys(reportResults.itemsGrouped).length > 0 && (
                            <button 
                                onClick={handleExportProductSales}
                                className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2 mt-4"
                            >
                                <FileSpreadsheet size={20}/> تصدير ملف إكسيل
                            </button>
                        )}
                    </div>
                </div>
            )}

            {showExportModal && (
              <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-gray-900 border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl my-auto">
                  <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg text-white">تصدير مبيعات فترة زمنية</h3><button onClick={() => setShowExportModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button></div>
                  <div className="space-y-4">
                    <div><label className="block text-xs font-bold mb-1 opacity-60 text-white">تاريخ البداية</label><input type="date" className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10" value={exportStart} onChange={e => setExportStart(e.target.value)} /></div>
                    <div><label className="block text-xs font-bold mb-1 opacity-60 text-white">تاريخ النهاية</label><input type="date" className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10" value={exportEnd} onChange={e => setExportEnd(e.target.value)} /></div>
                    <div><label className="block text-xs font-bold mb-1 opacity-60 text-white">الماركت (اختياري)</label><select className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10" value={exportMarket} onChange={e => setExportMarket(e.target.value)}><option value="">كل الماركتات</option>{markets.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    <button onClick={handleExportPeriod} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-xl transition active:scale-95">بدء التحميل (Excel)</button>
                  </div>
                </div>
              </div>
            )}
            {showCurrentTargetsModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/10 w-full max-w-2xl rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-orange-400 flex items-center gap-2">
                                <Target size={24}/> {selectedTargetMonth === 'current' ? 'تارجت الشهر الحالي' : `أرشيف التارجت لشهر ${selectedTargetMonth}`}
                            </h3>
                            <button onClick={() => { setShowCurrentTargetsModal(false); setSelectedTargetMonth('current'); }} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4 items-end">
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-black opacity-50 uppercase mb-1 text-white">التارجت السابق</label>
                                <select 
                                    className="w-full p-2.5 rounded-xl bg-gray-800 text-white border border-white/10 text-xs font-bold"
                                    value={selectedTargetMonth === 'current' ? '' : selectedTargetMonth}
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setSelectedTargetMonth(e.target.value);
                                        }
                                    }}
                                >
                                    <option value="" disabled>-- اختر شهر من الأرشيف --</option>
                                    {pastMonthsList.map(mKey => (
                                        <option key={mKey} value={mKey}>{mKey}</option>
                                    ))}
                                </select>
                            </div>

                            <button 
                                onClick={() => setSelectedTargetMonth('current')}
                                className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition h-[40px] ${
                                    selectedTargetMonth === 'current' 
                                        ? 'bg-orange-600 text-white cursor-default' 
                                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                                }`}
                            >
                                <Target size={14}/> الشهر الحالي
                            </button>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-black opacity-50 uppercase mb-1 text-white">تحديد اسم</label>
                                <select 
                                    className="w-full p-2.5 rounded-xl bg-gray-800 text-white border border-white/10 text-xs font-bold"
                                    value={targetPrintEmployee} 
                                    onChange={e => setTargetPrintEmployee(e.target.value)}
                                >
                                    <option value="">الكل</option>
                                    {usersList.map(u => <option key={u.key} value={u.key}>{u.name}</option>)}
                                </select>
                            </div>
                            <button 
                                onClick={() => handleDownloadImage(false)}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition h-[40px]"
                                title="تحميل صورة"
                            >
                                <Printer size={14}/> تحميل
                            </button>
                            {targetPrintEmployee && (
                                <button 
                                    onClick={() => handleDownloadImage(true)}
                                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition h-[40px]"
                                    title="مشاركة WhatsApp"
                                >
                                    <Share2 size={14}/> WhatsApp
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            <div id="current-targets-print-area" className="space-y-2 bg-gray-900 pb-2">
                                {selectedTargetMonth === 'current' 
                                    ? renderTargetsList() 
                                    : renderPastMonthTargetsList(selectedTargetMonth)
                                }
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showPastTargetsModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/10 w-full max-w-3xl rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-gray-300 flex items-center gap-2">
                                <History size={24}/> التارجت للشهور السابقة
                            </h3>
                            <button onClick={() => setShowPastTargetsModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                            {pastMonthsList.map(mKey => {
                                const [yStr, mStr] = mKey.split('-');
                                const year = parseInt(yStr);
                                const month = parseInt(mStr) - 1;
                                
                                const monthTargets = targetsList.map(t => {
                                    const achieved = computeAchieved(t.employeeName, year, month, t.userId);
                                    let pastTarget = t.finalTarget;
                                    // Try to fetch historical target if available
                                    const historical = archiveData.find(a => a.userId === t.userId && a.month === mKey);
                                    if (historical) {
                                        if ((historical as any).isDeleted) return null;
                                        pastTarget = historical.targetAmount;
                                    }
                                    
                                    if (achieved === 0 && pastTarget === 0) return null;
                                    const perc = pastTarget > 0 ? ((achieved / pastTarget) * 100).toFixed(1) : 0;

                                    return (
                                        <div key={`${t.userId}-${mKey}`} className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                                            <div className="w-1/3">
                                                <div className="font-bold text-white text-sm truncate">{t.employeeName}</div>
                                                <div className="text-[10px] opacity-60 text-white truncate">{t.market}</div>
                                            </div>
                                            <div className="flex-1 flex justify-center gap-6">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] opacity-50 text-white uppercase font-black">التارجت</span>
                                                    <span className="font-black text-yellow-400 text-sm">{pastTarget.toLocaleString()}</span>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] opacity-50 text-white uppercase font-black">المحقق</span>
                                                    <span className="font-black text-green-400 text-sm">{achieved.toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 border-r pr-3 mr-1 border-white/10">
                                                <button onClick={() => handleEditPastTarget(t.userId, t.employeeName, mKey, historical, pastTarget, achieved)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded-lg transition" title="تعديل"><Edit size={16}/></button>
                                                <button onClick={() => handleDeletePastTarget(t.userId, t.employeeName, mKey, historical)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition" title="حذف"><Trash2 size={16}/></button>
                                            </div>
                                            <div className="w-16 text-left border-l border-white/10 pl-2 ml-2">
                                                <span className="font-black text-blue-400 text-sm">{perc}%</span>
                                            </div>
                                        </div>
                                    );
                                }).filter(Boolean);

                                if (monthTargets.length === 0) return null;

                                return (
                                    <div key={mKey} id={`past-month-${mKey}`} className="bg-gray-800 p-4 rounded-2xl border border-white/5">
                                        <div className="mb-3 border-b border-white/10 pb-2 flex items-center justify-between">
                                            <h4 className="font-bold text-indigo-400">شهر: {mKey}</h4>
                                            <button 
                                                onClick={() => handleDownloadPastMonthImage(mKey)}
                                                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                                                title="تحميل كصورة"
                                            >
                                                <Printer size={14}/> تحميل كصورة
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {monthTargets}
                                        </div>
                                    </div>
                                );
                            })}
                            {pastMonthsList.length === 0 && <div className="text-center py-10 opacity-50 text-white">لا توجد شهور سابقة مسجلة</div>}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Hidden Print Area for Selected Sales (Phase 1) */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                <div id="selected-sales-print-area" className="w-[1000px] p-8 bg-gray-900 space-y-4 rounded-3xl" style={{ direction: 'rtl' }}>
                    <div className="text-center mb-6 border-b border-white/10 pb-4">
                        <h2 className="text-3xl font-black text-white">تقرير مبيعات محددة</h2>
                        <p className="text-gray-400 mt-2 text-lg">{new Date().toLocaleDateString('ar-EG')}</p>
                    </div>
                    <div className="space-y-4">
                        {sales.filter(s => selectedSalesIds.includes(s.id)).map(sale => (
                            <div key={sale.id} className="p-5 rounded-3xl border border-white/20 bg-gray-800 shadow-2xl">
                                <div>
                                    <div className="font-bold text-2xl text-blue-400 mb-2">{sale.market}</div>
                                    <div className="flex flex-wrap items-center gap-4 text-sm opacity-80 font-bold mt-1 text-white mb-4">
                                        <span className="flex items-center gap-1"><Calendar size={16}/> {new Date(sale.timestamp).toLocaleDateString('ar-EG', { weekday: 'long' })} - {sale.date}</span>
                                        <span className="flex items-center gap-1"><UserIcon size={16}/> {sale.employeeName}</span>
                                    </div>
                                </div>
                                <div className="overflow-hidden rounded-2xl bg-black/40 border border-white/10">
                                    <table className="w-full text-base text-center">
                                        <thead className="bg-white/10 text-white/70">
                                            <tr><th className="py-3 px-4 text-right text-white">الصنف</th><th className="py-3 text-white">السعر</th><th className="py-3 text-white">الكمية</th><th className="py-3 px-4 text-white">المجموع</th></tr>
                                        </thead>
                                        <tbody>
                                            {(sale.items || []).map((item, idx) => (
                                                <tr key={idx} className="border-t border-white/5">
                                                    <td className="py-3 px-4 text-right text-gray-200">{item.name}</td>
                                                    <td className="py-3 text-gray-400">{item.price}</td>
                                                    <td className="py-3 font-bold text-white bg-white/5">{item.qty}</td>
                                                    <td className="py-3 px-4 font-bold text-blue-300">{(item.qty * item.price).toLocaleString()} <span className="text-xs">ج.م</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-blue-600/20 border-t border-blue-500/30">
                                            <tr><td colSpan={3} className="py-4 px-4 text-left font-black text-white text-lg">الإجمالي:</td><td className="py-4 px-4 font-black text-blue-400 text-xl">{sale.total.toLocaleString()} <span className="text-sm">ج.م</span></td></tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div id="selected-target-print-area" className="w-[1000px] p-8 bg-gray-900 rounded-3xl" style={{ direction: 'rtl' }}>
                    <div className="text-center mb-6 border-b border-white/10 pb-4">
                        <h2 className="text-3xl font-black text-white">تقرير التارجت للموظف</h2>
                    </div>
                    <div className="space-y-4">
                        {targetsList.filter(t => t.userId === selectedTargetEmployeeToShare).map(t => {
                            const now = new Date();
                            const achieved = computeAchieved(t.employeeName, now.getFullYear(), now.getMonth(), t.userId);
                            const ratio = t.finalTarget > 0 ? (achieved / t.finalTarget) * 100 : 0;
                            const remaining = Math.max(0, t.finalTarget - achieved);
                            return (
                            <div key={t.userId} className="p-6 bg-gray-800 rounded-2xl border border-white/20">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                                        {t.employeeName.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-white">{t.employeeName}</div>
                                        <div className="text-lg text-blue-400">{t.market}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                                        <div className="text-gray-400 text-sm mb-1">التارجت المطلوب</div>
                                        <div className="text-3xl font-black text-white">{t.finalTarget.toLocaleString()} <span className="text-sm text-gray-500">ج.م</span></div>
                                    </div>
                                    <div className="bg-blue-900/30 p-4 rounded-xl border border-blue-500/20">
                                        <div className="text-blue-300 text-sm mb-1">المُحقق</div>
                                        <div className="text-3xl font-black text-blue-400">{achieved.toLocaleString()} <span className="text-sm text-blue-500/50">ج.م</span></div>
                                    </div>
                                </div>
                                <div className="mt-6">
                                    <div className="flex justify-between text-sm font-bold text-white mb-2">
                                        <span>نسبة الإنجاز</span>
                                        <span className={ratio >= 100 ? 'text-green-400' : 'text-blue-400'}>{ratio.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full h-4 bg-gray-900 rounded-full overflow-hidden border border-white/5">
                                        <div className={`h-full transition-all duration-1000 ${ratio >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(ratio, 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        )})}
                    </div>
                </div>
            </div>

            {/* Hidden Print Area for html2canvas */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                <div id="hidden-print-area" className="w-[600px] p-6 bg-gray-900 space-y-2">
                    {selectedTargetMonth === 'current' 
                        ? renderTargetsList() 
                        : renderPastMonthTargetsList(selectedTargetMonth)
                    }
                </div>
            </div>

        </div>
    );
};

export default SalesLog;
