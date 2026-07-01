
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, set, push, remove, update, get } from "firebase/database";
import { User, LeaveBalance, LeaveRecord } from '../types';
import { 
    Trash2, Edit, CalendarPlus, X, Save, History, 
    ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Calendar as CalendarIcon,
    User as UserIcon, FileSpreadsheet, Printer
} from 'lucide-react';
import { exportToCSV } from '../utils';

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

    // نوع البيانات: "remaining" (يتم الطرح) أو "accrued" (يتم الجمع كعداد)
    const typeLogic = { annual: 'remaining', casual: 'remaining', sick: 'accrued', exams: 'accrued', unpaid: 'accrued' };
    const typeLabels = { annual: 'سنوي', casual: 'عارضة', sick: 'مرضي', exams: 'امتحانات', unpaid: 'غياب بأذن' };
    const typeColors = { annual: 'text-green-400', casual: 'text-yellow-400', sick: 'text-red-400', exams: 'text-purple-400', unpaid: 'text-orange-400' };

    useEffect(() => {
        onValue(ref(db, 'users'), snapshot => {
            if (snapshot.exists()) {
                const u: User[] = [];
                snapshot.forEach(c => { u.push({ key: c.key!, ...c.val() }); });
                setUsersList(u);
            }
        });
        
        onValue(ref(db, 'leave_balances'), snapshot => {
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
        
        onValue(ref(db, 'leave_history'), snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const h: any = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                setAllHistory(h);
            } else { setAllHistory([]); }
        });
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
        if (!selectedUser || !leaveDate) return alert("اكمل البيانات");
        const isDuplicate = allHistory.some(r => r.userId === selectedUser && r.date === leaveDate);
        if (isDuplicate) return alert("تم تسجيل هذا اليوم مسبقاً لهذا الموظف");

        const targetUser = usersList.find(u => u.key === selectedUser);
        if (!targetUser) return;

        const balanceRef = ref(db, `leave_balances/${selectedUser}`);
        const snap = await get(balanceRef);
        let cur = snap.exists() ? snap.val() : { userId: selectedUser, employeeName: targetUser.name, annual: 21, casual: 7, sick: 0, exams: 0, unpaid: 0 };
        
        // منطق الحساب الجديد
        let newValue;
        if (typeLogic[leaveType] === 'remaining') {
            newValue = Number(cur[leaveType] || 0) - Number(leaveDays);
        } else {
            newValue = Number(cur[leaveType] || 0) + Number(leaveDays);
        }

        const newVal = { ...cur, [leaveType]: newValue };
        await set(balanceRef, newVal);
        await push(ref(db, 'leave_history'), { userId: selectedUser, employeeName: targetUser.name, date: leaveDate, days: Number(leaveDays), type: leaveType, timestamp: new Date(leaveDate).getTime() });
        
        setShowAddLeaveModal(false);
        alert("تم تسجيل العملية بنجاح");
    };

    const handleUpdateBalance = async () => {
        if(!showEditBalanceModal) return;
        await set(ref(db, `leave_balances/${showEditBalanceModal.userId}`), showEditBalanceModal);
        setShowEditBalanceModal(null);
        alert("تم تحديث الرصيد بنجاح");
    };

    const handleExportExcel = () => {
        if (exportStartDate && exportEndDate && new Date(exportStartDate) > new Date(exportEndDate)) {
            return alert("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
        }

        let filtered = allHistory;

        if (selectedEmployeeForExport !== 'all') {
            filtered = filtered.filter(h => h.userId === selectedEmployeeForExport);
        }

        if (exportStartDate) {
            const startTS = new Date(exportStartDate).setHours(0,0,0,0);
            filtered = filtered.filter(h => new Date(h.date).getTime() >= startTS);
        }
        if (exportEndDate) {
            const endTS = new Date(exportEndDate).setHours(23,59,59,999);
            filtered = filtered.filter(h => new Date(h.date).getTime() <= endTS);
        }

        if(filtered.length === 0) return alert("لا توجد بيانات تطابق الاختيارات المختارة");

        const exportData = filtered.map(h => ({
            "اسم الموظف": h.employeeName,
            "تاريخ العملية": h.date,
            "النوع": typeLabels[h.type],
            "عدد الأيام": h.days
        }));

        exportToCSV(exportData, `Leave_Report_${selectedEmployeeForExport === 'all' ? 'All' : 'Employee'}`);
        setShowExportModal(false);
    };

    const displayedUsers = user.role === 'admin' 
        ? usersList 
        : usersList.filter(u => u.name === user.name);

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
                                    const val = (balance as any)[key] || 0;
                                    return (
                                        <div key={key} className="p-3 bg-black/20 rounded-2xl border border-white/5 flex flex-col items-center">
                                            <span className="text-[10px] opacity-50 font-black uppercase text-white text-center h-6 leading-3">{label}</span>
                                            <span className={`text-xl font-black ${typeColors[key as keyof typeof typeColors]}`}>{val}</span>
                                        </div>
                                    );
                                })}
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
                                                <div className="font-bold text-sm text-white">{typeLabels[rec.type]}</div>
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
                                        value={(showEditBalanceModal as any)[key]}
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
                                <div>
                                    <label className="block text-xs font-bold mb-1 opacity-60 text-white">عدد الأيام</label>
                                    <input type="number" min="0.5" step="0.5" className="w-full p-4 rounded-2xl bg-gray-700 text-white border border-white/10 text-center font-black" value={leaveDays} onChange={e => setLeaveDays(parseFloat(e.target.value))} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1 opacity-60 text-white">النوع</label>
                                    <select 
                                        className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold outline-none" 
                                        value={leaveType} 
                                        onChange={e => setLeaveType(e.target.value as any)}
                                    >
                                        {Object.entries(typeLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button onClick={handleAddLeave} className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2 mt-4">
                                <Save size={20}/> حفظ الإجازة
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaveBalanceComponent;
