import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, set, push, onValue, remove, update } from "firebase/database";
import { User, AppSettings } from '../types';
import { Save, Trash2, UserPlus, Shield, Edit2, Plus, X } from 'lucide-react';

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
    
    // Lists Management
    const [marketList, setMarketList] = useState<{key: string, val: string}[]>([]);
    const [companyList, setCompanyList] = useState<{key: string, val: string}[]>([]);
    const [newItemVal, setNewItemVal] = useState('');
    const [editingItem, setEditingItem] = useState<{key: string, val: string, type: 'market'|'company'} | null>(null);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    useEffect(() => {
        // Load Users
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

        // Load Markets Keys
        onValue(ref(db, 'settings/markets'), snapshot => {
            if(snapshot.exists()){
                const m: any[] = [];
                snapshot.forEach(c => { m.push({key: c.key, val: c.val()}) });
                setMarketList(m);
            } else {
                setMarketList([]);
            }
        });

        // Load Companies Keys
        onValue(ref(db, 'settings/companies'), snapshot => {
            if(snapshot.exists()){
                const c: any[] = [];
                snapshot.forEach(k => { c.push({key: k.key, val: k.val()}) });
                setCompanyList(c);
            } else {
                setCompanyList([]);
            }
        });

    }, [user.role]);

    if (user.role !== 'admin') {
        return <div className="text-center p-10 text-red-500 font-bold text-xl">عذراً، هذه الصفحة للمسؤولين فقط.</div>;
    }

    // --- General Settings ---
    const saveSettings = async () => {
        await set(ref(db, 'settings/app'), localSettings);
        alert('تم حفظ الإعدادات');
    };

    // --- User Management ---
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

    // --- List Management (Markets/Companies) ---
    const handleAddListItem = async (type: 'market' | 'company') => {
        if(!newItemVal) return;
        const path = type === 'market' ? 'settings/markets' : 'settings/companies';
        await push(ref(db, path), newItemVal);
        setNewItemVal('');
    };

    const handleDeleteListItem = async (key: string, type: 'market' | 'company') => {
        if(!confirm("هل أنت متأكد من الحذف؟")) return;
        const path = type === 'market' ? 'settings/markets' : 'settings/companies';
        await remove(ref(db, `${path}/${key}`));
    };

    const startEditItem = (item: {key: string, val: string}, type: 'market'|'company') => {
        setEditingItem({ ...item, type });
    };

    const saveEditItem = async () => {
        if(!editingItem) return;
        const path = editingItem.type === 'market' ? 'settings/markets' : 'settings/companies';
        await set(ref(db, `${path}/${editingItem.key}`), editingItem.val);
        setEditingItem(null);
    };

    const inputClass = "w-full p-2 rounded border border-gray-300 text-black";
    const sectionClass = `p-6 rounded-lg mb-6 ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white shadow'}`;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-10">
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

            {/* Lists Management */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Markets */}
                <div className={sectionClass}>
                    <h3 className="text-xl font-bold mb-4 border-b pb-2">إدارة الماركت</h3>
                    <div className="flex gap-2 mb-4">
                        <input 
                            className={inputClass} 
                            placeholder="اسم ماركت جديد" 
                            value={newItemVal} 
                            onChange={e => setNewItemVal(e.target.value)}
                        />
                        <button onClick={() => handleAddListItem('market')} className="bg-green-600 text-white p-2 rounded"><Plus/></button>
                    </div>
                    <ul className="max-h-60 overflow-y-auto space-y-2">
                        {marketList.map(m => (
                            <li key={m.key} className="flex justify-between items-center bg-black/10 p-2 rounded">
                                <span>{m.val}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => startEditItem(m, 'market')} className="text-blue-500"><Edit2 size={16}/></button>
                                    <button onClick={() => handleDeleteListItem(m.key, 'market')} className="text-red-500"><Trash2 size={16}/></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Companies */}
                <div className={sectionClass}>
                    <h3 className="text-xl font-bold mb-4 border-b pb-2">إدارة الشركات</h3>
                    <div className="flex gap-2 mb-4">
                        <input 
                            className={inputClass} 
                            placeholder="اسم شركة جديد" 
                            id="companyInput"
                        />
                        <button onClick={() => {
                            const val = (document.getElementById('companyInput') as HTMLInputElement).value;
                            if(val) {
                                push(ref(db, 'settings/companies'), val);
                                (document.getElementById('companyInput') as HTMLInputElement).value = '';
                            }
                        }} className="bg-green-600 text-white p-2 rounded"><Plus/></button>
                    </div>
                    <ul className="max-h-60 overflow-y-auto space-y-2">
                        {companyList.map(c => (
                            <li key={c.key} className="flex justify-between items-center bg-black/10 p-2 rounded">
                                <span>{c.val}</span>
                                <div className="flex gap-2">
                                    <button onClick={() => startEditItem(c, 'company')} className="text-blue-500"><Edit2 size={16}/></button>
                                    <button onClick={() => handleDeleteListItem(c.key, 'company')} className="text-red-500"><Trash2 size={16}/></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Edit Modal for Lists */}
            {editingItem && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className={`p-6 rounded-lg w-96 ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                        <h3 className="text-xl font-bold mb-4 text-black dark:text-white">تعديل الاسم</h3>
                        <input 
                            value={editingItem.val} 
                            onChange={e => setEditingItem({...editingItem, val: e.target.value})}
                            className="w-full border p-2 rounded text-black mb-4"
                        />
                        <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingItem(null)} className="px-4 py-2 bg-gray-500 text-white rounded">إلغاء</button>
                            <button onClick={saveEditItem} className="px-4 py-2 bg-blue-600 text-white rounded">حفظ</button>
                        </div>
                    </div>
                </div>
            )}

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