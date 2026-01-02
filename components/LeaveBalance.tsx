
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, set, push, remove, update, get } from "firebase/database";
import { User, LeaveBalance, LeaveRecord } from '../types';
import { 
    Trash2, Edit, CalendarPlus, X, Save, History, 
    ChevronRight, ChevronLeft, Calendar, 
    CheckCircle2, AlertCircle, Clock, Filter
} from 'lucide-react';

interface Props {
    user: User;
    theme: string;
}

const LeaveBalanceComponent: React.FC<Props> = ({ user, theme }) => {
    const [balances, setBalances] = useState<LeaveBalance[]>([]);
    const [usersList, setUsersList] = useState<{key: string, name: string}[]>([]);
    const [allHistory, setAllHistory] = useState<{id: string} & LeaveRecord[]>([]);
    
    // Modal States
    const [showAddLeaveModal, setShowAddLeaveModal] = useState(false);
    const [showEditBalanceModal, setShowEditBalanceModal] = useState(false);
    const [showHistoryDetailsModal, setShowHistoryDetailsModal] = useState(false);
    const [showEditRecordModal, setShowEditRecordModal] = useState(false);
    
    // Period Control State (21 to 20)
    const [currentPeriodStart, setCurrentPeriodStart] = useState<Date>(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        return now.getDate() >= 21 ? new Date(year, month, 21) : new Date(year, month - 1, 21);
    });

    // Form States
    const [selectedUser, setSelectedUser] = useState('');
    const [leaveDate, setLeaveDate] = useState('');
    const [leaveDays, setLeaveDays] = useState(1);
    const [leaveType, setLeaveType] = useState<'annual' | 'casual' | 'sick' | 'exams' | 'unpaid'>('annual');
    const [editingBalance, setEditingBalance] = useState<LeaveBalance | null>(null);
    const [historyUserView, setHistoryUserView] = useState<{userId: string, name: string} | null>(null);
    const [editingRecord, setEditingRecord] = useState<{id: string} & LeaveRecord | null>(null);

    // Load Data
    useEffect(() => {
        onValue(ref(db, 'users'), snapshot => {
            if (snapshot.exists()) {
                const u: any[] = [];
                snapshot.forEach(c => { u.push({ key: c.key, name: c.val().name }); });
                setUsersList(u);
            }
        });

        onValue(ref(db, 'leave_balances'), snapshot => {
            if (snapshot.exists()) {
                const b: LeaveBalance[] = Object.values(snapshot.val());
                setBalances(user.role === 'admin' ? b : b.filter(x => x.employeeName === user.name));
            } else { setBalances([]); }
        });

        onValue(ref(db, 'leave_history'), snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const h: any = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                setAllHistory(h);
            } else { setAllHistory([]); }
        });
    }, [user]);

    // Auto-select logged-in user when modal opens if found in list
    useEffect(() => {
        if (showAddLeaveModal) {
            if (user.role === 'admin') {
                setSelectedUser(''); // Reset for admin to pick
            } else {
                const currentUserInList = usersList.find(u => u.name === user.name);
                if (currentUserInList) {
                    setSelectedUser(currentUserInList.key);
                }
            }
        }
    }, [showAddLeaveModal, usersList, user.name, user.role]);

    // Period Logic
    const getPeriodEnd = (start: Date) => {
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        end.setDate(20);
        return end;
    };

    const changePeriod = (direction: number) => {
        const newStart = new Date(currentPeriodStart);
        newStart.setMonth(newStart.getMonth() + direction);
        setCurrentPeriodStart(newStart);
    };

    const filterHistoryByPeriodAndUser = (userId: string) => {
        const pStart = new Date(currentPeriodStart);
        pStart.setHours(0,0,0,0);
        const pEnd = getPeriodEnd(currentPeriodStart);
        pEnd.setHours(23,59,59,999);

        return allHistory.filter((record: any) => {
            const recordDate = new Date(record.date);
            return record.userId === userId && recordDate >= pStart && recordDate <= pEnd;
        });
    };

    const handleAddLeave = async () => {
        if (!selectedUser || !leaveDate || leaveDays <= 0) return alert("يرجى اكمال البيانات");
        const targetUser = usersList.find(u => u.key === selectedUser);
        if (!targetUser) return;

        const balanceRef = ref(db, `leave_balances/${selectedUser}`);
        let currentBalance: LeaveBalance = balances.find(b => b.userId === selectedUser) || {
            userId: selectedUser, employeeName: targetUser.name,
            annual: 21, casual: 7, sick: 0, exams: 0, unpaid: 0
        };

        const newBalance = { ...currentBalance, [leaveType]: Number(currentBalance[leaveType] || 0) - Number(leaveDays) };
        await set(balanceRef, newBalance);

        const historyData: LeaveRecord = {
            userId: selectedUser, employeeName: targetUser.name,
            date: leaveDate, days: Number(leaveDays), type: leaveType, timestamp: Date.now()
        };
        await push(ref(db, 'leave_history'), historyData);

        alert("تم تسجيل الاجازة وخصم الرصيد");
        setShowAddLeaveModal(false);
        setLeaveDate('');
    };

    const handleEditBalance = async () => {
        if (user.role !== 'admin') return;
        if (!editingBalance) return;
        await set(ref(db, `leave_balances/${editingBalance.userId}`), editingBalance);
        setShowEditBalanceModal(false);
        setEditingBalance(null);
    };

    const handleDeleteBalance = async (userId: string) => {
        if (user.role !== 'admin') return alert("عذراً، لا تملك صلاحية الحذف");
        if (confirm("هل تريد حذف رصيد هذا الموظف بالكامل؟ لن يؤثر هذا على سجل التاريخ.")) {
            await remove(ref(db, `leave_balances/${userId}`));
        }
    };

    const handleDeleteRecord = async (recordId: string) => {
        if (user.role !== 'admin') return alert("عذراً، لا تملك صلاحية الحذف");
        const record = allHistory.find(r => r.id === recordId);
        if (!record) return;

        if (confirm("هل تريد حذف هذا السجل؟ سيتم إعادة الأيام المخصومة لرصيد الموظف تلقائياً.")) {
            // Refund balance logic
            const balanceRef = ref(db, `leave_balances/${record.userId}`);
            const balanceSnap = await get(balanceRef);
            if (balanceSnap.exists()) {
                const currentBal = balanceSnap.val();
                const updatedBal = { 
                    ...currentBal, 
                    [record.type]: Number(currentBal[record.type] || 0) + Number(record.days) 
                };
                await set(balanceRef, updatedBal);
            }

            await remove(ref(db, `leave_history/${recordId}`));
            alert("تم حذف السجل وإعادة الرصيد للموظف.");
        }
    };

    const handleUpdateRecord = async () => {
        if (!editingRecord || user.role !== 'admin') return;
        
        const originalRecord = allHistory.find(r => r.id === editingRecord.id);
        if (!originalRecord) return;

        try {
            // Adjust balance if days changed
            if (originalRecord.days !== editingRecord.days || originalRecord.type !== editingRecord.type) {
                const balanceRef = ref(db, `leave_balances/${editingRecord.userId}`);
                const balanceSnap = await get(balanceRef);
                
                if (balanceSnap.exists()) {
                    let currentBal = balanceSnap.val();
                    
                    // 1. Refund old amount
                    currentBal[originalRecord.type] = Number(currentBal[originalRecord.type] || 0) + Number(originalRecord.days);
                    
                    // 2. Subtract new amount
                    currentBal[editingRecord.type] = Number(currentBal[editingRecord.type] || 0) - Number(editingRecord.days);
                    
                    await set(balanceRef, currentBal);
                }
            }

            const { id, ...recordData } = editingRecord;
            await update(ref(db, `leave_history/${id}`), recordData);
            
            alert("تم تعديل السجل وتحديث رصيد الموظف في الحال.");
            setShowEditRecordModal(false);
        } catch (error) {
            console.error(error);
            alert("حدث خطأ أثناء التحديث");
        }
    };

    const openHistory = (userId: string, name: string) => {
        setHistoryUserView({ userId, name });
        setShowHistoryDetailsModal(true);
    };

    const inputClass = "border p-2.5 rounded-lg text-black w-full focus:ring-2 focus:ring-blue-500 outline-none transition";
    const modalClass = `fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md`;
    const modalContentClass = `w-full max-w-2xl p-6 rounded-2xl shadow-2xl border ${theme === 'dark' ? 'bg-gray-900 text-white border-gray-800' : 'bg-white text-black border-gray-100'}`;

    const typeLabels = { annual: 'سنوي', casual: 'عارضة', sick: 'مرضي', exams: 'امتحانات', unpaid: 'غياب بإذن' };
    const typeColors = { 
        annual: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        casual: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        sick: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        exams: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
        unpaid: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <History className="text-blue-500" /> إدارة الإجازات
                </h2>
                <button 
                    onClick={() => setShowAddLeaveModal(true)}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 transition transform active:scale-95"
                >
                    <CalendarPlus size={20} /> تسجيل إجازة
                </button>
            </div>

            {/* Balances Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {balances.map((balance) => (
                    <div key={balance.userId} className={`p-5 rounded-2xl border ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100 shadow-md hover:shadow-xl transition-all duration-300'}`}>
                        <div className="flex justify-between items-start mb-4">
                            <div className="font-bold text-lg text-blue-600 truncate">{balance.employeeName}</div>
                            {user.role === 'admin' && (
                                <div className="flex gap-1">
                                    <button onClick={() => { setEditingBalance(balance); setShowEditBalanceModal(true); }} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg" title="تعديل الرصيد"><Edit size={16} /></button>
                                    <button onClick={() => handleDeleteBalance(balance.userId)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg" title="حذف الرصيد"><Trash2 size={16} /></button>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {Object.entries(typeLabels).map(([key, label]) => (
                                <button 
                                    key={key}
                                    onClick={() => openHistory(balance.userId, balance.employeeName)}
                                    className={`p-3 rounded-xl flex flex-col items-center transition-transform active:scale-95 ${typeColors[key as keyof typeof typeColors]}`}
                                >
                                    <span className="text-[10px] opacity-70 uppercase font-bold text-center">{label}</span>
                                    <span className="text-xl font-black">{(balance as any)[key] || 0}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal: History Details */}
            {showHistoryDetailsModal && historyUserView && (
                <div className={modalClass}>
                    <div className={`${modalContentClass} max-w-3xl overflow-hidden flex flex-col max-h-[90vh]`}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-blue-600 flex items-center gap-2">
                                <History size={24} /> سجل: {historyUserView.name}
                            </h3>
                            <button onClick={() => setShowHistoryDetailsModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"><X/></button>
                        </div>

                        {/* Period Toggle */}
                        <div className="bg-blue-600 text-white p-5 rounded-2xl shadow-lg mb-6 flex justify-between items-center">
                            <button onClick={() => changePeriod(-1)} className="p-2 hover:bg-white/20 rounded-xl transition"><ChevronRight size={20}/></button>
                            <div className="text-center">
                                <div className="text-[10px] opacity-70 font-bold uppercase tracking-widest mb-1 text-center">دورة الإجازات</div>
                                <div className="font-bold text-sm flex items-center gap-2">
                                    <Calendar size={14} />
                                    {currentPeriodStart.toLocaleDateString('ar-EG')} - {getPeriodEnd(currentPeriodStart).toLocaleDateString('ar-EG')}
                                </div>
                            </div>
                            <button onClick={() => changePeriod(1)} className="p-2 hover:bg-white/20 rounded-xl transition"><ChevronLeft size={20}/></button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar px-1 space-y-3">
                            {filterHistoryByPeriodAndUser(historyUserView.userId).length > 0 ? (
                                filterHistoryByPeriodAndUser(historyUserView.userId).map((rec: any) => (
                                    <div key={rec.id} className={`p-4 rounded-2xl border flex justify-between items-center ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-xl ${typeColors[rec.type as keyof typeof typeColors]}`}>
                                                <CheckCircle2 size={20} />
                                            </div>
                                            <div>
                                                <div className="font-bold text-sm">{typeLabels[rec.type as keyof typeof typeLabels]}</div>
                                                <div className="text-[10px] opacity-60 flex items-center gap-1"><Clock size={10}/> {rec.date}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="font-black text-lg">{rec.days}</div>
                                                <div className="text-[8px] opacity-50 uppercase text-center">يوم</div>
                                            </div>
                                            {user.role === 'admin' && (
                                                <div className="flex gap-1 border-r pr-3 border-gray-300 dark:border-gray-700">
                                                    <button onClick={() => { setEditingRecord(rec); setShowEditRecordModal(true); }} className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg" title="تعديل السجل"><Edit size={14} /></button>
                                                    <button onClick={() => handleDeleteRecord(rec.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="حذف السجل"><Trash2 size={14} /></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="py-12 text-center opacity-30 italic flex flex-col items-center">
                                    <AlertCircle size={40} className="mb-2" />
                                    <span>لا توجد سجلات في هذه الدورة</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Edit Record (ADMIN ONLY) */}
            {showEditRecordModal && editingRecord && user.role === 'admin' && (
                <div className={modalClass}>
                    <div className={modalContentClass}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-blue-600">تعديل سجل الإجازة</h3>
                            <button onClick={() => setShowEditRecordModal(false)}><X/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold mb-1 opacity-60">تاريخ الإجازة</label>
                                <input type="date" className={inputClass} value={editingRecord.date} onChange={e => setEditingRecord({...editingRecord, date: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold mb-1 opacity-60">عدد الأيام</label>
                                    <input type="number" step="0.5" className={inputClass} value={editingRecord.days} onChange={e => setEditingRecord({...editingRecord, days: Number(e.target.value)})} placeholder="عدد الأيام" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1 opacity-60">نوع الإجازة</label>
                                    <select className={inputClass} value={editingRecord.type} onChange={e => setEditingRecord({...editingRecord, type: e.target.value as any})}>
                                        {Object.entries(typeLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button onClick={handleUpdateRecord} className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2 transition active:scale-95">
                                <Save size={18}/> حفظ التعديلات فوراً
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Edit Balance (ADMIN ONLY) */}
            {showEditBalanceModal && editingBalance && user.role === 'admin' && (
                <div className={modalClass}>
                    <div className={modalContentClass}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-center">تعديل أرصدة: {editingBalance.employeeName}</h3>
                            <button onClick={() => setShowEditBalanceModal(false)}><X/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            {Object.entries(typeLabels).map(([key, label]) => (
                                <div key={key}>
                                    <label className="block text-xs font-bold mb-1 opacity-60 text-right">{label}</label>
                                    <input 
                                        type="number" 
                                        className={inputClass} 
                                        value={(editingBalance as any)[key] || 0}
                                        onChange={e => setEditingBalance({...editingBalance, [key]: Number(e.target.value)})}
                                    />
                                </div>
                            ))}
                        </div>
                        <button onClick={handleEditBalance} className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl shadow-lg flex items-center justify-center gap-2">
                            <Save size={18}/> حفظ الأرصدة
                        </button>
                    </div>
                </div>
            )}

            {/* Modal: Add Leave */}
            {showAddLeaveModal && (
                <div className={modalClass}>
                    <div className={modalContentClass}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2"><CalendarPlus /> تسجيل إجازة موظف</h3>
                            <button onClick={() => setShowAddLeaveModal(false)}><X/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold mb-1 opacity-60">اختيار الموظف</label>
                                <select className={inputClass} value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                                    <option value="">-- اختر الموظف --</option>
                                    {usersList
                                        .filter(u => user.role === 'admin' || u.name === user.name)
                                        .map(u => <option key={u.key} value={u.key}>{u.name}</option>)
                                    }
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1 opacity-60">التاريخ</label>
                                <input type="date" className={inputClass} value={leaveDate} onChange={e => setLeaveDate(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold mb-1 opacity-60">الأيام</label>
                                    <input type="number" min="0.5" step="0.5" className={inputClass} value={leaveDays} onChange={e => setLeaveDays(parseFloat(e.target.value))} placeholder="عدد الأيام" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-1 opacity-60">النوع</label>
                                    <select className={inputClass} value={leaveType} onChange={e => setLeaveType(e.target.value as any)}>
                                        {Object.entries(typeLabels).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                                    </select>
                                </div>
                            </div>
                            <button onClick={handleAddLeave} className="w-full bg-red-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-500/20 transition transform active:scale-95">تأكيد وتسجيل الخصم</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LeaveBalanceComponent;
