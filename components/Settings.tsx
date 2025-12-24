
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { ref, set, push, onValue, remove, update, get } from "firebase/database";
import { User, AppSettings } from '../types';
import { Save, Trash2, UserPlus, Shield, Edit2, Plus, X, Lock, Key, Download, UploadCloud, Database, Send, MessageSquare, UserCheck } from 'lucide-react';

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
    
    // Permission selection state
    const [selectedPermUser, setSelectedPermUser] = useState<string>('');

    // Lists Management
    const [marketList, setMarketList] = useState<{key: string, val: string}[]>([]);
    const [companyList, setCompanyList] = useState<{key: string, val: string}[]>([]);
    const [newItemVal, setNewItemVal] = useState('');
    const [editingItem, setEditingItem] = useState<{key: string, val: string, type: 'market'|'company'} | null>(null);

    // Password Change Modal State
    const [passModal, setPassModal] = useState<{key: string, name: string} | null>(null);
    const [newPass, setNewPass] = useState('');

    // Messaging System State
    const [msgTargetUser, setMsgTargetUser] = useState('');
    const [msgBody, setMsgBody] = useState('');
    const [showMsgModal, setShowMsgModal] = useState(false);

    // File Input Ref for Restore
    const fileInputRef = useRef<HTMLInputElement>(null);

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

    const updatePermission = (key: keyof AppSettings['permissions'], value: boolean) => {
        setLocalSettings(prev => ({
            ...prev,
            permissions: {
                ...prev.permissions,
                [key]: value
            }
        }));
    };

    // --- User Specific Permission Update ---
    const handleToggleUserViewAll = async (userKey: string, currentVal: boolean) => {
        try {
            await update(ref(db, `users/${userKey}`), { canViewAllSales: !currentVal });
            alert("تم تحديث صلاحية المستخدم");
        } catch (e) {
            console.error(e);
            alert("حدث خطأ في التحديث");
        }
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

    const handleUpdatePassword = async () => {
        if(!passModal || !newPass) return alert("ادخل كلمة المرور الجديدة");
        try {
            await set(ref(db, `users/${passModal.key}/password`), newPass);
            alert("تم تغيير كلمة المرور بنجاح");
            setPassModal(null);
            setNewPass('');
        } catch (e) {
            console.error(e);
            alert("حدث خطأ");
        }
    };
    
    const handleUpdateCode = async (key: string, newCode: string) => {
        try {
            await update(ref(db, `users/${key}`), { code: newCode });
        } catch (e) {
            console.error("Error updating code:", e);
        }
    };

    // --- Messaging System ---
    const handleSendMessage = async () => {
        if (!msgTargetUser || !msgBody.trim()) return alert("يرجى اختيار المستخدم وكتابة الرسالة");
        
        try {
            const notifData = {
                message: msgBody,
                sender: 'الإدارة',
                timestamp: Date.now(),
                isRead: false
            };
            
            // We use the username as the key for notifications path: notifications/{username}
            await push(ref(db, `notifications/${msgTargetUser}`), notifData);
            
            alert("تم إرسال الرسالة بنجاح");
            setMsgBody('');
            setShowMsgModal(false);
        } catch (e) {
            console.error(e);
            alert("فشل الإرسال");
        }
    };


    // --- Backup & Restore Logic ---
    const handleBackup = async () => {
        try {
            const rootRef = ref(db);
            const snapshot = await get(rootRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                const jsonString = JSON.stringify(data, null, 2);
                const blob = new Blob([jsonString], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                
                const link = document.createElement('a');
                link.href = url;
                link.download = `SoftRose_Backup_${new Date().toISOString().slice(0,10)}.json`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                alert("تم تحميل النسخة الاحتياطية بنجاح");
            } else {
                alert("لا توجد بيانات للنسخ");
            }
        } catch (error) {
            console.error("Backup error:", error);
            alert("فشل في إنشاء النسخة الاحتياطية");
        }
    };

    const handleRestoreTrigger = () => {
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleRestoreFile = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const content = e.target?.result;
                if (typeof content === 'string') {
                    const data = JSON.parse(content);
                    
                    if(confirm("تحذير: استعادة البيانات ستقوم باستبدال البيانات الحالية بالبيانات الموجودة في الملف المختار. هل أنت متأكد؟")) {
                        await update(ref(db), data);
                        alert("تم استعادة البيانات بنجاح!");
                        window.location.reload(); // Reload to refresh state
                    }
                }
            } catch (error) {
                console.error("Restore error:", error);
                alert("الملف غير صالح أو تالف");
            }
        };
        reader.readAsText(file);
        // Reset input
        event.target.value = '';
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

    const activeUserPerm = users.find(u => u.username === selectedPermUser);

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

                {/* Global Module Permissions Section */}
                <h4 className="font-bold mt-6 mb-3 flex items-center gap-2 border-t pt-4"><Shield size={18} className="text-indigo-500"/> صلاحيات العرض العامة (لجميع الموظفين)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-100 dark:bg-gray-900 p-4 rounded text-sm">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4"
                            checked={localSettings.permissions?.showSalesLog || false}
                            onChange={e => updatePermission('showSalesLog', e.target.checked)}
                        />
                        <span className="text-black dark:text-gray-300">عرض "سجل المبيعات" للموظفين</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4"
                            checked={localSettings.permissions?.showInventoryReg || false}
                            onChange={e => updatePermission('showInventoryReg', e.target.checked)}
                        />
                        <span className="text-black dark:text-gray-300">عرض "تسجيل المخزون" للموظفين</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4"
                            checked={localSettings.permissions?.showInventoryLog || false}
                            onChange={e => updatePermission('showInventoryLog', e.target.checked)}
                        />
                        <span className="text-black dark:text-gray-300">عرض "سجل المخزون" للموظفين</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="w-4 h-4"
                            checked={localSettings.permissions?.showCompetitorReports || false}
                            onChange={e => updatePermission('showCompetitorReports', e.target.checked)}
                        />
                        <span className="text-black dark:text-gray-300">عرض "تقارير المنافسين" للموظفين</span>
                    </label>
                </div>

                {/* Individual User Permissions Section */}
                <h4 className="font-bold mt-6 mb-3 flex items-center gap-2 border-t pt-4"><UserCheck size={18} className="text-green-500"/> صلاحيات الحسابات الفردية</h4>
                <div className="space-y-4 bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl">
                    <div>
                        <label className="block mb-1 text-xs font-bold text-blue-600">اختر حساب الموظف للتحكم بصلاحياته</label>
                        <select 
                            className={inputClass} 
                            value={selectedPermUser} 
                            onChange={e => setSelectedPermUser(e.target.value)}
                        >
                            <option value="">-- اختر مستخدم --</option>
                            {users.map(u => <option key={u.key} value={u.username}>{u.name} (@{u.username})</option>)}
                        </select>
                    </div>

                    {activeUserPerm ? (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                             <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center justify-between">
                                <div>
                                    <div className="font-bold text-sm">صلاحية "رؤية جميع مبيعات الموظفين"</div>
                                    <div className="text-[10px] opacity-60">في حال التفعيل، سيتمكن هذا الحساب من رؤية سجلات مبيعات جميع الزملاء، وإلا سيرى مبيعاته فقط.</div>
                                </div>
                                <div 
                                    onClick={() => handleToggleUserViewAll(activeUserPerm.key, activeUserPerm.canViewAllSales || false)}
                                    className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors duration-300 relative ${activeUserPerm.canViewAllSales ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-300 shadow ${activeUserPerm.canViewAllSales ? 'translate-x-6' : 'translate-x-0'}`} />
                                </div>
                             </div>
                        </div>
                    ) : (
                        <div className="text-center py-2 text-xs opacity-50 italic">الرجاء اختيار مستخدم لتعديل صلاحياته الفردية</div>
                    )}
                </div>

                <button onClick={saveSettings} className="mt-6 bg-blue-600 text-white px-6 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg hover:bg-blue-700 transition">
                    <Save size={18} /> حفظ جميع التغييرات العامة
                </button>
            </div>

            {/* Messaging System */}
            <div className={sectionClass}>
                 <h3 className="text-xl font-bold mb-4 border-b pb-2 flex items-center gap-2">
                    <MessageSquare size={20} className="text-blue-500"/>
                    إرسال رسائل إدارية
                 </h3>
                 <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block mb-1 text-sm font-bold">اختر المستلم</label>
                        <select 
                            className={inputClass} 
                            value={msgTargetUser} 
                            onChange={e => setMsgTargetUser(e.target.value)}
                        >
                            <option value="">اختر حساب الموظف...</option>
                            {users.map(u => (
                                <option key={u.key} value={u.username}>{u.name} ({u.username})</option>
                            ))}
                        </select>
                    </div>
                    <button 
                        onClick={() => {
                            if(!msgTargetUser) return alert("اختر الحساب اولا");
                            setShowMsgModal(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-6 rounded font-bold flex items-center gap-2 transition"
                    >
                        <Edit2 size={18} />
                        اكتب الرسالة
                    </button>
                 </div>
            </div>

            {/* Backup and Restore Section */}
            <div className={sectionClass}>
                 <h3 className="text-xl font-bold mb-4 border-b pb-2 flex items-center gap-2">
                    <Database size={20} className="text-purple-500"/>
                    إدارة البيانات والنسخ الاحتياطي
                 </h3>
                 <div className="flex flex-col md:flex-row gap-4">
                    <button 
                        onClick={handleBackup}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition"
                    >
                        <Download size={20} />
                        نسخة احتياطية (تنزيل)
                    </button>
                    
                    <button 
                        onClick={handleRestoreTrigger}
                        className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition"
                    >
                        <UploadCloud size={20} />
                        استعادة بيانات (Recovery)
                    </button>
                    <input 
                        type="file" 
                        accept=".json" 
                        ref={fileInputRef} 
                        className="hidden" 
                        onChange={handleRestoreFile}
                    />
                 </div>
                 <p className="mt-2 text-xs opacity-70">
                    * النسخ الاحتياطي يقوم بتحميل ملف يحتوي على جميع البيانات.
                    <br/>
                    * استعادة البيانات ستقوم باستبدال البيانات الحالية بالبيانات الموجودة في الملف المختار.
                 </p>
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
                                <span className="text-black dark:text-gray-300">{m.val}</span>
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
                                <span className="text-black dark:text-gray-300">{c.val}</span>
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
                            <label>السماح برؤية مبيعات الجميع افتراضياً</label>
                        </div>
                    </div>
                    <button onClick={handleAddUser} className="mt-2 bg-green-600 text-white px-4 py-1 rounded">إضافة</button>
                </div>

                {/* Users List */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                        <thead>
                            <tr className="bg-gray-500/20 text-black dark:text-gray-300">
                                <th className="p-2">الاسم</th>
                                <th className="p-2">المستخدم</th>
                                <th className="p-2">الدور</th>
                                <th className="p-2">الكود</th>
                                <th className="p-2">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.key} className="border-b border-gray-500/10 text-black dark:text-gray-300">
                                    <td className="p-2">{u.name}</td>
                                    <td className="p-2">{u.username}</td>
                                    <td className="p-2">
                                        {u.role === 'admin' ? <span className="bg-red-100 text-red-800 px-2 rounded flex items-center gap-1 w-fit"><Shield size={12}/> Admin</span> : 'مستخدم'}
                                    </td>
                                    <td className="p-2">
                                        <input 
                                            defaultValue={u.code}
                                            onBlur={(e) => {
                                                if (e.target.value !== u.code) {
                                                     handleUpdateCode(u.key, e.target.value);
                                                }
                                            }}
                                            className="w-24 p-1 rounded border border-gray-300 text-center text-black focus:border-blue-500 outline-none"
                                            placeholder="-"
                                        />
                                    </td>
                                    <td className="p-2 flex gap-2">
                                        <button 
                                            onClick={() => setPassModal({key: u.key, name: u.name})} 
                                            className="text-yellow-600 hover:text-yellow-800 bg-yellow-100 p-1 rounded"
                                            title="تغيير كلمة المرور"
                                        >
                                            <Key size={16} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteUser(u.key)} 
                                            className="text-red-600 hover:text-red-800 bg-red-100 p-1 rounded"
                                            title="حذف المستخدم"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            
            {/* Change Password Modal */}
            {passModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className={`p-6 rounded-lg w-full max-sm shadow-2xl ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}>
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                            <Key size={20} className="text-yellow-500" />
                            تغيير كلمة مرور: <span className="text-blue-500">{passModal.name}</span>
                        </h3>
                        <input 
                            type="text" 
                            value={newPass} 
                            onChange={e => setNewPass(e.target.value)}
                            className="w-full border p-3 rounded text-black mb-6 bg-gray-50"
                            placeholder="كلمة المرور الجديدة"
                        />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setPassModal(null)} className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded transition">إلغاء</button>
                            <button onClick={handleUpdatePassword} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold transition">حفظ التغيير</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Message Sending Modal */}
            {showMsgModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
                    <div className={`p-6 rounded-lg w-full max-w-lg shadow-2xl ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}>
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <Send size={20} className="text-blue-500" />
                                إرسال رسالة إلى: <span className="text-blue-600">{users.find(u => u.username === msgTargetUser)?.name}</span>
                            </h3>
                            <button onClick={() => setShowMsgModal(false)}><X /></button>
                        </div>
                        
                        <textarea 
                            value={msgBody}
                            onChange={e => setMsgBody(e.target.value)}
                            maxLength={1000}
                            className="w-full h-40 border p-3 rounded-lg resize-none text-black bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="اكتب رسالتك هنا (بحد أقصى 1000 حرف)..."
                        ></textarea>
                        
                        <div className="text-xs text-right mt-1 opacity-60">
                            {msgBody.length} / 1000
                        </div>

                        <div className="flex justify-end gap-3 mt-4">
                            <button onClick={() => setShowMsgModal(false)} className="px-6 py-2 bg-gray-500 text-white rounded hover:bg-gray-600">إلغاء</button>
                            <button onClick={handleSendMessage} className="px-6 py-2 bg-blue-600 text-white rounded font-bold hover:bg-blue-700 flex items-center gap-2">
                                <Send size={16} /> إرسال
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
