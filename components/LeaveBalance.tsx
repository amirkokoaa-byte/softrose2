import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, set, push, update, remove } from "firebase/database";
import { User, LeaveBalance, LeaveRecord } from '../types';
import { Trash2, Edit, CalendarPlus, X, Save, History } from 'lucide-react';

interface Props {
    user: User;
    theme: string;
}

const LeaveBalanceComponent: React.FC<Props> = ({ user, theme }) => {
    const [balances, setBalances] = useState<LeaveBalance[]>([]);
    const [usersList, setUsersList] = useState<{key: string, name: string}[]>([]);
    
    // Modal States
    const [showAddLeaveModal, setShowAddLeaveModal] = useState(false);
    const [showEditBalanceModal, setShowEditBalanceModal] = useState(false);
    
    // Form States
    const [selectedUser, setSelectedUser] = useState('');
    const [leaveDate, setLeaveDate] = useState('');
    const [leaveDays, setLeaveDays] = useState(1);
    const [leaveType, setLeaveType] = useState<'annual' | 'casual' | 'sick' | 'exams'>('annual');

    const [editingBalance, setEditingBalance] = useState<LeaveBalance | null>(null);

    // Initial Loading
    useEffect(() => {
        // Load All Users for dropdown
        onValue(ref(db, 'users'), snapshot => {
            if (snapshot.exists()) {
                const u: any[] = [];
                snapshot.forEach(c => { u.push({ key: c.key, name: c.val().name }); });
                setUsersList(u);
            }
        });

        // Load Balances
        onValue(ref(db, 'leave_balances'), snapshot => {
            if (snapshot.exists()) {
                const b: LeaveBalance[] = Object.values(snapshot.val());
                
                // Privacy Filter
                if (user.role === 'admin') {
                    setBalances(b);
                } else {
                    // Find current user's key/id to match
                    // Since we store userId in balance, we filter by it.
                    // We need to map the current logged in user to the ID used in balances
                    // Assuming user.username or we find the ID from users list.
                    // For simplicity, let's match by employeeName if userId is tricky, or filter after.
                    setBalances(b.filter(x => x.employeeName === user.name));
                }
            } else {
                setBalances([]);
            }
        });
    }, [user]);

    const handleAddLeave = async () => {
        if (!selectedUser || !leaveDate || leaveDays <= 0) return alert("يرجى اكمال البيانات");

        const targetUser = usersList.find(u => u.key === selectedUser);
        if (!targetUser) return;

        // 1. Get current balance
        const balanceRef = ref(db, `leave_balances/${selectedUser}`);
        let currentBalance: LeaveBalance = balances.find(b => b.userId === selectedUser) || {
            userId: selectedUser,
            employeeName: targetUser.name,
            annual: 21, casual: 7, sick: 0, exams: 0 // Default defaults
        };

        // 2. Deduct
        if (currentBalance[leaveType] < leaveDays && leaveType !== 'sick' && leaveType !== 'exams') {
             if(!confirm(`الرصيد الحالي (${currentBalance[leaveType]}) أقل من المطلوب (${leaveDays}). هل تريد المتابعة بالسالب؟`)) return;
        }

        const newBalance = {
            ...currentBalance,
            [leaveType]: Number(currentBalance[leaveType]) - Number(leaveDays)
        };

        // 3. Save Balance
        await set(balanceRef, newBalance);

        // 4. Record History
        const historyData: LeaveRecord = {
            userId: selectedUser,
            employeeName: targetUser.name,
            date: leaveDate,
            days: Number(leaveDays),
            type: leaveType,
            timestamp: Date.now()
        };
        await push(ref(db, 'leave_history'), historyData);

        alert("تم تسجيل الاجازة وخصم الرصيد");
        setShowAddLeaveModal(false);
        setLeaveDays(1);
        setLeaveDate('');
    };

    const handleEditBalance = async () => {
        if (!editingBalance) return;
        await set(ref(db, `leave_balances/${editingBalance.userId}`), editingBalance);
        setShowEditBalanceModal(false);
        setEditingBalance(null);
    };

    const handleDeleteBalance = async (userId: string) => {
        if(confirm("هل أنت متأكد من حذف سجل أرصدة هذا الموظف؟")) {
            await remove(ref(db, `leave_balances/${userId}`));
        }
    };

    // Helper to initialize balance if not exists for a user (Admin feature)
    const initBalance = async (u: {key: string, name: string}) => {
        const confirmInit = confirm(`هل تريد إنشاء سجل رصيد افتراضي لـ ${u.name}؟ (21 سنوي / 7 عارضة)`);
        if(confirmInit) {
            const data: LeaveBalance = {
                userId: u.key,
                employeeName: u.name,
                annual: 21,
                casual: 7,
                sick: 0,
                exams: 0
            };
            await set(ref(db, `leave_balances/${u.key}`), data);
        }
    };

    const inputClass = "border p-2 rounded text-black w-full";
    const modalClass = `fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm`;
    const modalContentClass = `w-full max-w-md p-6 rounded-lg shadow-2xl ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'}`;

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <CalendarPlus className="text-blue-500" /> 
                    رصيد الإجازات
                </h2>
                
                <button 
                    onClick={() => setShowAddLeaveModal(true)}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-full font-bold shadow-lg flex items-center gap-2 transition transform hover:scale-105"
                >
                    <CalendarPlus size={20} />
                    تواريخ الإجازات (خصم)
                </button>
            </div>

            {/* Balances Table */}
            <div className="overflow-x-auto rounded-lg shadow-lg">
                <table className={`w-full text-center border-collapse ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
                    <thead>
                        <tr className={`${theme === 'dark' ? 'bg-gray-700' : 'bg-blue-600 text-white'}`}>
                            <th className="p-4">اسم الموظف</th>
                            <th className="p-4 bg-green-500/20">سنوي</th>
                            <th className="p-4 bg-yellow-500/20">عارضة</th>
                            <th className="p-4 bg-red-500/20">مرضي</th>
                            <th className="p-4 bg-purple-500/20">امتحانات</th>
                            <th className="p-4">إجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {balances.map((balance) => (
                            <tr key={balance.userId} className={`border-b ${theme === 'dark' ? 'border-gray-700 bg-gray-800 hover:bg-gray-750' : 'bg-white border-gray-100 hover:bg-gray-50'}`}>
                                <td className="p-4 font-bold">{balance.employeeName}</td>
                                <td className="p-4 font-bold text-green-600 dark:text-green-400 text-lg">{balance.annual}</td>
                                <td className="p-4 font-bold text-yellow-600 dark:text-yellow-400 text-lg">{balance.casual}</td>
                                <td className="p-4 font-bold text-red-600 dark:text-red-400 text-lg">{balance.sick}</td>
                                <td className="p-4 font-bold text-purple-600 dark:text-purple-400 text-lg">{balance.exams}</td>
                                <td className="p-4 flex justify-center gap-2">
                                    {(user.role === 'admin') && (
                                        <>
                                            <button 
                                                onClick={() => { setEditingBalance(balance); setShowEditBalanceModal(true); }}
                                                className="p-2 bg-blue-100 text-blue-600 rounded hover:bg-blue-200"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteBalance(balance.userId)}
                                                className="p-2 bg-red-100 text-red-600 rounded hover:bg-red-200"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </>
                                    )}
                                </td>
                            </tr>
                        ))}
                        {balances.length === 0 && (
                            <tr>
                                <td colSpan={6} className="p-8 text-center opacity-50">لا توجد أرصدة مسجلة</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Admin Feature: Add Balance for User not in list */}
            {user.role === 'admin' && (
                <div className="mt-8 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                    <h3 className="font-bold mb-2 text-sm opacity-70">إدارة أرصدة الموظفين الجدد</h3>
                    <div className="flex flex-wrap gap-2">
                        {usersList.filter(u => !balances.find(b => b.userId === u.key)).map(u => (
                            <button 
                                key={u.key}
                                onClick={() => initBalance(u)}
                                className="text-xs bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded hover:bg-gray-300 transition"
                            >
                                + {u.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Modal: Add Leave (Deduct) */}
            {showAddLeaveModal && (
                <div className={modalClass}>
                    <div className={modalContentClass}>
                        <div className="flex justify-between items-center mb-6 border-b pb-2">
                            <h3 className="text-xl font-bold flex items-center gap-2"><CalendarPlus /> تسجيل إجازة (خصم)</h3>
                            <button onClick={() => setShowAddLeaveModal(false)}><X className="text-gray-500 hover:text-red-500"/></button>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <label className="block mb-1 text-sm font-bold">الموظف</label>
                                <select 
                                    className={inputClass} 
                                    value={selectedUser} 
                                    onChange={e => setSelectedUser(e.target.value)}
                                >
                                    <option value="">اختر الحساب...</option>
                                    {(user.role === 'admin' ? usersList : usersList.filter(u => u.name === user.name)).map(u => (
                                        <option key={u.key} value={u.key}>{u.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block mb-1 text-sm font-bold">تاريخ الإجازة</label>
                                <input 
                                    type="date" 
                                    className={inputClass}
                                    value={leaveDate}
                                    onChange={e => setLeaveDate(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-4">
                                <div className="flex-1">
                                    <label className="block mb-1 text-sm font-bold">عدد الأيام</label>
                                    <input 
                                        type="number" 
                                        min="0.5"
                                        step="0.5"
                                        className={inputClass}
                                        value={leaveDays}
                                        onChange={e => setLeaveDays(parseFloat(e.target.value))}
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block mb-1 text-sm font-bold">نوع الإجازة</label>
                                    <select 
                                        className={inputClass}
                                        value={leaveType}
                                        onChange={e => setLeaveType(e.target.value as any)}
                                    >
                                        <option value="annual">سنوي</option>
                                        <option value="casual">عارضة</option>
                                        <option value="sick">مرضي</option>
                                        <option value="exams">امتحانات</option>
                                    </select>
                                </div>
                            </div>
                            
                            <button 
                                onClick={handleAddLeave}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded mt-4 shadow-lg transition"
                            >
                                اضف إجازة (خصم من الرصيد)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Edit Balance (Admin) */}
            {showEditBalanceModal && editingBalance && (
                 <div className={modalClass}>
                    <div className={modalContentClass}>
                        <div className="flex justify-between items-center mb-6 border-b pb-2">
                            <h3 className="text-xl font-bold">تعديل الأرصدة: {editingBalance.employeeName}</h3>
                            <button onClick={() => {setShowEditBalanceModal(false); setEditingBalance(null)}}><X/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm">سنوي</label>
                                <input 
                                    type="number" 
                                    className={inputClass} 
                                    value={editingBalance.annual}
                                    onChange={e => setEditingBalance({...editingBalance, annual: Number(e.target.value)})} 
                                />
                            </div>
                            <div>
                                <label className="block text-sm">عارضة</label>
                                <input 
                                    type="number" 
                                    className={inputClass} 
                                    value={editingBalance.casual}
                                    onChange={e => setEditingBalance({...editingBalance, casual: Number(e.target.value)})} 
                                />
                            </div>
                            <div>
                                <label className="block text-sm">مرضي</label>
                                <input 
                                    type="number" 
                                    className={inputClass} 
                                    value={editingBalance.sick}
                                    onChange={e => setEditingBalance({...editingBalance, sick: Number(e.target.value)})} 
                                />
                            </div>
                            <div>
                                <label className="block text-sm">امتحانات</label>
                                <input 
                                    type="number" 
                                    className={inputClass} 
                                    value={editingBalance.exams}
                                    onChange={e => setEditingBalance({...editingBalance, exams: Number(e.target.value)})} 
                                />
                            </div>
                        </div>
                        <button 
                            onClick={handleEditBalance}
                            className="w-full bg-blue-600 text-white font-bold py-2 rounded mt-6"
                        >
                            حفظ التعديلات
                        </button>
                    </div>
                 </div>
            )}
        </div>
    );
};

export default LeaveBalanceComponent;