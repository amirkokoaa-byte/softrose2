import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, set, push, remove, update } from "firebase/database";
import { User, LeaveBalance, LeaveRecord } from '../types';
import { 
    Trash2, Edit, CalendarPlus, X, Save, History, 
    ChevronRight, ChevronLeft, Info, Calendar, 
    CheckCircle2, AlertCircle, Clock
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
        if (now.getDate() >= 21) {
            return new Date(year, month, 21);
        } else {
            return new Date(year, month - 1, 21);
        }
    });

    // Form States
    const [selectedUser, setSelectedUser] = useState('');
    const [leaveDate, setLeaveDate] = useState('');
    const [leaveDays, setLeaveDays] = useState(1);
    const [leaveType, setLeaveType] = useState<'annual' | 'casual' | 'sick' | 'exams'>('annual');
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
            } else {
                setBalances([]);
            }
        });

        onValue(ref(db, 'leave_history'), snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const h: any = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                setAllHistory(h);
            } else {
                setAllHistory([]);
            }
        });
    }, [user]);

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
        const periodEnd = getPeriodEnd(currentPeriodStart);
        // Normalize period dates for comparison (time at 00:00:00)
        const pStart = new Date(currentPeriodStart);
        pStart.setHours(0,0,0,0);
        const pEnd = new Date(periodEnd);
        pEnd.setHours(23,59,59,999);

        return allHistory.filter((record: any) => {
            const recordDate = new Date(record.date);
            return record.userId === userId && 
                   recordDate >= pStart && 
                   recordDate <= pEnd;
        });
    };

    const handleAddLeave = async () => {
        if (!selectedUser || !leaveDate || leaveDays <= 0) return alert("يرجى اكمال البيانات");
        const targetUser = usersList.find(u => u.key === selectedUser);
        if (!targetUser) return;

        const balanceRef = ref(db, `leave_balances/${selectedUser}`);
        let currentBalance: LeaveBalance = balances.find(b => b.userId === selectedUser) || {
            userId: selectedUser, employeeName: targetUser.name,
            annual: 21, casual: 7, sick: 0, exams: 0
        };

        if (currentBalance[leaveType] < leaveDays && leaveType !== 'sick' && leaveType !== 'exams') {
             if(!confirm(`الرصيد الحالي (${currentBalance[leaveType]}) أقل من المطلوب (${leaveDays}). هل تريد المتابعة بالسالب؟`)) return;
        }

        const newBalance = { ...currentBalance, [leaveType]: Number(currentBalance[leaveType]) - Number(leaveDays) };
        await set(balanceRef, newBalance);

        const historyData: LeaveRecord = {
            userId: selectedUser, employeeName: targetUser.name,
            date: leaveDate, days: Number(leaveDays), type: leaveType, timestamp: Date.now()
        };
        await push(ref(db, 'leave_history'), historyData);

        alert("تم تسجيل الاجازة وخصم الرصيد");
        setShowAddLeaveModal(false);
        setLeaveDays(1);
        setLeaveDate('');
    };

    const handleEditBalance = async () => {
        if (!editingBalance || user.role !== 'admin') return;
        await set(ref(db, `leave_balances/${editingBalance.userId}`), editingBalance);
        setShowEditBalanceModal(false);
        setEditingBalance(null);
    };

    const handleDeleteBalance = async (userId: string) => {
        if(user.role !== 'admin') return;
        if(confirm("هل أنت متأكد من حذف سجل أرصدة هذا الموظف نهائياً؟")) {
            await remove(ref(db, `leave_balances/${userId}`));
        }
    };

    const handleDeleteRecord = async (recordId: string) => {
        if(user.role !== 'admin') return;
        if(confirm("هل أنت متأكد من حذف هذه الإجازة؟ (لن يتم استعادة الرصيد تلقائياً، يجب تعديل الرصيد يدوياً)")) {
            await remove(ref(db, `leave_history/${recordId}`));
        }
    };

    const handleUpdateRecord = async () => {
        if(!editingRecord || user.role !== 'admin') return;
        const { id, ...recordData } = editingRecord;
        await update(ref(db, `leave_history/${id}`), recordData);
        alert("تم تحديث بيانات الإجازة بنجاح");
        setShowEditRecordModal(false);
        setEditingRecord(null);
    };

    const openHistory = (userId: string, name: string) => {
        setHistoryUserView({ userId, name });
        setShowHistoryDetailsModal(true);
    };

    const inputClass = "border p-2.5 rounded-lg text-black w-full focus:ring-2 focus:ring-blue-500 outline-none transition";
    const modalClass = `fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md`;
    const modalContentClass = `w-full max-w-2xl p-6 rounded-2xl shadow-2xl border ${theme === 'dark' ? 'bg-gray-900 text-white border-gray-800' : 'bg-white text-black border-gray-100'}`;

    const typeLabels = { annual: 'سنوي', casual: 'عارضة', sick: 'مرضي', exams: 'امتحانات' };
    const typeColors = { 
        annual: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        casual: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
        sick: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        exams: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <History className="text-blue-500" /> 
                    إدارة أرصدة الإجازات
                </h2>
                <button 
                    onClick={() => setShowAddLeaveModal(true)}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-bold shadow-lg flex items-center gap-2 transition transform active:scale-95"
                >
                    <CalendarPlus size={20} />
                    تسجيل إجازة جديدة
                </button>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex items-center gap-3 text-sm text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50">
                <AlertCircle size={20} className="shrink-0" />
                <p>يتم احتساب الإجازات دورياً من يوم <b>21</b> في الشهر إلى يوم <b>20</b> من الشهر التالي. اضغط على الرصيد في الجدول لعرض التفاصيل.</p>
            </div>

            {/* Balances Table */}
            <div className="overflow-hidden rounded-2xl shadow-xl border border-gray-200 dark:border-gray-800">
                <table className={`w-full text-center border-collapse ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                    <thead>
                        <tr className={`${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50 text-gray-600'}`}>
                            <th className="p-4 text-right">الموظف</th>
                            <th className="p-4">سنوي</th>
                            <th className="p-4">عارضة</th>
                            <th className="p-4">مرضي</th>
                            <th className="p-4">امتحانات</th>
                            {user.role === 'admin' && <th className="p-4">التحكم</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {balances.map((balance) => (
                            <tr key={balance.userId} className={`border-b ${theme === 'dark' ? 'border-gray-800 bg-gray-900 hover:bg-gray-850' : 'bg-white border-gray-100 hover:bg-gray-50'} transition-colors`}>
                                <td className="p-4 font-bold text-right flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 text-xs">
                                        {balance.employeeName.charAt(0)}
                                    </div>
                                    {balance.employeeName}
                                </td>
                                <td className="p-4"><button onClick={() => openHistory(balance.userId, balance.employeeName)} className="font-bold text-green-600 dark:text-green-400 text-lg hover:underline transition px-4">{balance.annual}</button></td>
                                <td className="p-4"><button onClick={() => openHistory(balance.userId, balance.employeeName)} className="font-bold text-yellow-600 dark:text-yellow-400 text-lg hover:underline transition px-4">{balance.casual}</button></td>
                                <td className="p-4"><button onClick={() => openHistory(balance.userId, balance.employeeName)} className="font-bold text-red-600 dark:text-red-400 text-lg hover:underline transition px-4">{balance.sick}</button></td>
                                <td className="p-4"><button onClick={() => openHistory(balance.userId, balance.employeeName)} className="font-bold text-purple-600 dark:text-purple-400 text-lg hover:underline transition px-4">{balance.exams}</button></td>
                                {user.role === 'admin' && (
                                    <td className="p-4">
                                        <div className="flex justify-center gap-2">
                                            <button onClick={() => { setEditingBalance(balance); setShowEditBalanceModal(true); }} className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"><Edit size={18} /></button>
                                            <button onClick={() => handleDeleteBalance(balance.userId)} className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"><Trash2 size={18} /></button>
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        {balances.length === 0 && (
                            <tr><td colSpan={user.role === 'admin' ? 6 : 5} className="p-10 opacity-40 italic">لا توجد أرصدة مسجلة حالياً</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Modal: History Details (UPGRADED) */}
            {showHistoryDetailsModal && historyUserView && (
                <div className={modalClass}>
                    <div className={`${modalContentClass} max-w-3xl overflow-hidden flex flex-col max-h-[90vh]`}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2 text-blue-600">
                                <History size={24} />
                                سجل إجازات: {historyUserView.name}
                            </h3>
                            <button onClick={() => setShowHistoryDetailsModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition"><X/></button>
                        </div>

                        {/* Modern Period Navigator */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-5 rounded-2xl shadow-lg mb-6">
                            <div className="flex justify-between items-center">
                                <button onClick={() => changePeriod(-1)} className="p-2 hover:bg-white/20 rounded-xl transition"><ChevronRight size={24}/></button>
                                <div className="text-center">
                                    <div className="text-xs font-medium uppercase tracking-wider opacity-80 mb-1">فترة التقرير الحالية</div>
                                    <div className="font-bold text-lg flex items-center gap-2">
                                        <Calendar size={18} />
                                        {currentPeriodStart.toLocaleDateString('ar-EG')} - {getPeriodEnd(currentPeriodStart).toLocaleDateString('ar-EG')}
                                    </div>
                                </div>
                                <button onClick={() => changePeriod(1)} className="p-2 hover:bg-white/20 rounded-xl transition"><ChevronLeft size={24}/></button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar px-1">
                            {filterHistoryByPeriodAndUser(historyUserView.userId).length > 0 ? (
                                <div className="space-y-3">
                                    {filterHistoryByPeriodAndUser(historyUserView.userId).map((rec: any) => (
                                        <div key={rec.id} className={`p-4 rounded-xl border flex justify-between items-center ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-gray-50 border-gray-200'} transition-all hover:shadow-md`}>
                                            <div className="flex items-center gap-4">
                                                <div className={`p-3 rounded-xl ${typeColors[rec.type as keyof typeof typeColors]}`}>
                                                    <CheckCircle2 size={24} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-sm mb-0.5">{typeLabels[rec.type as keyof typeof typeLabels]}</div>
                                                    <div className="text-xs opacity-60 flex items-center gap-1"><Clock size={12}/> {rec.date}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-6">
                                                <div className="text-center">
                                                    <div className="font-bold text-lg">{rec.days}</div>
                                                    <div className="text-[10px] opacity-60 uppercase">أيام</div>
                                                </div>
                                                {user.role === 'admin' && (
                                                    <div className="flex gap-1 border-r pr-3 border-gray-300 dark:border-gray-700">
                                                        <button onClick={() => { setEditingRecord(rec); setShowEditRecordModal(true); }} className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg"><Edit size={16} /></button>
                                                        <button onClick={() => handleDeleteRecord(rec.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-20 text-center opacity-40">
                                    <AlertCircle size={48} className="mx-auto mb-4" />
                                    <p className="italic">لا توجد إجازات مسجلة في هذه الدورة الشهرية</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
                            <button onClick={() => setShowHistoryDetailsModal(false)} className="px-8 py-2.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition">إغلاق</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Edit Record (ADMIN ONLY) */}
            {showEditRecordModal && editingRecord && user.role === 'admin' && (
                <div className={modalClass}>
                    <div className={modalContentClass}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">تعديل سجل الإجازة</h3>
                            <button onClick={() => setShowEditRecordModal(false)}><X/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block mb-1.5 text-sm font-bold opacity-70">التاريخ</label>
                                <input type="date" className={inputClass} value={editingRecord.date} onChange={e => setEditingRecord({...editingRecord, date: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block mb-1.5 text-sm font-bold opacity-70">عدد الأيام</label>
                                    <input type="number" step="0.5" className={inputClass} value={editingRecord.days} onChange={e => setEditingRecord({...editingRecord, days: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="block mb-1.5 text-sm font-bold opacity-70">النوع</label>
                                    <select className={inputClass} value={editingRecord.type} onChange={e => setEditingRecord({...editingRecord, type: e.target.value as any})}>
                                        <option value="annual">سنوي</option>
                                        <option value="casual">عارضة</option>
                                        <option value="sick">مرضي</option>
                                        <option value="exams">امتحانات</option>
                                    </select>
                                </div>
                            </div>
                            <button onClick={handleUpdateRecord} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl shadow-lg mt-4 flex items-center justify-center gap-2">
                                <Save size={20}/> حفظ التعديلات
                            </button>
                        </div>
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
                                <label className="block mb-1.5 text-sm font-bold opacity-70">اختر الموظف</label>
                                <select className={inputClass} value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
                                    <option value="">-- اختر الموظف --</option>
                                    {(user.role === 'admin' ? usersList : usersList.filter(u => u.name === user.name)).map(u => (
                                        <option key={u.key} value={u.key}>{u.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1.5 text-sm font-bold opacity-70">تاريخ البداية</label>
                                <input type="date" className={inputClass} value={leaveDate} onChange={e => setLeaveDate(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block mb-1.5 text-sm font-bold opacity-70">عدد الأيام</label>
                                    <input type="number" min="0.5" step="0.5" className={inputClass} value={leaveDays} onChange={e => setLeaveDays(parseFloat(e.target.value))} />
                                </div>
                                <div>
                                    <label className="block mb-1.5 text-sm font-bold opacity-70">نوع الخصم</label>
                                    <select className={inputClass} value={leaveType} onChange={e => setLeaveType(e.target.value as any)}>
                                        <option value="annual">رصيد سنوي</option>
                                        <option value="casual">رصيد عارضة</option>
                                        <option value="sick">مرضي</option>
                                        <option value="exams">امتحانات</option>
                                    </select>
                                </div>
                            </div>
                            <button onClick={handleAddLeave} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg mt-4 transition transform active:scale-95">حفظ وتأكيد الخصم</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Edit Balance (Admin Only) */}
            {showEditBalanceModal && editingBalance && user.role === 'admin' && (
                 <div className={modalClass}>
                    <div className={modalContentClass}>
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">تعديل الأرصدة: {editingBalance.employeeName}</h3>
                            <button onClick={() => {setShowEditBalanceModal(false); setEditingBalance(null)}}><X/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {Object.keys(typeLabels).map(key => (
                                <div key={key}>
                                    <label className="block text-sm mb-1.5 font-bold opacity-70">{typeLabels[key as keyof typeof typeLabels]}</label>
                                    <input type="number" className={inputClass} value={(editingBalance as any)[key]} onChange={e => setEditingBalance({...editingBalance, [key]: Number(e.target.value)})} />
                                </div>
                            ))}
                        </div>
                        <button onClick={handleEditBalance} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl mt-6 shadow-lg transition">حفظ الأرصدة الجديدة</button>
                    </div>
                 </div>
            )}
        </div>
    );
};

export default LeaveBalanceComponent;