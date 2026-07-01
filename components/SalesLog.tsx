
import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { ref, onValue, remove, update, get, set, push } from "firebase/database";
import { User, SaleRecord, ProductItem, UserTarget, TargetHistory } from '../types';
import { 
    Trash2, Edit, FileSpreadsheet, Save, X, Calendar, User as UserIcon, TrendingUp, Star, Trophy, Download, Filter, Target, History, Copy, Search, Package, ShoppingBag, Calculator, ChevronDown, ChevronUp, Printer
} from 'lucide-react';
import { exportToCSV } from '../utils';
import html2canvas from 'html2canvas';

interface Props {
    user: User;
    markets: string[];
    theme: string;
}

const SalesLog: React.FC<Props> = ({ user, markets, theme }) => {
    const [sales, setSales] = useState<SaleRecord[]>([]);
    const [filteredSales, setFilteredSales] = useState<SaleRecord[]>([]);
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
    const [showPastTargetsModal, setShowPastTargetsModal] = useState(false);
    const [targetsList, setTargetsList] = useState<UserTarget[]>([]);

    useEffect(() => {
        onValue(ref(db, 'sales'), (snapshot) => {
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
            onValue(ref(db, 'users'), (snap) => {
                if (snap.exists()) {
                    const list: User[] = [];
                    snap.forEach(child => { list.push({ key: child.key!, ...child.val() }); });
                    setUsersList(list);
                }
            });
            onValue(ref(db, 'targets'), snap => {
                if (snap.exists()) {
                    setTargetsList(Object.values(snap.val()));
                } else {
                    setTargetsList([]);
                }
            });
            onValue(ref(db, 'target_history'), snap => {
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
    const uniqueItems = useMemo(() => {
        const set = new Set<string>();
        sales.forEach(s => s.items?.forEach(i => set.add(i.name)));
        return Array.from(set).sort();
    }, [sales]);

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

        results.forEach(s => {
            (s.items || []).forEach(i => {
                if (reportItem === 'all' || i.name === reportItem) {
                    totalQty += i.qty;
                    totalValue += (i.qty * i.price);
                    
                    if (!itemsGrouped[i.name]) {
                        itemsGrouped[i.name] = { price: i.price, qty: 0, total: 0 };
                    }
                    itemsGrouped[i.name].qty += i.qty;
                    itemsGrouped[i.name].total += (i.qty * i.price);
                }
            });
        });

        return { totalQty, totalValue, itemsGrouped };
    }, [sales, reportItem, reportMarket, reportStart, reportEnd]);

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
                    userId, employeeName, month: monthKey, targetAmount: Number(newVal), achievedAmount: achieved
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
                    userId, employeeName, month: monthKey, targetAmount: 0, achievedAmount: 0, isDeleted: true
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

    const computeAchieved = (employeeName: string, year: number, month: number) => {
        const start = new Date(year, month, 1).getTime();
        const end = new Date(year, month + 1, 0, 23, 59, 59).getTime(); // last day of month
        return sales
            .filter(s => s.employeeName === employeeName && s.timestamp >= start && s.timestamp <= end)
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
            const achieved = computeAchieved(t.employeeName, now.getFullYear(), now.getMonth());
            return { ...t, achieved };
        });

        const totalTarget = targetsWithAchieved.reduce((sum, t) => sum + t.finalTarget, 0);
        const totalAchieved = targetsWithAchieved.reduce((sum, t) => sum + t.achieved, 0);
        const totalPerc = totalTarget > 0 ? ((totalAchieved / totalTarget) * 100).toFixed(1) : 0;

        return (
            <>
                {targetsWithAchieved.map(t => {
                    const perc = t.finalTarget > 0 ? ((t.achieved / t.finalTarget) * 100).toFixed(1) : 0;
                    return (
                        <div key={t.userId} className="bg-black/30 border border-white/5 p-4 rounded-2xl">
                            <div className="flex justify-between items-center mb-2">
                                <div>
                                    <div className="font-bold text-white text-lg">{t.employeeName}</div>
                                    <div className="text-xs opacity-60 text-white">{t.market}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleEditCurrentTarget(t.userId, t.finalTarget)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded-lg transition" title="تعديل"><Edit size={16}/></button>
                                    <button onClick={() => handleDeleteCurrentTarget(t.userId)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition" title="حذف"><Trash2 size={16}/></button>
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
                            <div className="font-bold text-white text-lg">الإجمالي لجميع الحسابات</div>
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

    const handleDownloadImage = async () => {
        let element = document.getElementById('current-targets-print-area');
        if (!element || element.offsetParent === null) {
            element = document.getElementById('hidden-print-area');
        }
        if (!element) return;
        try {
            const canvas = await html2canvas(element, {
                backgroundColor: '#111827', // Tailwind bg-gray-900
                scale: 2,
            });
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `targets-${new Date().toISOString().split('T')[0]}.png`;
            link.href = dataUrl;
            link.click();
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
            "إجمالي مبيعات اليوم": s.total.toLocaleString() + " ج.م"
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
                if (!itemsGrouped[i.name]) {
                    itemsGrouped[i.name] = { price: i.price, qty: 0, total: 0 };
                }
                itemsGrouped[i.name].qty += i.qty;
                itemsGrouped[i.name].total += (i.qty * i.price);
                itemsGrouped[i.name].price = i.price; // Keep latest price or maybe not needed if it's constant
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
        const end = new Date(now.getFullYear(), now.getMonth(), 30).getTime();
        const currentMonthSales = sales.filter(s => s.timestamp >= start && s.timestamp <= end);
        const totals: Record<string, number> = {};
        currentMonthSales.forEach(s => totals[s.employeeName] = (totals[s.employeeName] || 0) + s.total);
        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        return sorted.length > 0 ? { name: sorted[0][0], total: sorted[0][1] } : null;
    };

    const star = getStarOfMonth();

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

            {star && (
                <div className="bg-[#808080] p-6 rounded-3xl border border-white/20 shadow-2xl flex flex-col items-center justify-center space-y-2 relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:rotate-12 transition-transform duration-700"><Trophy size={120} /></div>
                    <Star className="text-yellow-400 animate-pulse" size={32} fill="currentColor" />
                    <h3 className="text-xl font-black text-white uppercase tracking-widest">نجم الشهر الحالي</h3>
                    <div className="text-3xl font-black text-white">{star.name}</div>
                    <div className="text-sm font-bold opacity-80 text-white">إجمالي مبيعات الشهر: <span className="text-green-300 font-black">{star.total.toLocaleString()} ج.م</span></div>
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

            <div className="space-y-4">
                {filteredSales.map(sale => (
                    <div key={sale.id} className="p-5 rounded-3xl border border-white/10 bg-gray-800 shadow-2xl">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="font-bold text-xl text-blue-400">{sale.market}</div>
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
                                        value={item.name}
                                        onChange={e => updateEditingItem(idx, 'name', e.target.value)}
                                        placeholder="اسم الصنف"
                                    />
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">السعر</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-gray-800 text-white p-3 rounded-xl border border-white/10 text-center font-black"
                                                value={item.price}
                                                onChange={e => updateEditingItem(idx, 'price', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">الكمية</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-gray-800 text-white p-3 rounded-xl border border-white/10 text-center font-black"
                                                value={item.qty}
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
                                    {uniqueItems.map(name => <option key={name} value={name}>{name}</option>)}
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
                                <Target size={24}/> تارجت الشهر الحالي
                            </h3>
                            <button onClick={() => setShowCurrentTargetsModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="flex gap-2 mb-4">
                            <button 
                                onClick={() => { setShowCurrentTargetsModal(false); setShowPastTargetsModal(true); }}
                                className="bg-gray-700 hover:bg-gray-600 text-white flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition"
                            >
                                <History size={18}/> التارجت السابق
                            </button>
                            <button 
                                onClick={handleDownloadImage}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition"
                                title="تحميل صورة"
                            >
                                <Printer size={18}/> تحميل كصورة
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            <div id="current-targets-print-area" className="space-y-2 bg-gray-900 pb-2">
                                {renderTargetsList()}
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
                                    const achieved = computeAchieved(t.employeeName, year, month);
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
                                    <div key={mKey} className="bg-gray-800 p-4 rounded-2xl border border-white/5">
                                        <div className="mb-3 border-b border-white/10 pb-2 flex items-center justify-between">
                                            <h4 className="font-bold text-indigo-400">شهر: {mKey}</h4>
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
            {/* Hidden Print Area for html2canvas */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                <div id="hidden-print-area" className="w-[600px] p-6 bg-gray-900 space-y-2">
                    {renderTargetsList()}
                </div>
            </div>

        </div>
    );
};

export default SalesLog;
