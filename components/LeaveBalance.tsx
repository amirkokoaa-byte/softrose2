import { onCachedValue } from "../firebaseCache";

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, set, push, remove, update, get } from "firebase/database";
import { User, LeaveBalance, LeaveRecord } from '../types';
import { 
    Trash2, Edit, CalendarPlus, X, Save, History, 
    ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Calendar as CalendarIcon,
    User as UserIcon, FileSpreadsheet, Printer
} from 'lucide-react';
import { exportToCSV, exportToExcel } from '../utils';

interface Props {
    user: User;
    theme: string;
}

const LeaveBalanceComponent: React.FC<Props> = ({ user, theme }) => {
    const [balances, setBalances] = useState<Record<string, LeaveBalance>>({});
    const [usersList, setUsersList] = useState<User[]>([]);
    const [allHistory, setAllHistory] = useState<({id: string} & LeaveRecord)[]>([]);
    
    const [showAddLeaveModal, setShowAddLeaveModal] = useState(false);
    const [showHistoryDetailsModal, setShowHistoryDetailsModal] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [showEditBalanceModal, setShowEditBalanceModal] = useState<LeaveBalance | null>(null);
    
    const [selectedEmployeeForExport, setSelectedEmployeeForExport] = useState<string>('all');
    const [exportStartDate, setExportStartDate] = useState<string>('');
    const [exportEndDate, setExportEndDate] = useState<string>('');
    
    // دورة الإجازات: تبدأ من 21 في الشهر السابق إلى 20 في الشهر الحالي
    const [periodDate, setPeriodDate] = useState<Date>(() => {
        const now = new Date();
        return now.getDate() >= 21 ? new Date(now.getFullYear(), now.getMonth(), 21) : new Date(now.getFullYear(), now.getMonth() - 1, 21);
    });

    const [selectedUser, setSelectedUser] = useState('');
    const [leaveDate, setLeaveDate] = useState('');
    const [leaveDays, setLeaveDays] = useState(1);
    const [leaveType, setLeaveType] = useState<'annual' | 'casual' | 'sick' | 'exams' | 'unpaid'>('annual');
    const [historyUserView, setHistoryUserView] = useState<{userId: string, name: string} | null>(null);
    const [customLeaveName, setCustomLeaveName] = useState('');
    const [officialOccasion, setOfficialOccasion] = useState('');
    const [showWeeklyModal, setShowWeeklyModal] = useState(false);
    const [weeklyUser, setWeeklyUser] = useState('');
    const [weeklyDay, setWeeklyDay] = useState('');


    // نوع البيانات: "remaining" (يتم الطرح) أو "accrued" (يتم الجمع كعداد)
    const typeLogic: any = { annual: 'remaining', casual: 'remaining', sick: 'accrued', exams: 'accrued', unpaid: 'accrued', custom: 'remaining', penalty: 'accrued', official: 'none', summer: 'accrued' };
    const typeLabels: any = { annual: 'سنوي', casual: 'عارضة', sick: 'مرضي', exams: 'امتحانات', unpaid: 'غياب بأذن', penalty: 'جزاء', official: 'إجازة رسمية', summer: 'إجازة مصيف' }; // custom handled separately
    const typeColors: any = { annual: 'text-green-400', casual: 'text-yellow-400', sick: 'text-red-400', exams: 'text-purple-400', unpaid: 'text-orange-400', custom: 'text-cyan-400', penalty: 'text-red-600', official: 'text-blue-400', summer: 'text-teal-400' };

    useEffect(() => {
        const unsubUsers = onCachedValue(ref(db, 'users'), 'users', snapshot => {
            if (snapshot.exists()) {
                const u: User[] = [];
                snapshot.forEach(c => { u.push({ key: c.key!, ...c.val() }); });
                setUsersList(u);
            }
        });
        
        const unsubBalances = onCachedValue(ref(db, 'leave_balances'), 'leave_balances', snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val() as Record<string, LeaveBalance>;
                setBalances(data);
                
                // منطق التصفير التلقائي لخانة "غياب بأذن" في يوم 21 من كل شهر
                const now = new Date();
                const day = now.getDate();
                const currentMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
                
                if (day >= 21) {
                    Object.keys(data).forEach(async (uKey) => {
                        const balance = data[uKey];
                        if (balance.lastUnpaidReset !== currentMonthKey) {
                            await update(ref(db, `leave_balances/${uKey}`), {
                                unpaid: 0,
                                lastUnpaidReset: currentMonthKey
                            });
                        }
                    });
                }
            } else {
                setBalances({});
            }
        });
        
        const unsubHistory = onCachedValue(ref(db, 'leave_history'), 'leave_history', snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const h: any = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                setAllHistory(h);
            } else { setAllHistory([]); }
        });
        
