
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, set, push, onValue, remove, update } from "firebase/database";
import { User, AppSettings } from '../types';
import { 
  Save, Trash2, UserPlus, Shield, Edit2, Plus, X, 
  Settings as SettingsIcon, Users, MapPin, Building2, 
  ToggleLeft, ToggleRight, Key, MessageSquare 
} from 'lucide-react';

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
    const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'user' as const, canViewAllSales: false });
    const [marketList, setMarketList] = useState<{key: string, name: string, createdBy: string}[]>([]);
    const [companyList, setCompanyList] = useState<{key: string, name: string, createdBy: string}[]>([]);
    const [passModal, setPassModal] = useState<{key: string, name: string} | null>(null);
    const [newPass, setNewPass] = useState('');

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    useEffect(() => {
        if (user.role !== 'admin') return;

        // جلب المستخدمين
        onValue(ref(db, 'users'), snapshot => {
            if (snapshot.exists()) {
                const u: any[] = [];
                snapshot.forEach(c => { u.push({ key: c.key, ...c.val() }); });
                setUsers(u);
            }
        });

        // جلب الماركتات مع تفاصيل المنشئ
        onValue(ref(db, 'settings/markets'), snapshot => {
            if(snapshot.exists()){
                const m: any[] = [];
                snapshot.forEach(c => { 
                    const data = c.val();
                    m.push({
                        key: c.key, 
                        name: typeof data === 'string' ? data : data.name,
                        createdBy: typeof data === 'string' ? 'System' : data.createdBy
                    });
                });
                setMarketList(m);
            }
        });

        // جلب الشركات مع تفاصيل المنشئ
        onValue(ref(db, 'settings/companies'), snapshot => {
            if(snapshot.exists()){
                const c: any[] = [];
                snapshot.forEach(k => { 
                    const data = k.val();
                    c.push({
                        key: k.key, 
                        name: typeof data === 'string' ? data : data.name,
                        createdBy: typeof data === 'string' ? 'System' : data.createdBy
                    });
                });
                setCompanyList(c);
            }
        });
    }, [user.role]);

    const saveAppSettings = async () => {
        try {
            await set(ref(db, 'settings/app'), localSettings);
            alert('تم حفظ إعدادات التطبيق بنجاح');
        } catch (e) { alert('خطأ في الحفظ'); }
    };

    const togglePermission = (key: keyof AppSettings['permissions']) => {
        setLocalSettings(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [key]: !prev.permissions[key]
            }
        }));
    };

    const handleAddUser = async () => {
        if (!newUser.username || !newUser.password || !newUser.name) return alert("اكمل بيانات المستخدم");
        await push(ref(db, 'users'), newUser);
        alert("تمت إضافة المستخدم بنجاح");
        setNewUser({ name: '', username: '', password: '', role: 'user', canViewAllSales: false });
    };

    const handleDeleteUser = async (key: string) => {
        if (confirm("هل أنت متأكد من حذف هذا المستخدم؟")) {
            await remove(ref(db, `users/${key}`));
        }
    };

    const handleUpdatePassword = async () => {
        if(!passModal || !newPass) return;
        await update(ref(db, `users/${passModal.key}`), { password: newPass });
        alert("تم تحديث كلمة المرور");
        setPassModal(null);
        setNewPass('');
    };

    if (user.role !== 'admin') {
        return <div className="p-10 text-center opacity-50">عذراً، هذه الصفحة متاحة للمسؤولين فقط.</div>;
    }

    const inputClass = "w-full p-2.5 rounded-lg border border-gray-300 text-black focus:ring-2 focus:ring-blue-500 outline-none";
    const sectionClass = `p-6 rounded-2xl mb-6 ${theme === 'dark' ? 'bg-gray-800 border-gray-700 border' : 'bg-white shadow-xl'}`;

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            <div className="flex items-center gap-3 mb-2">
                <SettingsIcon className="text-blue-600" size={32} />
                <h2 className="text-3xl font-bold">لوحة تحكم المسؤول</h2>
            </div>

            {/* إعدادات التطبيق العامة */}
            <div className={sectionClass}>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-blue-600 border-b pb-3">
                    <Edit2 size={20} /> الإعدادات العامة للمنصة
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-bold mb-2 opacity-70">اسم التطبيق (AppName)</label>
                        <input className={inputClass} value={localSettings.appName} onChange={e => setLocalSettings({...localSettings, appName: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 opacity-70">رقم واتساب الدعم</label>
                        <input className={inputClass} placeholder="مثال: 2010XXXXXXXX" value={localSettings.whatsappNumber} onChange={e => setLocalSettings({...localSettings, whatsappNumber: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold mb-2 opacity-70">نص الشريط المتحرك (Ticker Text)</label>
                        <div className="flex gap-2">
                            <input className={inputClass} value={localSettings.tickerText} onChange={e => setLocalSettings({...localSettings, tickerText: e.target.value})} />
                            <button 
                                onClick={() => setLocalSettings({...localSettings, tickerEnabled: !localSettings.tickerEnabled})}
                                className={`px-4 rounded-lg flex items-center gap-2 font-bold ${localSettings.tickerEnabled ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-700'}`}
                            >
                                {localSettings.tickerEnabled ? <ToggleRight /> : <ToggleLeft />} {localSettings.tickerEnabled ? 'مفعل' : 'معطل'}
                            </button>
                        </div>
                    </div>
                </div>
                <button onClick={saveAppSettings} className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition transform active:scale-95">
                    <Save size={20} /> حفظ الإعدادات العامة
                </button>
            </div>

            {/* صلاحيات الوصول للمستخدمين */}
            <div className={sectionClass}>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-indigo-600 border-b pb-3">
                    <Shield size={20} /> إدارة صلاحيات الأقسام (للمستخدمين)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                        { key: 'showSalesLog', label: 'عرض سجل المبيعات' },
                        { key: 'showInventoryReg', label: 'تسجيل المخزون' },
                        { key: 'showInventoryLog', label: 'عرض سجل المخزون' },
                        { key: 'showCompetitorReports', label: 'عرض تقارير المنافسين' }
                    ].map(perm => (
                        <div key={perm.key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-black/20 rounded-xl">
                            <span className="font-bold">{perm.label}</span>
                            <button 
                                onClick={() => togglePermission(perm.key as keyof AppSettings['permissions'])}
                                className={`p-1 rounded-full transition ${localSettings.permissions[perm.key as keyof AppSettings['permissions']] ? 'text-green-600' : 'text-gray-400'}`}
                            >
                                {localSettings.permissions[perm.key as keyof AppSettings['permissions']] ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* إدارة المستخدمين */}
            <div className={sectionClass}>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-purple-600 border-b pb-3">
                    <Users size={20} /> إدارة حسابات الموظفين
                </h3>
                
                {/* إضافة مستخدم جديد */}
                <div className="bg-gray-50 dark:bg-black/20 p-6 rounded-2xl mb-6 border border-gray-200 dark:border-gray-700">
                    <h4 className="font-bold mb-4 flex items-center gap-2 text-sm"><UserPlus size={16}/> إضافة موظف جديد</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input className={inputClass} placeholder="الاسم الكامل" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                        <input className={inputClass} placeholder="اسم المستخدم" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                        <input className={inputClass} type="password" placeholder="كلمة المرور" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                        <select className={inputClass} value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}>
                            <option value="user">موظف (User)</option>
                            <option value="admin">مسؤول (Admin)</option>
                        </select>
                        <div className="flex items-center gap-2 px-2">
                             <input type="checkbox" id="viewSales" checked={newUser.canViewAllSales} onChange={e => setNewUser({...newUser, canViewAllSales: e.target.checked})} />
                             <label htmlFor="viewSales" className="text-xs font-bold">رؤية كل مبيعات الزملاء</label>
                        </div>
                        <button onClick={handleAddUser} className="bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition">إضافة الموظف</button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-100 dark:bg-gray-700">
                            <tr>
                                <th className="p-3">الاسم</th>
                                <th className="p-3">المستخدم</th>
                                <th className="p-3">الدور</th>
                                <th className="p-3">صلاحية الرؤية</th>
                                <th className="p-3 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.key} className="border-b border-gray-100 dark:border-gray-700 hover:bg-black/5">
                                    <td className="p-3 font-bold">{u.name}</td>
                                    <td className="p-3 opacity-70">{u.username}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {u.role === 'admin' ? 'مسؤول' : 'موظف'}
                                        </span>
                                    </td>
                                    <td className="p-3">{u.canViewAllSales ? 'نعم' : 'لا'}</td>
                                    <td className="p-3 flex justify-center gap-2">
                                        <button onClick={() => setPassModal({key: u.key, name: u.name})} className="p-2 text-orange-500 hover:bg-orange-50 rounded" title="تغيير كلمة المرور"><Key size={16}/></button>
                                        <button onClick={() => handleDeleteUser(u.key)} className="p-2 text-red-500 hover:bg-red-50 rounded" title="حذف الحساب"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* إدارة الماركت والشركات (البيانات الرئيسية) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className={sectionClass}>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-500 border-b pb-2">
                        <MapPin size={18} /> إدارة الماركتات
                    </h3>
                    <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                        {marketList.map(m => (
                            <div key={m.key} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-black/20 rounded-xl text-sm border border-transparent hover:border-blue-500/20">
                                <div>
                                    <div className="font-bold">{m.name}</div>
                                    <div className="text-[10px] opacity-50 italic">بواسطة: {m.createdBy}</div>
                                </div>
                                <button onClick={() => remove(ref(db, `settings/markets/${m.key}`))} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className={sectionClass}>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-green-500 border-b pb-2">
                        <Building2 size={18} /> إدارة الشركات
                    </h3>
                    <div className="max-h-64 overflow-y-auto space-y-2 custom-scrollbar pr-2">
                        {companyList.map(c => (
                            <div key={c.key} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-black/20 rounded-xl text-sm border border-transparent hover:border-green-500/20">
                                <div>
                                    <div className="font-bold">{c.name}</div>
                                    <div className="text-[10px] opacity-50 italic">بواسطة: {c.createdBy}</div>
                                </div>
                                <button onClick={() => remove(ref(db, `settings/companies/${c.key}`))} className="p-1.5 text-red-500 hover:bg-red-50 rounded"><Trash2 size={14}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modal: تغيير كلمة المرور */}
            {passModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[70] p-4 backdrop-blur-sm">
                    <div className={`w-full max-w-sm p-6 rounded-2xl shadow-2xl ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-black'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold">تغيير كلمة مرور: {passModal.name}</h3>
                            <button onClick={() => setPassModal(null)}><X /></button>
                        </div>
                        <input 
                            type="password" 
                            className={inputClass} 
                            placeholder="كلمة المرور الجديدة" 
                            value={newPass} 
                            onChange={e => setNewPass(e.target.value)} 
                        />
                        <button onClick={handleUpdatePassword} className="w-full mt-4 bg-orange-600 text-white py-2 rounded-xl font-bold shadow-lg">تحديث كلمة المرور</button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
