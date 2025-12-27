
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
    const [selectedPermUser, setSelectedPermUser] = useState<string>('');
    const [marketList, setMarketList] = useState<{key: string, val: string, createdBy?: string}[]>([]);
    const [companyList, setCompanyList] = useState<{key: string, val: string, createdBy?: string}[]>([]);
    const [newItemVal, setNewItemVal] = useState('');
    const [editingItem, setEditingItem] = useState<{key: string, val: string, type: 'market'|'company'} | null>(null);
    const [passModal, setPassModal] = useState<{key: string, name: string} | null>(null);
    const [newPass, setNewPass] = useState('');
    const [msgTargetUser, setMsgTargetUser] = useState('');
    const [msgBody, setMsgBody] = useState('');
    const [showMsgModal, setShowMsgModal] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        onValue(ref(db, 'users'), snapshot => {
            if (snapshot.exists()) {
                const u: any[] = []; snapshot.forEach(c => { u.push({ key: c.key, ...c.val() }); }); setUsers(u);
            }
        });

        onValue(ref(db, 'settings/markets'), snapshot => {
            if(snapshot.exists()){
                const m: any[] = [];
                snapshot.forEach(c => { 
                    const data = c.val();
                    m.push({
                        key: c.key, 
                        val: typeof data === 'string' ? data : data.name,
                        createdBy: typeof data === 'string' ? 'system' : data.createdBy
                    });
                });
                setMarketList(m);
            }
        });

        onValue(ref(db, 'settings/companies'), snapshot => {
            if(snapshot.exists()){
                const c: any[] = [];
                snapshot.forEach(k => { 
                    const data = k.val();
                    c.push({
                        key: k.key, 
                        val: typeof data === 'string' ? data : data.name,
                        createdBy: typeof data === 'string' ? 'system' : data.createdBy
                    });
                });
                setCompanyList(c);
            }
        });
    }, []);

    const saveSettings = async () => { await set(ref(db, 'settings/app'), localSettings); alert('تم حفظ الإعدادات'); };
    const updatePermission = (key: keyof AppSettings['permissions'], value: boolean) => setLocalSettings(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: value } }));
    const handleAddUser = async () => { if (!newUser.username || !newUser.password || !newUser.name) return; await push(ref(db, 'users'), newUser); alert("تم اضافة المستخدم"); };
    const handleDeleteUser = async (key: string) => { if (confirm("حذف المستخدم؟")) await remove(ref(db, `users/${key}`)); };
    const handleUpdatePassword = async () => { if(!passModal || !newPass) return; await set(ref(db, `users/${passModal.key}/password`), newPass); setPassModal(null); };
    const handleAddListItem = async (type: 'market' | 'company') => {
        if(!newItemVal) return;
        const path = type === 'market' ? 'settings/markets' : 'settings/companies';
        await push(ref(db, path), { name: newItemVal, createdBy: user.username });
        setNewItemVal('');
    };

    const inputClass = "w-full p-2 rounded border border-gray-300 text-black";
    const sectionClass = `p-6 rounded-lg mb-6 ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white shadow'}`;

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-10">
            <h2 className="text-3xl font-bold mb-6">الإعدادات</h2>
            <div className={sectionClass}>
                <h3 className="text-xl font-bold mb-4 border-b pb-2">إدارة الماركت والشركات (الكل)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-bold mb-2">الماركت</h4>
                        <ul className="max-h-60 overflow-y-auto space-y-1">
                            {marketList.map(m => (
                                <li key={m.key} className="flex justify-between items-center bg-black/5 p-2 rounded text-sm">
                                    <span>{m.val} <span className="text-[10px] opacity-50">({m.createdBy})</span></span>
                                    <button onClick={() => remove(ref(db, `settings/markets/${m.key}`))} className="text-red-500"><Trash2 size={14}/></button>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h4 className="font-bold mb-2">الشركات</h4>
                        <ul className="max-h-60 overflow-y-auto space-y-1">
                            {companyList.map(c => (
                                <li key={c.key} className="flex justify-between items-center bg-black/5 p-2 rounded text-sm">
                                    <span>{c.val} <span className="text-[10px] opacity-50">({c.createdBy})</span></span>
                                    <button onClick={() => remove(ref(db, `settings/companies/${c.key}`))} className="text-red-500"><Trash2 size={14}/></button>
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>
            </div>

            <div className={sectionClass}>
                <h3 className="text-xl font-bold mb-4 border-b pb-2">إدارة المستخدمين</h3>
                <div className="bg-gray-100 p-4 rounded mb-4 text-black">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        <input placeholder="الاسم" className={inputClass} value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                        <input placeholder="اسم المستخدم" className={inputClass} value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                        <input placeholder="كلمة المرور" type="password" className={inputClass} value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                        <select className={inputClass} value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                            <option value="user">مستخدم عادي</option>
                            <option value="admin">مسؤول</option>
                        </select>
                    </div>
                    <button onClick={handleAddUser} className="mt-2 bg-green-600 text-white px-4 py-1 rounded">إضافة</button>
                </div>
                <table className="w-full text-sm text-right">
                    <thead><tr className="bg-gray-200"><th>الاسم</th><th>المستخدم</th><th>الدور</th><th>إجراء</th></tr></thead>
                    <tbody>
                        {users.map(u => (
                            <tr key={u.key} className="border-b">
                                <td className="p-2">{u.name}</td><td className="p-2">{u.username}</td><td className="p-2">{u.role}</td>
                                <td className="p-2"><button onClick={() => handleDeleteUser(u.key)} className="text-red-500"><Trash2 size={16}/></button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Settings;