return () => { unsubUsers(); unsubBalances(); unsubHistory(); };
    }, []);

    const getPeriodEnd = (start: Date) => {
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        end.setDate(20);
        return end;
    };

    const changePeriod = (direction: number) => {
        const next = new Date(periodDate);
        next.setMonth(next.getMonth() + direction);
        setPeriodDate(next);
    };

    const filterHistoryByPeriodAndUser = (userId: string) => {
        const pStart = new Date(periodDate);
        pStart.setHours(0,0,0,0);
        const pEnd = getPeriodEnd(periodDate);
        pEnd.setHours(23,59,59,999);
        return allHistory.filter(r => r.userId === userId && new Date(r.date) >= pStart && new Date(r.date) <= pEnd);
    };

    const handleDeleteRecord = async (id: string, record: LeaveRecord) => {
        if(!confirm("حذف السجل وإعادة الرصيد للموظف؟")) return;
        
        const balanceRef = ref(db, `leave_balances/${record.userId}`);
        const balanceSnap = await get(balanceRef);
        if(balanceSnap.exists()) {
            const bal = balanceSnap.val();
            // إعادة الرصيد بناءً على نوع المنطق
            const multiplier = typeLogic[record.type] === 'remaining' ? 1 : -1;
            await update(balanceRef, { [record.type]: (Number(bal[record.type]) || 0) + (multiplier * Number(record.days)) });
            if (record.type === 'summer') {
                if (record.deductedFromAnnual !== false) {
                    await update(balanceRef, { 'annual': (Number(bal['annual']) || 0) + Number(record.days) });
                }
            }
        }
        
        await remove(ref(db, `leave_history/${id}`));
        alert("تم الحذف وتحديث الرصيد بنجاح");
    };

    const handleDeleteEmployeeData = async (userId: string, userName: string) => {
        if(!confirm(`هل أنت متأكد من حذف بيانات إجازات الموظف "${userName}" نهائياً؟`)) return;
        await remove(ref(db, `leave_balances/${userId}`));
        alert("تم حذف سجل الرصيد للموظف");
    };

    const handleAddLeave = async () => {
        if (!leaveDate) return alert("اختر التاريخ");
        if (leaveType === 'custom' && !customLeaveName.trim()) return alert("اكتب نوع الإجازة المخصصة");
        if (leaveType === 'official' && !officialOccasion.trim()) return alert("اكتب المناسبة للإجازة الرسمية");
        
        if (leaveType === 'official') {
            const isOfficialDuplicate = allHistory.some(r => r.date === leaveDate && r.type === 'official');
            if (isOfficialDuplicate) return alert("تم تسجيل إجازة رسمية في هذا اليوم مسبقاً");
            const ts = new Date(leaveDate).getTime();
            const updates: any = {};
            usersList.forEach(u => {
                const newRef = push(ref(db, 'leave_history'));
                updates[newRef.key!] = {
                    userId: u.key || 'unknown',
                    employeeName: u.name || u.username || 'Unknown',
                    date: leaveDate,
                    days: Number(leaveDays),
                    type: 'official',
                    customLabel: officialOccasion.trim(),
                    timestamp: ts
                };
            });
            await update(ref(db, 'leave_history'), updates);
            setShowAddLeaveModal(false);
            setOfficialOccasion('');
            return alert("تم تعميم الإجازة الرسمية بنجاح");
        }

        if (!selectedUser) return alert("اختر الموظف");

        const targetUser = usersList.find(u => u.key === selectedUser);
        if (!targetUser) return;

        const isDuplicate = allHistory.some(r => r.userId === selectedUser && r.date === leaveDate);
        if (isDuplicate) return alert("تم تسجيل هذا اليوم مسبقاً لهذا الموظف");

        const balanceRef = ref(db, `leave_balances/${selectedUser}`);
        const snap = await get(balanceRef);
        let cur = snap.exists() ? snap.val() : { userId: selectedUser, employeeName: targetUser.name || targetUser.username || 'Unknown', annual: 21, casual: 7, sick: 0, exams: 0, unpaid: 0 };
        
        let targetBalanceField = leaveType;
        if (leaveType === 'custom') {
            targetBalanceField = 'annual';
        }

        if (typeLogic[targetBalanceField] === 'remaining') {
            cur[targetBalanceField] = Number(cur[targetBalanceField] || 0) - Number(leaveDays);
        } else if (typeLogic[targetBalanceField] === 'accrued') {
            cur[targetBalanceField] = Number(cur[targetBalanceField] || 0) + Number(leaveDays);
        }
        let deductedFromAnnual = false;
        if (leaveType === 'summer') {
            if (Number(cur['annual'] || 0) > 0) {
                cur['annual'] = Number(cur['annual'] || 0) - Number(leaveDays);
                deductedFromAnnual = true;
            }
        }

        await set(balanceRef, cur);
        
        const newLeaveData: any = {
            userId: selectedUser,
            employeeName: targetUser.name || targetUser.username || 'Unknown',
            date: leaveDate,
            days: Number(leaveDays),
            type: leaveType,
            timestamp: new Date(leaveDate).getTime()
        };
        if (leaveType === 'custom') {
            newLeaveData.customLabel = customLeaveName.trim();
        }
        if (leaveType === 'summer') {
            newLeaveData.deductedFromAnnual = deductedFromAnnual;
        }
        await push(ref(db, 'leave_history'), newLeaveData);
        
        setShowAddLeaveModal(false);
        setCustomLeaveName('');
        if (leaveType === 'penalty') {
            alert("تم الحفظ");
        } else {
            alert("تم تسجيل العملية بنجاح");
        }
    };

    const handleUpdateBalance = async () => {
        if(!showEditBalanceModal) return;
        await set(ref(db, `leave_balances/${showEditBalanceModal.userId}`), showEditBalanceModal);
        setShowEditBalanceModal(null);
        alert("تم تحديث الرصيد بنجاح");
    };

    const handleExportExcel = () => {
        if (!exportStartDate || !exportEndDate) {
            return alert("يرجى تحديد فترة التقرير (من وإلى)");
        }
        if (new Date(exportStartDate) > new Date(exportEndDate)) {
            return alert("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
        }

        const startTS = new Date(exportStartDate);
        startTS.setHours(0,0,0,0);
        const endTS = new Date(exportEndDate);
        endTS.setHours(23,59,59,999);

        const getRandomTime = (startHour, startMin, endHour, endMin) => {
            const totalStartMins = startHour * 60 + startMin;
            const totalEndMins = endHour * 60 + endMin;
            const randomMins = Math.floor(Math.random() * (totalEndMins - totalStartMins + 1)) + totalStartMins;
            const h = Math.floor(randomMins / 60);
            const m = randomMins % 60;
            // Format to 12-hour AM/PM for better readability, or 24h as per requirement: (09:00 to 09:35)
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        };

        const generateRandomIn = () => getRandomTime(9, 0, 9, 35);
        const generateRandomOut = (userName = "") => {
            const lowerName = userName.toLowerCase();
            if (lowerName.includes('coordinator') || lowerName.includes('منسق')) {
                return getRandomTime(4, 45, 5, 15);
            } else if (lowerName.includes('usher') || lowerName.includes('أشر') || lowerName.includes('اشر')) {
                return getRandomTime(5, 45, 6, 15);
            }
            return getRandomTime(5, 45, 6, 15);
        };

        const weekdaysArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        
        let usersToExport = usersList;
        if (selectedEmployeeForExport !== 'all') {
            usersToExport = usersList.filter(u => u.key === selectedEmployeeForExport);
        }

        if(usersToExport.length === 0) return alert("لا توجد بيانات تطابق الاختيارات المختارة");

        const sheets: any[] = [];

        usersToExport.forEach(u => {
            const uBalance = balances[u.key!] || {};
            const weeklyDays = uBalance.weeklyDays || [];
            
            const aoa: any[][] = [];
            aoa.push([`${u.name} (${u.role || 'موظف'})`]);
            aoa.push(["اليوم", "التاريخ", "الحضور", "الانصراف", "ملاحظات"]);

            const userHistory = allHistory.filter(h => h.userId === u.key);
            const leaveDaysMap = new Map();
            userHistory.forEach(record => {
                const rDate = new Date(record.date);
                const rDays = Math.ceil(record.days);
                for (let i = 0; i < rDays; i++) {
                    const d = new Date(rDate);
                    d.setDate(d.getDate() + i);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const dStr = `${y}-${m}-${day}`;
                    leaveDaysMap.set(dStr, record);
                }
            });
            
            const monthlyLeaveCount: Record<string, number> = {}; 

            for (let d = new Date(startTS); d <= endTS; d.setDate(d.getDate() + 1)) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const dayNum = String(d.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${dayNum}`;
                
                const dayName = weekdaysArabic[d.getDay()];
                
                let cycleMonth = d.getMonth();
                let cycleYear = d.getFullYear();
                if (d.getDate() >= 21) {
                    cycleMonth += 1;
                    if (cycleMonth > 11) {
                        cycleMonth = 0;
                        cycleYear += 1;
                    }
                }
                const monthKey = `${cycleYear}-${cycleMonth}`;
                
                if (!monthlyLeaveCount[monthKey]) monthlyLeaveCount[monthKey] = 0;

                let attIn = "";
                let attOut = "";
                let notes = "";

                const leaveRecord = leaveDaysMap.get(dateStr);
                
                if (weeklyDays.includes(dayName)) {
                    attIn = "إجازة";
                    attOut = "أسبوعية";
                    notes = "";
                } else if (leaveRecord) {
                    const type = leaveRecord.type;
                    if (type === 'official') {
                        attIn = generateRandomIn();
                        attOut = generateRandomOut(u.name);
                        notes = "يوم إضافي";
                    } else if (type === 'penalty') {
                        attIn = "غياب";
                        attOut = "بإذن";
                        notes = `جزاء خصم ${leaveRecord.days} يوم`;
                    } else if (type === 'unpaid') {
                        attIn = "غياب";
                        attOut = "بإذن";
                        notes = "تخصم من الراتب";
                    } else if (type === 'summer') {
                        attIn = "إجازة";
                        attOut = "سنوي";
                        notes = "إجازة مصيف";
                    } else if (type === 'casual') {
                        monthlyLeaveCount[monthKey]++;
                        // Check if casual balance is exhausted and annual is exhausted
                        let isSalaryDeduction = false;
                        if (monthlyLeaveCount[monthKey] > 2) {
                            isSalaryDeduction = true; // Exceeded monthly casual limit
                        }
                        
                        // User requested: "وفي حاله انهاء رصيد العارضه وانتهاء رصيد السنوي يتم ظهور في خانه الملاحظات في الاكسيل تخصم من الراتب"
                        // Since we just have the current balance, we can check it
                        const casualBal = Number(uBalance.casual || 0);
                        const annualBal = Number(uBalance.annual || 0);
                        if (casualBal <= 0 && annualBal <= 0) {
                            isSalaryDeduction = true;
                        }

                        if (isSalaryDeduction) {
                            attIn = "غياب";
                            attOut = "بإذن";
                            notes = "تخصم من الراتب";
                        } else {
                            attIn = "إجازة";
                            attOut = typeLabels[type] || "عارضة";
                            if (monthlyLeaveCount[monthKey] > 2 && annualBal > 0) {
                                notes = "تخصم من السنوي لتخطي العارضة";
                            } else if (casualBal <= 0 && annualBal > 0) {
                                notes = "تخصم من السنوي لانتهاء العارضة";
                            }
                        }
                    } else if (type === 'annual' || type === 'custom') {
                        const annualBal = Number(uBalance.annual || 0);
                        if (annualBal <= 0) {
                            attIn = "غياب";
                            attOut = "بإذن";
                            notes = "تخصم من الراتب لانتهاء السنوي";
                        } else {
                            attIn = "إجازة";
                            attOut = typeLabels[type] || leaveRecord.customLabel || "سنوي";
                        }
                    } else {
                        attIn = "إجازة";
                        attOut = typeLabels[type] || type;
                    }
                } else {
                    attIn = generateRandomIn();
                    attOut = generateRandomOut(u.name);
                }

                aoa.push([dayName, d.toLocaleDateString('en-US'), attIn, attOut, notes]);
            }
            
            sheets.push({
                name: (u.name || 'موظف').substring(0, 31),
                data: aoa,
                isAoa: true
            });
        });

        exportToExcel(sheets, `التقرير_الشامل_للموارد_البشرية_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}`);
        setShowExportModal(false);
    };

    const displayedUsers = user.role === 'admin' 
        ? usersList 
        : usersList.filter(u => u.name === user.name);

    const handleSaveWeekly = async () => {
        if (!weeklyUser || !weeklyDay) return alert("اكمل البيانات");
        const balanceRef = ref(db, `leave_balances/${weeklyUser}`);
        const snap = await get(balanceRef);
        let cur = snap.exists() ? snap.val() : { userId: weeklyUser, annual: 21, casual: 7, sick: 0, exams: 0, unpaid: 0 };
        
        const days = cur.weeklyDays || [];
        if (!days.includes(weeklyDay)) {
            days.push(weeklyDay);
        }
        cur.weeklyDays = days;
        await set(balanceRef, cur);
        alert("تم حفظ الإجازة الأسبوعية للحساب");
        setShowWeeklyModal(false);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                    <History className="text-blue-500" /> رصيد الإجازات والغياب
                </h2>
                {user.role === 'admin' && (
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setShowExportModal(true)} 
                            className="bg-green-600 text-white px-5 py-2.5 rounded-2xl font-bold shadow-xl flex items-center gap-2 active:scale-95 transition"
                        >
                            <FileSpreadsheet size={18} /> تصدير ملف إكسيل
                        </button>
                        <button 
                            onClick={() => setShowAddLeaveModal(true)} 
                            className="bg-red-600 text-white px-5 py-2.5 rounded-2xl font-bold shadow-xl flex items-center gap-2 active:scale-95 transition"
                        >
                            <CalendarPlus size={18} /> تسجيل إجازة/غياب
                        </button>
                        {user.role === 'admin' && (
<button onClick={() => setShowWeeklyModal(true)} className="bg-purple-600 text-white px-5 py-2.5 rounded-2xl font-bold shadow-xl flex items-center gap-2 active:scale-95 transition"><CalendarPlus size={18} /> إجازات أسبوعية</button>
)}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayedUsers.map(u => {
                    const balance = balances[u.key!] || {
                        userId: u.key!,
                        employeeName: u.name,
                        annual: 21,
                        casual: 7,
                        sick: 0,
                        exams: 0,
                        unpaid: 0
                    };

                    return (
                        <div key={u.key} className="p-5 rounded-3xl border border-white/10 bg-gray-800 text-white shadow-xl relative overflow-hidden">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <div className="font-bold text-lg text-blue-400">{u.name}</div>
                                    <div className="text-[10px] opacity-40">@{u.username}</div>
                                </div>
                                <div className="flex gap-1">
                                    {user.role === 'admin' && (
                                        <>
                                            <button 
                                                onClick={() => setShowEditBalanceModal(balance)} 
                                                className="p-1.5 bg-white/5 hover:bg-blue-600/20 text-blue-400 rounded-lg transition"
                                                title="تعديل الرصيد"
                                            >
                                                <Edit size={14}/>
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteEmployeeData(u.key!, u.name)} 
                                                className="p-1.5 bg-white/5 hover:bg-red-600/20 text-red-400 rounded-lg transition"
                                                title="حذف البيانات"
                                            >
                                                <Trash2 size={14}/>
                                            </button>
                                        </>
                                    )}
                                    <button 
                                        onClick={() => { setHistoryUserView({userId: u.key!, name: u.name}); setShowHistoryDetailsModal(true); }} 
                                        className="text-[10px] font-bold bg-white/5 px-3 py-1.5 rounded-xl hover:bg-white/10 transition"
                                    >
                                        عرض السجل
                                    </button>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                {Object.entries(typeLabels).map(([key, label]) => {
                                    if (key === 'custom' || key === 'official') return null;
                                    const val = (balance as any)[key] || 0;
                                    
                                    return (
                                        <div key={key} className="p-3 bg-black/20 rounded-2xl border border-white/5 flex flex-col items-center relative">
                                            <span className="text-[10px] opacity-50 font-black uppercase text-white text-center h-6 leading-3">{label as string}</span>
                                            <span className={`text-xl font-black ${typeColors[key as keyof typeof typeColors]}`}>{val}</span>
                                            
                                        </div>
                                    );
                                })}
                                
                                {(() => {
                                    const pStart = new Date(periodDate);
                                    pStart.setHours(0,0,0,0);
                                    const pEnd = getPeriodEnd(periodDate);
                                    pEnd.setHours(23,59,59,999);
                                    const currentCustom = allHistory.filter(h => h.userId === u.key && (h.type === 'custom') && new Date(h.date) >= pStart && new Date(h.date) <= pEnd);
                                    
                                    const groups: Record<string, number> = {};
                                    currentCustom.forEach(c => {
                                        const lbl = c.customLabel || 'إجازة مخصصة';
                                        groups[lbl] = (groups[lbl] || 0) + c.days;
                                    });

                                    return Object.entries(groups).map(([lbl, days]) => (
                                        <div key={'custom_'+lbl} className="p-3 bg-cyan-900/20 rounded-2xl border border-cyan-500/20 flex flex-col items-center">
                                            <span className="text-[10px] opacity-70 font-black uppercase text-cyan-200 text-center h-6 leading-3">{lbl}</span>
                                            <span className="text-xl font-black text-cyan-400">{days}</span>
                                        </div>
                                    ));
                                })()}
                                

                                {(() => {
                                    const pStart = new Date(periodDate);
                                    pStart.setHours(0,0,0,0);
                                    const pEnd = getPeriodEnd(periodDate);
                                    pEnd.setHours(23,59,59,999);
                                    const currentCasual = allHistory.filter(h => h.userId === u.key && h.type === 'casual' && new Date(h.date) >= pStart && new Date(h.date) <= pEnd);
                                    if (currentCasual.length === 0) return null;
                                    const casualDays = currentCasual.reduce((sum, h) => sum + h.days, 0);
                                    return (
                                        <div className="col-span-2 p-2 bg-yellow-900/20 rounded-xl border border-yellow-500/20 text-center mt-1">
                                            <span className="text-[10px] text-yellow-300 font-bold">المسجل عارضة هذا الشهر: {casualDays} يوم</span>
                                        </div>
                                    );
                                })()}

                                {balance.weeklyDays && balance.weeklyDays.length > 0 && (
                                    <div className="col-span-2 p-2 bg-purple-900/20 rounded-xl border border-purple-500/20 text-center mt-1">
                                        <span className="text-[10px] text-purple-300 font-bold">إجازة أسبوعية: {balance.weeklyDays.join('، ')}</span>
                                    </div>
                                )}
                                {(() => {
                                    const pStart = new Date(periodDate);
                                    pStart.setHours(0,0,0,0);
                                    const pEnd = getPeriodEnd(periodDate);
                                    pEnd.setHours(23,59,59,999);
                                    const currentOfficial = allHistory.filter(h => h.userId === u.key && h.type === 'official' && new Date(h.date) >= pStart && new Date(h.date) <= pEnd);
                                    const officialGroups: Record<string, number> = {};
                                    currentOfficial.forEach(c => {
                                        const lbl = c.customLabel || 'إجازة رسمية';
                                        officialGroups[lbl] = (officialGroups[lbl] || 0) + c.days;
                                    });
                                    if (Object.keys(officialGroups).length === 0) return null;
                                    return (
                                        <div className="col-span-2 flex flex-col gap-1 mt-1">
                                            {Object.entries(officialGroups).map(([lbl, days]) => (
                                                <div key={'official_'+lbl} className="p-2 bg-blue-900/20 rounded-xl border border-blue-500/20 text-center">
                                                    <span className="text-[10px] text-blue-300 font-bold">{lbl} ({days} يوم)</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {(() => {
                                    const pStart = new Date(periodDate);
                                    pStart.setHours(0,0,0,0);
                                    const pEnd = getPeriodEnd(periodDate);
                                    pEnd.setHours(23,59,59,999);
                                    const currentPenalty = allHistory.filter(h => h.userId === u.key && h.type === 'penalty' && new Date(h.date) >= pStart && new Date(h.date) <= pEnd);
                                    if (currentPenalty.length === 0) return null;
                                    return (
                                        <div className="col-span-2 flex flex-col gap-1 mt-1">
                                            {currentPenalty.map(p => (
                                                <div key={'penalty_'+p.id} className="p-2 bg-red-900/20 rounded-xl border border-red-500/20 text-center flex justify-between px-4">
                                                    <span className="text-[10px] text-red-300 font-bold">جزاء ({p.date})</span>
                                                    <span className="text-[10px] text-red-300 font-bold">{p.days} يوم</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}

                                {(() => {
                                    const pStart = new Date(periodDate);
                                    pStart.setHours(0,0,0,0);
                                    const pEnd = getPeriodEnd(periodDate);
                                    pEnd.setHours(23,59,59,999);
                                    const currentSummer = allHistory.filter(h => h.userId === u.key && h.type === 'summer' && new Date(h.date) >= pStart && new Date(h.date) <= pEnd);
                                    if (currentSummer.length === 0) return null;
                                    return (
                                        <div className="col-span-2 flex flex-col gap-1 mt-1">
                                            {currentSummer.map(p => (
                                                <div key={'summer_'+p.id} className="p-2 bg-teal-900/20 rounded-xl border border-teal-500/20 text-center flex justify-between px-4">
                                                    <span className="text-[10px] text-teal-300 font-bold">إجازة مصيف ({p.date})</span>
                                                    {p.deductedFromAnnual !== false ? (
                                                        <span className="text-[10px] text-teal-300 font-bold">مخصوم {p.days} يوم من السنوي</span>
                                                    ) : (
                                                        <span className="text-[10px] text-teal-300 font-bold">{p.days} يوم</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })()}

                            </div>
                        </div>
                    );
                })}
            </div>

            {/* مودال التاريخ والسجل */}
            {showHistoryDetailsModal && historyUserView && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="w-full max-w-2xl p-6 rounded-3xl border border-white/10 bg-gray-900 text-white flex flex-col max-h-[90vh] shadow-2xl animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-2">
                                <UserIcon className="text-blue-500" size={20}/>
                                <h3 className="text-xl font-bold text-white">{historyUserView.name}</h3>
                            </div>
                            <button onClick={() => setShowHistoryDetailsModal(false)} className="p-2 hover:bg-white/10 rounded-full text-white"><X/></button>
                        </div>
                        
                        <div className="flex items-center justify-between bg-black/30 p-4 rounded-2xl border border-white/5 mb-6">
                            <button onClick={() => changePeriod(-1)} className="p-2 bg-white/5 rounded-full hover:bg-blue-600 transition"><ChevronRight size={20}/></button>
                            <div className="text-center">
                                <div className="text-[10px] font-black opacity-40 uppercase tracking-widest mb-1">دورة الشهر المختارة</div>
                                <div className="text-sm font-bold flex items-center gap-2">
                                    <CalendarIcon size={16} className="text-blue-500"/>
                                    {periodDate.toLocaleDateString('en-GB', {day: 'numeric', month: 'numeric', year: 'numeric'})} 
                                    <span className="opacity-40 px-2">إلى</span>
                                    {getPeriodEnd(periodDate).toLocaleDateString('en-GB', {day: 'numeric', month: 'numeric', year: 'numeric'})}
                                </div>
                            </div>
                            <button onClick={() => changePeriod(1)} className="p-2 bg-white/5 rounded-full hover:bg-blue-600 transition"><ChevronLeft size={20}/></button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
                            {filterHistoryByPeriodAndUser(historyUserView.userId).length === 0 ? (
                                <div className="text-center py-20 opacity-30 italic text-sm">لا توجد سجلات في هذه الفترة</div>
                            ) : (
                                filterHistoryByPeriodAndUser(historyUserView.userId).map(rec => (
                                    <div key={rec.id} className="p-4 rounded-2xl border bg-black/20 border-white/5 flex justify-between items-center group hover:border-white/20 transition">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl bg-white/5 ${typeColors[rec.type]}`}><CheckCircle2 size={18} /></div>
                                            <div>
                                                <div className="font-bold text-sm text-white">{rec.customLabel ? `${typeLabels[rec.type]} - ${rec.customLabel}` : typeLabels[rec.type]}</div>
                                                <div className="text-[10px] opacity-50 text-white">{rec.date}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="font-black text-lg text-white">{rec.days} يوم</div>
                                            {user.role === 'admin' && (
                                                <div className="flex gap-1">
                                                    <button onClick={() => handleDeleteRecord(rec.id, rec)} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition"><Trash2 size={16}/></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* مودال تصدير إكسيل */}
            {showExportModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="bg-gray-900 border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><FileSpreadsheet className="text-green-500"/> تصدير التقارير</h3>
                            <button onClick={() => setShowExportModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold mb-2 opacity-60 text-white uppercase tracking-widest">اختر الموظف</label>
                                <select 
                                    className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold outline-none"
                                    value={selectedEmployeeForExport}
                                    onChange={(e) => setSelectedEmployeeForExport(e.target.value)}
                                >
                                    <option value="all">طباعة الكل (تقرير شامل)</option>
                                    {usersList.map(u => (
                                        <option key={u.key} value={u.key}>{u.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold mb-2 opacity-60 text-white">من</label>
                                    <input 
                                        type="date"
                                        className="w-full p-3 rounded-xl bg-gray-700 text-white border border-white/10 font-bold"
                                        value={exportStartDate}
                                        onChange={(e) => setExportStartDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-2 opacity-60 text-white">إلى</label>
                                    <input 
                                        type="date"
                                        className="w-full p-3 rounded-xl bg-gray-700 text-white border border-white/10 font-bold"
                                        value={exportEndDate}
                                        onChange={(e) => setExportEndDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleExportExcel}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition shadow-xl active:scale-95 mt-4"
                            >
                                <Printer size={20}/> 
                                {selectedEmployeeForExport === 'all' ? 'تحميل التقرير الشامل' : 'طباعة إجازات الموظف المختار'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* مودال تعديل الرصيد (Admin Only) */}
            {showEditBalanceModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="bg-gray-900 border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><Edit className="text-blue-500"/> تعديل رصيد: {showEditBalanceModal.employeeName}</h3>
                            <button onClick={() => setShowEditBalanceModal(null)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {Object.entries(typeLabels).map(([key, label]) => (
                                <div key={key}>
                                    <label className="block text-[10px] font-bold opacity-40 mb-1">{label}</label>
                                    <input 
                                        type="number"
                                        className="w-full p-3 rounded-xl bg-gray-700 text-white border border-white/10 text-center font-black"
                                        value={(showEditBalanceModal as any)[key] || 0}
                                        onChange={(e) => setShowEditBalanceModal({...showEditBalanceModal, [key]: Number(e.target.value)})}
                                    />
                                </div>
                            ))}
                        </div>
                        <button 
                            onClick={handleUpdateBalance}
                            className="w-full mt-6 bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2 active:scale-95 transition"
                        >
                            <Save size={20}/> حفظ التعديلات
                        </button>
                    </div>
                </div>
            )}

            {/* مودال الإضافة (للآدمن فقط) */}
            {showAddLeaveModal && user.role === 'admin' && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="w-full max-w-md p-6 rounded-3xl border border-white/10 bg-gray-900 text-white shadow-2xl animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">تسجيل إجازة / غياب</h3>
                            <button onClick={() => setShowAddLeaveModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold mb-1 opacity-60 text-white">الموظف</label>
                                <select 
                                    className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold outline-none" 
                                    value={selectedUser} 
                                    onChange={e => setSelectedUser(e.target.value)}
                                >
                                    <option value="">-- اختر الموظف --</option>
                                    {usersList.map(u => <option key={u.key} value={u.key}>{u.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1 opacity-60 text-white">التاريخ</label>
                                <input type="date" className="w-full p-4 rounded-2xl bg-gray-700 text-white border border-white/10" value={leaveDate} onChange={e => setLeaveDate(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {leaveType !== 'official' && (
                                    <div>
                                        <label className="block text-xs font-bold mb-1 opacity-60 text-white">عدد الأيام</label>
                                        <input type="number" min="0.5" step="0.5" className="w-full p-4 rounded-2xl bg-gray-700 text-white border border-white/10 text-center font-black" value={leaveDays} onChange={e => setLeaveDays(parseFloat(e.target.value))} max={leaveType === 'penalty' ? 30 : undefined} />
                                    </div>
                                )}
                                <div className={leaveType === 'official' ? 'col-span-2' : ''}>
                                    <label className="block text-xs font-bold mb-1 opacity-60 text-white">النوع</label>
                                    <div className="flex gap-2">
                                        <select 
                                            className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold outline-none" 
                                            value={leaveType} 
                                            onChange={e => {
                                                setLeaveType(e.target.value as any);
                                                if (e.target.value === 'official' && leaveDays < 1) setLeaveDays(1);
                                            }}
                                        >
                                            {Object.entries(typeLabels).map(([k,v]) => <option key={k} value={k as string}>{v as string}</option>)}
                                        </select>
                                        <button 
                                            type="button" 
                                            onClick={() => setLeaveType('custom')}
                                            className="bg-blue-600/30 text-blue-400 p-4 rounded-2xl hover:bg-blue-600/50 transition font-bold"
                                            title="نوع مخصص"
                                        >+</button>
                                    </div>
                                </div>
                            </div>
                            
                            {leaveType === 'custom' && (
                                <div>
                                    <label className="block text-xs font-bold mb-1 opacity-60 text-white">اسم الإجازة المخصصة (تخصم من السنوي)</label>
                                    <input type="text" className="w-full p-4 rounded-2xl bg-gray-700 text-white border border-white/10" value={customLeaveName} onChange={e => setCustomLeaveName(e.target.value)} placeholder="اكتب نوع الإجازة هنا..." />
                                </div>
                            )}

                            {leaveType === 'official' && (
                                <div>
                                    <label className="block text-xs font-bold mb-1 opacity-60 text-white">المناسبة</label>
                                    <input type="text" className="w-full p-4 rounded-2xl bg-gray-700 text-white border border-white/10" value={officialOccasion} onChange={e => setOfficialOccasion(e.target.value)} placeholder="مثال: عيد الفطر" />
                                </div>
                            )}
                            <button onClick={handleAddLeave} className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2 mt-4">
                                <Save size={20}/> حفظ الإجازة
                            </button>
                        </div>
                    </div>
                </div>
            )}
        
            {showWeeklyModal && user.role === 'admin' && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="w-full max-w-md p-6 rounded-3xl border border-white/10 bg-gray-900 text-white shadow-2xl animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">تسجيل إجازات أسبوعية</h3>
                            <button onClick={() => setShowWeeklyModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold mb-1 opacity-60 text-white">الموظف</label>
                                <select 
                                    className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold outline-none" 
                                    value={weeklyUser} 
                                    onChange={e => setWeeklyUser(e.target.value)}
                                >
                                    <option value="">-- اختر الموظف --</option>
                                    {usersList.filter(u => u.role !== 'admin').map(u => <option key={u.key} value={u.key}>{u.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1 opacity-60 text-white">اليوم</label>
                                <select 
                                    className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold outline-none" 
                                    value={weeklyDay} 
                                    onChange={e => setWeeklyDay(e.target.value)}
                                >
                                    <option value="">-- اختر اليوم --</option>
                                    {['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <button onClick={handleSaveWeekly} className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2 mt-4">
                                <Save size={20}/> حفظ الإعداد
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default LeaveBalanceComponent;
