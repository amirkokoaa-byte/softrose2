import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, set, push, onValue, remove } from "firebase/database";
import { User, AppSettings } from '../types';
import { Save, Trash2, UserPlus, Shield } from 'lucide-react';

interface Props {
    user: User;
    settings: AppSettings;
    markets: string[];
    theme: string;
    setTheme: (t: any) => void;
}

const Settings: React.FC<Props> = ({ user, settings, markets, theme, setTheme }) => {
    const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
    const [users, setUsers] = useState<any[]>([]);
    const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'user', code: '', phone: '', canViewAllSales: false });

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    useEffect(() => {
        if (user.role === 'admin') {
            onValue(ref(db, 'users'), snapshot => {
                if (snapshot.exists()) {
                    const u: any[] = [];
                    snapshot.forEach(c => { u.push({ key: c.key, ...c.val() }); });
                    setUsers(u);
                } else {
                    setUsers([]);
                }
            });
        }
    }, [user.role]);

    if (user.role !== 'admin') {
        return <div className="text-center p-10 text-red-500 font-bold text-xl">عذراً، هذه الصفحة للمسؤولين فقط.</div>;
    }

    const saveSettings = async () => {
        await set(ref(db, 'settings/app'), localSettings);
        alert('تم حفظ الإعدادات');
    };

    const handleAddUser = async () => {
        if (!newUser.username || !newUser.password || !newUser.name) return alert("الرجاء ملء البيانات الأساسية");
        await push(ref(db, 'users'), newUser);
        setNewUser({ name: '', username: '', password: '', role: 'user', code: '', phone: '', canViewAllSales: false });
        alert("تم اضافة المستخدم");
    };

    const handleDeleteUser = async (key: string) => {
        if (confirm("حذف المستخدم؟")) {
            await remove(ref(db, `users/${key}`));
        }
    };

    const inputClass = "w-full p-2 rounded border border-gray-300 text-black";
    const sectionClass = `p-6 rounded-lg mb-6 ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white shadow'}`;

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-3xl font-bold mb-6">الإعدادات</h2>

            {/* General Settings */}
            <div className={sectionClass}>
                <h3 className="text-xl font-bold mb-4 border-b pb-2">إعدادات عامة</h3>
                <div className="grid grid-cols-1 gap-4">
                    <div>
                        <label className="block mb-1">اسم البرنامج</label>
                        <input 
                            className={inputClass} 
                            value={localSettings.appName}
                            onChange={e => setLocalSettings({...localSettings, appName: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block mb-1">نص الشريط المتحرك</label>
                        <input 
                            className={inputClass} 
                            value={localSettings.tickerText}
                            onChange={e => setLocalSettings({...localSettings, tickerText: e.target.value})}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            checked={localSettings.tickerEnabled}
                            onChange={e => setLocalSettings({...localSettings, tickerEnabled: e.target.checked})}
                            className="w-5 h-5"
                        />
                        <label>تفعيل الشريط المتحرك</label>
                    </div>
                    <div>
                        <label className="block mb-1">رقم الواتس آب</label>
                        <input 
                            className={inputClass} 
                            value={localSettings.whatsappNumber}
                            onChange={e => setLocalSettings({...localSettings, whatsappNumber: e.target.value})}
                            placeholder="مثال: 201xxxxxxxxx"
                        />
                    </div>
                </div>
                <button onClick={saveSettings} className="mt-4 bg-blue-600 text-white px-6 py-2 rounded flex items-center gap-2">
                    <Save size={18} /> حفظ الإعدادات
                </button>
            </div>

            {/* User Management */}
            <div className={sectionClass}>
                <h3 className="text-xl font-bold mb-4 border-b pb-2 flex items-center gap-2">
                    <UserPlus /> إدارة المستخدمين
                </h3>
                
                {/* Add User Form */}
                <div className="bg-gray-100 p-4 rounded mb-4 text-black">
                    <h4 className="font-bold mb-2">إضافة مستخدم جديد</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input placeholder="الاسم" className={inputClass} value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                        <input placeholder="اسم المستخدم (للدخول)" className={inputClass} value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                        <input placeholder="كلمة المرور" type="password" className={inputClass} value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                        <input placeholder="كود الموظف" className={inputClass} value={newUser.code} onChange={e => setNewUser({...newUser, code: e.target.value})} />
                        <input placeholder="رقم الهاتف" className={inputClass} value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} />
                        <select className={inputClass} value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                            <option value="user">مستخدم عادي</option>
                            <option value="admin">مسؤول (Admin)</option>
                        </select>
                        <div className="flex items-center gap-2 md:col-span-2">
                            <input type="checkbox" checked={newUser.canViewAllSales} onChange={e => setNewUser({...newUser, canViewAllSales: e.target.checked})} />
                            <label>السماح برؤية مبيعات الجميع</label>
                        </div>
                    </div>
                    <button onClick={handleAddUser} className="mt-2 bg-green-600 text-white px-4 py-1 rounded">إضافة</button>
                </div>

                {/* Users List */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead>
                            <tr className="bg-gray-500/20">
                                <th className="p-2">الاسم</th>
                                <th className="p-2">المستخدم</th>
                                <th className="p-2">الدور</th>
                                <th className="p-2">الكود</th>
                                <th className="p-2">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.key} className="border-b border-gray-500/10">
                                    <td className="p-2">{u.name}</td>
                                    <td className="p-2">{u.username}</td>
                                    <td className="p-2">
                                        {u.role === 'admin' ? <span className="bg-red-100 text-red-800 px-2 rounded flex items-center gap-1 w-fit"><Shield size={12}/> Admin</span> : 'مستخدم'}
                                    </td>
                                    <td className="p-2">{u.code}</td>
                                    <td className="p-2">
                                        <button onClick={() => handleDeleteUser(u.key)} className="text-red-500 hover:text-red-700">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Appearance */}
            <div className={sectionClass}>
                 <h3 className="text-xl font-bold mb-4 border-b pb-2">المظهر</h3>
                 <div className="flex gap-4 flex-wrap">
                     <button onClick={() => setTheme('win10')} className={`px-4 py-2 rounded border ${theme === 'win10' ? 'bg-blue-600 text-white' : ''}`}>Windows 10</button>
                     <button onClick={() => setTheme('glass')} className={`px-4 py-2 rounded border ${theme === 'glass' ? 'bg-purple-600 text-white' : ''}`}>Glass</button>
                     <button onClick={() => setTheme('dark')} className={`px-4 py-2 rounded border ${theme === 'dark' ? 'bg-gray-700 text-white' : ''}`}>Dark Mode</button>
                     <button onClick={() => setTheme('light')} className={`px-4 py-2 rounded border ${theme === 'light' ? 'bg-gray-200 text-black' : ''}`}>Light</button>
                 </div>
            </div>
        </div>
    );
};

export default Settings;