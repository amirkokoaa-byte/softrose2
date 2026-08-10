import { onCachedValue } from "../firebaseCache";

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, set, push, onValue, remove, update, get } from "firebase/database";
import { User, AppSettings, UserPermissions, AppNotification } from '../types';
import { 
  Save, Trash2, UserPlus, Shield, Edit2, Plus, X, 
  Settings as SettingsIcon, Users, MapPin, Building2, 
  ToggleLeft, ToggleRight, Key, Send
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
    const [users, setUsers] = useState<User[]>([]);
    const [newUser, setNewUser] = useState<User>({ 
        name: '', 
        username: '', 
        password: '', 
        role: 'user', 
        canViewAllSales: false,
        permissions: {
            showSalesLog: true,
            showInventoryLog: false,
            showInventoryReg: false,
            showCompetitorReports: false,
            showDailySales: true,
            showCompetitorPrices: true
        }
    });
    
    const [marketList, setMarketList] = useState<{key: string, name: string, createdBy: string}[]>([]);
    const [companyList, setCompanyList] = useState<{key: string, name: string, createdBy: string}[]>([]);
    
    // Modals
    const [passModal, setPassModal] = useState<{key: string, name: string} | null>(null);
    const [permModal, setPermModal] = useState<User | null>(null);
    const [notifModal, setNotifModal] = useState<{username: string, name: string} | null>(null);
    const [roleModal, setRoleModal] = useState<User | null>(null);
    const [newPass, setNewPass] = useState('');
    const [notifMsg, setNotifMsg] = useState('');
    
    // Company and Market Management
    const [newCompanyName, setNewCompanyName] = useState('');
    const [newMarketName, setNewMarketName] = useState('');
    const [editCompanyModal, setEditCompanyModal] = useState<{key: string, name: string} | null>(null);
    const [editMarketModal, setEditMarketModal] = useState<{key: string, name: string} | null>(null);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    useEffect(() => {
        if (user.role !== 'admin' && user.role !== 'manager') return;

        const unsubUsers = onCachedValue(ref(db, 'users'), 'users', snapshot => {
            if (snapshot.exists()) {
                const u: User[] = [];
                snapshot.forEach(c => { u.push({ key: c.key || '', ...c.val() }); });
                setUsers(u);
            }
        });

        const unsubMarkets = onCachedValue(ref(db, 'settings/markets'), 'settings_markets', snapshot => {
            if(snapshot.exists()){
                const m: any[] = [];
                snapshot.forEach(c => { 
                    const data = c.val();
                    let extractedName = data;
                    if (data && typeof data === 'object') {
                        extractedName = data.name;
                        if (typeof extractedName === 'object' && extractedName !== null) {
                            extractedName = extractedName.name || String(extractedName);
                        }
                    }
                    if (typeof extractedName === 'string' && extractedName !== '[object Object]') {
                        m.push({
                            key: c.key, 
                            name: extractedName,
                            createdBy: typeof data === 'string' ? 'System' : data.createdBy
                        });
                    }
                });
                setMarketList(m);
            }
        });

        const unsubCompanies = onCachedValue(ref(db, 'settings/companies'), 'settings_companies', snapshot => {
            if(snapshot.exists()){
                const cArr: any[] = [];
                snapshot.forEach(k => { 
                    const data = k.val();
                    let extractedName = data;
                    if (data && typeof data === 'object') {
                        extractedName = data.name;
                        if (typeof extractedName === 'object' && extractedName !== null) {
                            extractedName = extractedName.name || String(extractedName);
                        }
                    }
                    if (typeof extractedName === 'string' && extractedName !== '[object Object]') {
                        cArr.push({
                            key: k.key, 
                            name: extractedName,
                            createdBy: typeof data === 'string' ? 'System' : data.createdBy
                        });
                    }
                });
                setCompanyList(cArr);
            }
        });
        return () => { unsubUsers(); unsubMarkets(); unsubCompanies(); };
    }, [user.role]);

    const saveAppSettings = async () => {
        try {
            await set(ref(db, 'settings/app'), localSettings);
            alert('تم حفظ إعدادات التطبيق بنجاح');
        } catch (e) { alert('خطأ في الحفظ'); }
    };

    const handleAddUser = async () => {
        if (!newUser.username || !newUser.password || !newUser.name) return alert("اكمل بيانات المستخدم");
        
        // إضافة المستخدم وحفظ المفتاح
        const userRef = push(ref(db, 'users'));
        const userKey = userRef.key;
        await set(userRef, newUser);

        // تهيئة رصيد الإجازات تلقائياً للمستخدم الجديد
        if (userKey) {
            await set(ref(db, `leave_balances/${userKey}`), {
                userId: userKey,
                employeeName: newUser.name,
                annual: 21,
                casual: 7,
                sick: 0,
                exams: 0,
                unpaid: 0
            });
        }

        alert("تمت إضافة المستخدم وتهيئة رصيد إجازاته بنجاح");
        setNewUser({ 
            name: '', 
            username: '', 
            password: '', 
            role: 'user', 
            canViewAllSales: false,
            permissions: {
                showSalesLog: true,
                showInventoryLog: false,
                showInventoryReg: false,
                showCompetitorReports: false,
                showDailySales: true,
                showCompetitorPrices: true
            }
        });
    };

    const handleDeleteUser = async (key: string) => {
        if (confirm("هل أنت متأكد من حذف هذا المستخدم؟ سيتم حذف حسابه وكافة بياناته المرتبطة.")) {
            await remove(ref(db, `users/${key}`));
            await remove(ref(db, `leave_balances/${key}`));
            await remove(ref(db, `notifications/${key}`));
        }
    };

    const handleUpdatePassword = async () => {
        if(!passModal || !newPass) return;
        await update(ref(db, `users/${passModal.key}`), { password: newPass });
        alert("تم تحديث كلمة المرور");
        setPassModal(null);
        setNewPass('');
    };

    const handleUpdatePermissions = async () => {
        if (!permModal || !permModal.key) return;
        const permissions = permModal.permissions || {
            showSalesLog: false,
            showInventoryLog: false,
            showInventoryReg: false,
            showCompetitorReports: false,
            showDailySales: true,
            showCompetitorPrices: true
        };
        await update(ref(db, `users/${permModal.key}`), { 
            permissions: permissions,
            canViewAllSales: !!permModal.canViewAllSales
        });
        alert("تم تحديث الصلاحيات بنجاح");
        setPermModal(null);
    };

    const handleUpdateRole = async () => {
        if (!roleModal || !roleModal.key) return;
        await update(ref(db, `users/${roleModal.key}`), { role: roleModal.role });
        alert("تم تحديث المسمى الوظيفي بنجاح");
        setRoleModal(null);
    };

    const handleDeleteMarket = async (key: string) => {
        if (confirm("هل أنت متأكد من حذف هذا السوق؟")) {
            await remove(ref(db, `settings/markets/${key}`));
        }
    };

    const handleDeleteCompany = async (key: string) => {
        if (confirm("هل أنت متأكد من حذف هذه الشركة؟")) {
            await remove(ref(db, `settings/companies/${key}`));
        }
    };

    const handleAddCompany = async () => {
        if (!newCompanyName.trim()) return;
        await push(ref(db, 'settings/companies'), {
            name: newCompanyName.trim(),
            createdBy: 'system'
        });
        setNewCompanyName('');
    };

    const handleAddMarket = async () => {
        if (!newMarketName.trim()) return;
        await push(ref(db, 'settings/markets'), {
            name: newMarketName.trim(),
            createdBy: 'system'
        });
        setNewMarketName('');
    };

    const handleUpdateCompany = async () => {
        if (!editCompanyModal || !editCompanyModal.name.trim()) return;
        await update(ref(db, `settings/companies/${editCompanyModal.key}`), {
            name: editCompanyModal.name.trim(),
            createdBy: 'system'
        });
        setEditCompanyModal(null);
    };

    const handleUpdateMarket = async () => {
        if (!editMarketModal || !editMarketModal.name.trim()) return;
        await update(ref(db, `settings/markets/${editMarketModal.key}`), {
            name: editMarketModal.name.trim(),
            createdBy: 'system'
        });
        setEditMarketModal(null);
    };

    const handleExportData = async () => {
        try {
            const snapshot = await get(ref(db, '/'));
            if (snapshot.exists()) {
                const data = snapshot.val();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `soft_rose_backup_${new Date().toISOString().split('T')[0]}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            } else {
                alert('لا توجد بيانات لتصديرها');
            }
        } catch (error) {
            console.error("Export error:", error);
            alert('حدث خطأ أثناء تصدير البيانات');
        }
    };

    const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);
                if (confirm('تحذير: استيراد البيانات سيقوم باستبدال كافة البيانات الحالية. هل أنت متأكد؟')) {
                    await set(ref(db, '/'), data);
                    alert('تم استيراد البيانات بنجاح');
                }
            } catch (error) {
                console.error("Import error:", error);
                alert('حدث خطأ أثناء استيراد البيانات. تأكد من صحة الملف.');
            }
        };
        reader.readAsText(file);
    };

    const handleSendNotif = async () => {
        if (!notifModal || !notifMsg) return;
        const notification: AppNotification = {
            message: notifMsg,
            sender: user.name,
            timestamp: Date.now(),
            isRead: false
        };
        await push(ref(db, `notifications/${notifModal.username}`), notification);
        alert(`تم إرسال الرسالة بنجاح إلى ${notifModal.name}`);
        setNotifModal(null);
        setNotifMsg('');
    };

    const toggleUserPerm = (key: keyof UserPermissions) => {
        if (!permModal) return;
        const currentPermissions = permModal.permissions || {
            showSalesLog: false,
            showInventoryLog: false,
            showInventoryReg: false,
            showCompetitorReports: false,
            showDailySales: true,
            showCompetitorPrices: true
        };
        setPermModal({
            ...permModal,
            permissions: {
                ...currentPermissions,
                [key]: !currentPermissions[key]
            }
        });
    };

    const getRoleLabel = (role: string) => {
        switch(role) {
            case 'admin': return 'مسؤول';
            case 'manager': return 'مدير';
            case 'coordinator': return 'منسق';
            case 'supervisor': return 'مشرف';
            case 'usher': return 'أشر';
            case 'user':
            default: return 'موظف';
        }
    };

    if (user.role !== 'admin' && user.role !== 'manager') {
        return <div className="p-10 text-center opacity-50">عذراً، هذه الصفحة متاحة للمسؤولين فقط.</div>;
    }

    const inputClass = "w-full p-2.5 rounded-lg border border-gray-300 bg-gray-600 text-white focus:ring-2 focus:ring-blue-500 outline-none font-bold";
    const sectionClass = `p-6 rounded-2xl mb-6 bg-gray-800 border-gray-700 border text-white`;

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-20">
            <div className="flex items-center gap-3 mb-2 text-white">
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
                        <label className="block text-sm font-bold mb-2 opacity-70 text-white">اسم التطبيق (AppName)</label>
                        <input className={inputClass} value={localSettings.appName || ''} onChange={e => setLocalSettings({...localSettings, appName: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 opacity-70 text-white">رقم واتساب الدعم</label>
                        <input className={inputClass} placeholder="مثال: 2010XXXXXXXX" value={localSettings.whatsappNumber || ''} onChange={e => setLocalSettings({...localSettings, whatsappNumber: e.target.value})} />
                    </div>
                    <div className="md:col-span-2 text-white">
                        <label className="block text-sm font-bold mb-2 opacity-70">نص الشريط المتحرك (Ticker Text)</label>
                        <div className="flex gap-2">
                            <input className={inputClass} value={localSettings.tickerText || ''} onChange={e => setLocalSettings({...localSettings, tickerText: e.target.value})} />
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

            {/* إدارة البيانات */}
            <div className={sectionClass}>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-green-600 border-b pb-3">
                    <Save size={20} /> إدارة البيانات (نسخ احتياطي واستعادة)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <button 
                        onClick={handleExportData} 
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold shadow-lg transition transform active:scale-95"
                    >
                        تصدير كافة البيانات (Export)
                    </button>
                    <div className="relative">
                        <input 
                            type="file" 
                            accept=".json" 
                            onChange={handleImportData} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <button className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-bold shadow-lg transition transform active:scale-95 pointer-events-none">
                            استيراد بيانات (Import)
                        </button>
                    </div>
                </div>
            </div>

            {/* إدارة الشركات والأسواق */}
            <div className={sectionClass}>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-yellow-500 border-b pb-3">
                    <Building2 size={20} /> إدارة الشركات والأسواق
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-bold mb-4 text-white flex items-center gap-2"><Building2 size={16}/> الشركات المسجلة</h4>
                        <div className="flex gap-2 mb-4">
                            <input 
                                className={inputClass} 
                                placeholder="اسم الشركة الجديدة" 
                                value={newCompanyName} 
                                onChange={e => setNewCompanyName(e.target.value)} 
                            />
                            <button 
                                onClick={handleAddCompany} 
                                className="bg-green-600 hover:bg-green-700 text-white px-4 rounded-lg font-bold flex items-center justify-center transition"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                            {companyList.map(c => (
                                <div key={c.key} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-xl border border-gray-600">
                                    <span className="font-bold text-white">{c.name}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => setEditCompanyModal(c)} className="text-blue-400 hover:bg-blue-400/10 p-2 rounded-lg transition">
                                            <Edit2 size={16}/>
                                        </button>
                                        <button onClick={() => handleDeleteCompany(c.key)} className="text-red-400 hover:bg-red-400/10 p-2 rounded-lg transition">
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {companyList.length === 0 && <div className="text-center opacity-50 text-sm py-4">لا توجد شركات مسجلة</div>}
                        </div>
                    </div>
                    <div>
                        <h4 className="font-bold mb-4 text-white flex items-center gap-2"><MapPin size={16}/> الأسواق المسجلة</h4>
                        <div className="flex gap-2 mb-4">
                            <input 
                                className={inputClass} 
                                placeholder="اسم السوق الجديد" 
                                value={newMarketName} 
                                onChange={e => setNewMarketName(e.target.value)} 
                            />
                            <button 
                                onClick={handleAddMarket} 
                                className="bg-green-600 hover:bg-green-700 text-white px-4 rounded-lg font-bold flex items-center justify-center transition"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                            {marketList.map(m => (
                                <div key={m.key} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-xl border border-gray-600">
                                    <span className="font-bold text-white">{m.name}</span>
                                    <div className="flex gap-1">
                                        <button onClick={() => setEditMarketModal(m)} className="text-blue-400 hover:bg-blue-400/10 p-2 rounded-lg transition">
                                            <Edit2 size={16}/>
                                        </button>
                                        <button onClick={() => handleDeleteMarket(m.key)} className="text-red-400 hover:bg-red-400/10 p-2 rounded-lg transition">
                                            <Trash2 size={16}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {marketList.length === 0 && <div className="text-center opacity-50 text-sm py-4">لا توجد أسواق مسجلة</div>}
                        </div>
                    </div>
                </div>
            </div>

            {/* إدارة المستخدمين */}
            <div className={sectionClass}>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-purple-600 border-b pb-3">
                    <Users size={20} /> إدارة حسابات وصلاحيات الموظفين
                </h3>
                
                {/* إضافة مستخدم جديد */}
                <div className="bg-gray-700/50 p-6 rounded-2xl mb-6 border border-gray-600">
                    <h4 className="font-bold mb-4 flex items-center gap-2 text-sm text-white"><UserPlus size={16}/> إضافة موظف جديد</h4>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <input className={inputClass} placeholder="الاسم الكامل" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                        <input className={inputClass} placeholder="اسم المستخدم" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                        <input className={inputClass} type="password" placeholder="كلمة المرور" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                        <select className={inputClass} value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}>
                            <option value="user">موظف (User)</option>
                            <option value="admin">مسؤول (Admin)</option>
                            <option value="manager">مدير (Manager)</option>
                            <option value="coordinator">منسق (Coordinator)</option>
                            <option value="supervisor">مشرف (Supervisor)</option>
                            <option value="usher">أشر (Usher)</option>
                            <option value="usher">أشر (Usher)</option>
                        </select>
                    </div>
                    <button onClick={handleAddUser} className="mt-4 w-full bg-green-600 text-white font-bold py-2 rounded-lg hover:bg-green-700 transition shadow-lg">إضافة الموظف</button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead className="bg-gray-700">
                            <tr>
                                <th className="p-3 text-white">الاسم</th>
                                <th className="p-3 text-white">المستخدم</th>
                                <th className="p-3 text-white">الدور</th>
                                <th className="p-3 text-center text-white">الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.key} className="border-b border-gray-700 hover:bg-black/10">
                                    <td className="p-3 font-bold text-white">{u.name}</td>
                                    <td className="p-3 opacity-70 text-white">{u.username}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {getRoleLabel(u.role)}
                                        </span>
                                    </td>
                                    <td className="p-3 flex justify-center gap-1 md:gap-2">
                                        <button onClick={() => setRoleModal(u)} className="p-2 text-purple-400 hover:bg-purple-400/10 rounded" title="تعديل المسمى الوظيفي"><Edit2 size={16}/></button>
                                        <button onClick={() => setNotifModal({username: u.username, name: u.name})} className="p-2 text-green-400 hover:bg-green-400/10 rounded" title="إرسال رسالة تنبيه"><Send size={16}/></button>
                                        <button onClick={() => setPermModal(u)} className="p-2 text-blue-400 hover:bg-blue-400/10 rounded permission-btn" title="تعديل صلاحيات الأقسام"><Shield size={16}/></button>
                                        <button onClick={() => setPassModal({key: u.key!, name: u.name})} className="p-2 text-orange-400 hover:bg-orange-400/10 rounded" title="تغيير كلمة المرور"><Key size={16}/></button>
                                        <button onClick={() => handleDeleteUser(u.key!)} className="p-2 text-red-400 hover:bg-red-400/10 rounded" title="حذف الحساب"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* بقية النوافذ المنبثقة (كلمة السر، التنبيهات، الصلاحيات) */}
            {roleModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 p-6 rounded-2xl border border-white/10 w-full max-w-sm my-auto">
                        <h4 className="font-bold mb-4 text-white">تعديل المسمى الوظيفي: {roleModal.name}</h4>
                        <select 
                            className={inputClass} 
                            value={roleModal.role} 
                            onChange={e => setRoleModal({...roleModal, role: e.target.value})}
                        >
                            <option value="user">موظف (User)</option>
                            <option value="admin">مسؤول (Admin)</option>
                            <option value="manager">مدير (Manager)</option>
                            <option value="coordinator">منسق (Coordinator)</option>
                            <option value="supervisor">مشرف (Supervisor)</option>
                            <option value="usher">أشر (Usher)</option>
                            <option value="usher">أشر (Usher)</option>
                        </select>
                        <div className="flex gap-2 mt-4">
                            <button onClick={handleUpdateRole} className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-bold">تحديث</button>
                            <button onClick={() => setRoleModal(null)} className="flex-1 bg-white/5 text-white py-2 rounded-lg">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {passModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 p-6 rounded-2xl border border-white/10 w-full max-w-sm my-auto">
                        <h4 className="font-bold mb-4 text-white">تغيير كلمة مرور: {passModal.name}</h4>
                        <input 
                            type="password" 
                            className={inputClass} 
                            placeholder="كلمة المرور الجديدة"
                            value={newPass}
                            onChange={e => setNewPass(e.target.value)}
                        />
                        <div className="flex gap-2 mt-4">
                            <button onClick={handleUpdatePassword} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold">تحديث</button>
                            <button onClick={() => setPassModal(null)} className="flex-1 bg-white/5 text-white py-2 rounded-lg">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {permModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 p-6 rounded-2xl border border-white/10 w-full max-w-lg my-auto">
                        <h4 className="font-bold mb-6 text-white border-b pb-2 flex items-center gap-2">
                            <Shield className="text-blue-500" size={18}/> تعديل صلاحيات: {permModal.name}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                            {[
                                { key: 'showDailySales', label: 'المبيعات اليومية' },
                                { key: 'showSalesLog', label: 'سجل المبيعات' },
                                { key: 'showInventoryReg', label: 'تسجيل المخزون' },
                                { key: 'showInventoryLog', label: 'سجل المخزون' },
                                { key: 'showCompetitorPrices', label: 'أسعار المنافسين' },
                                { key: 'showCompetitorReports', label: 'تقارير المنافسين' }
                            ].map(item => (
                                <button 
                                    key={item.key} 
                                    onClick={() => toggleUserPerm(item.key as any)}
                                    className={`p-3 rounded-xl border text-sm font-bold flex justify-between items-center transition ${ (permModal.permissions as any)?.[item.key] ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}
                                >
                                    {item.label}
                                    {(permModal.permissions as any)?.[item.key] ? <ToggleRight className="text-blue-400"/> : <ToggleLeft/>}
                                </button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleUpdatePermissions} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg active:scale-95 transition">حفظ التغييرات</button>
                            <button onClick={() => setPermModal(null)} className="flex-1 bg-white/5 text-white py-3 rounded-xl">إغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {notifModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 p-6 rounded-2xl border border-white/10 w-full max-w-sm my-auto">
                        <h4 className="font-bold mb-4 text-white">إرسال رسالة تنبيه إلى: {notifModal.name}</h4>
                        <textarea 
                            className={`${inputClass} min-h-[100px] mb-4`}
                            placeholder="اكتب رسالتك هنا..."
                            value={notifMsg}
                            onChange={e => setNotifMsg(e.target.value)}
                        />
                        <div className="flex gap-2">
                            <button onClick={handleSendNotif} className="flex-1 bg-green-600 text-white py-2 rounded-lg font-bold flex items-center justify-center gap-2">
                                <Send size={16}/> إرسال الآن
                            </button>
                            <button onClick={() => setNotifModal(null)} className="flex-1 bg-white/5 text-white py-2 rounded-lg">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {editCompanyModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 p-6 rounded-2xl border border-white/10 w-full max-w-sm my-auto">
                        <h4 className="font-bold mb-4 text-white">تعديل اسم الشركة</h4>
                        <input 
                            type="text" 
                            className={inputClass} 
                            placeholder="اسم الشركة"
                            value={editCompanyModal.name}
                            onChange={e => setEditCompanyModal({...editCompanyModal, name: e.target.value})}
                        />
                        <div className="flex gap-2 mt-4">
                            <button onClick={handleUpdateCompany} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold">تحديث</button>
                            <button onClick={() => setEditCompanyModal(null)} className="flex-1 bg-white/5 text-white py-2 rounded-lg">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}

            {editMarketModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 p-6 rounded-2xl border border-white/10 w-full max-w-sm my-auto">
                        <h4 className="font-bold mb-4 text-white">تعديل اسم السوق</h4>
                        <input 
                            type="text" 
                            className={inputClass} 
                            placeholder="اسم السوق"
                            value={editMarketModal.name}
                            onChange={e => setEditMarketModal({...editMarketModal, name: e.target.value})}
                        />
                        <div className="flex gap-2 mt-4">
                            <button onClick={handleUpdateMarket} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold">تحديث</button>
                            <button onClick={() => setEditMarketModal(null)} className="flex-1 bg-white/5 text-white py-2 rounded-lg">إلغاء</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
