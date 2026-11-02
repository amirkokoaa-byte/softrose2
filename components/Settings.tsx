import { onCachedValue } from "../firebaseCache";

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, set, push, onValue, remove, update, get } from "firebase/database";
import { User, AppSettings, UserPermissions, AppNotification } from '../types';
import { 
  Save, Trash2, UserPlus, Shield, Edit2, Plus, X, 
  Settings as SettingsIcon, Users, MapPin, Building2, 
  ToggleLeft, ToggleRight, Key, Send, Smartphone, Link as LinkIcon, Download,
  ArrowRight, ArrowLeft, Eye, EyeOff
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
    const [employeeActionModal, setEmployeeActionModal] = useState<User | null>(null);
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
        if (user.role !== 'admin' && user.role !== 'manager' && !user.permissions?.showSettings) return;

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
            showDailySales: true,
            showSalesLog: false,
            showInventoryReg: false,
            showInventoryLog: false,
            showCompetitorPrices: true,
            showCompetitorReports: false,
            showProductsRegistry: true,
            showCustomerFeedback: true,
            showLeaveBalance: true,
            showAttendance: true,
            showBranchNumbers: true,
            showEmployees: false,
            showSettings: false
        };
        if (permModal.key === 'admin_root' || permModal.role === 'admin') {
            await update(ref(db, 'settings/app'), {
                adminBottomBarOrder: permModal.bottomBarOrder || [],
                adminBottomBarHidden: permModal.bottomBarHidden || []
            });
            if (permModal.key !== 'admin_root') {
                await update(ref(db, `users/${permModal.key}`), {
                    permissions,
                    canViewAllSales: true,
                    bottomBarOrder: permModal.bottomBarOrder || [],
                    bottomBarHidden: permModal.bottomBarHidden || []
                });
            }
        } else {
            await update(ref(db, `users/${permModal.key}`), { 
                permissions: permissions,
                canViewAllSales: !!permModal.canViewAllSales,
                bottomBarOrder: permModal.bottomBarOrder || [],
                bottomBarHidden: permModal.bottomBarHidden || []
            });
        }
        alert("تم تحديث وحفظ الصلاحيات وإعدادات الشريط السفلي بنجاح");
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

    const ALL_SIDE_TABS: { key: keyof UserPermissions; label: string }[] = [
        { key: 'showDailySales', label: 'المبيعات اليومية' },
        { key: 'showSalesLog', label: 'سجل المبيعات' },
        { key: 'showInventoryReg', label: 'تسجيل المخزون' },
        { key: 'showInventoryLog', label: 'سجل المخزون' },
        { key: 'showCompetitorPrices', label: 'أسعار المنافسين' },
        { key: 'showCompetitorReports', label: 'تقارير المنافسين' },
        { key: 'showProductsRegistry', label: 'سجل المنتجات' },
        { key: 'showCustomerFeedback', label: 'الشكاوي و المقترحات' },
        { key: 'showLeaveBalance', label: 'رصيد الإجازات' },
        { key: 'showAttendance', label: 'الحضور والانصراف' },
        { key: 'showBranchNumbers', label: 'أرقام الفروع' },
        { key: 'showEmployees', label: 'الموظفين' },
        { key: 'showSettings', label: 'الإعدادات' },
    ];

    const toggleUserPerm = async (key: keyof UserPermissions) => {
        if (!permModal || !permModal.key) return;
        const currentPermissions: UserPermissions = {
            showDailySales: true,
            showSalesLog: false,
            showInventoryReg: false,
            showInventoryLog: false,
            showCompetitorPrices: true,
            showCompetitorReports: false,
            showProductsRegistry: true,
            showCustomerFeedback: true,
            showLeaveBalance: true,
            showAttendance: true,
            showBranchNumbers: true,
            showEmployees: false,
            showSettings: false,
            ...(permModal.permissions || {})
        };
        const nextVal = !currentPermissions[key];
        const updatedPermissions = {
            ...currentPermissions,
            [key]: nextVal
        };
        setPermModal({
            ...permModal,
            permissions: updatedPermissions
        });

        // تحديث فوري ولحظي في قاعدة البيانات للموظف لكي تظهر له الخانة الجانبية فوراً
        try {
            await update(ref(db, `users/${permModal.key}/permissions`), {
                [key]: nextVal
            });
        } catch (e) {
            console.error("Error updating permission in real-time:", e);
        }
    };

    const handleSetAllPerms = async (enable: boolean) => {
        if (!permModal || !permModal.key) return;
        const newPerms: any = {};
        ALL_SIDE_TABS.forEach(t => {
            newPerms[t.key] = enable;
        });
        setPermModal({
            ...permModal,
            permissions: newPerms
        });
        try {
            await update(ref(db, `users/${permModal.key}/permissions`), newPerms);
        } catch (e) {
            console.error("Error setting all permissions:", e);
        }
    };

    // أزرار الشريط السفلي للهاتف (للموظفين والمنسقين وللمدير العام)
    const EMPLOYEE_BOTTOM_BAR_ITEMS = [
        { id: 'sales', label: 'المبيعات (المبيعات اليومية)' },
        { id: 'salesLog', label: 'سجل بيع (سجل المبيعات)' },
        { id: 'competitorPrices', label: 'الاسعار (أسعار المنافسين)' },
        { id: 'leaveBalance', label: 'الاجازات (رصيد الإجازات)' },
        { id: 'customerFeedback', label: 'الشكاوي (الشكاوي والمقترحات)' },
        { id: 'attendance', label: 'تسجيل حضور (الحضور والانصراف)' },
        { id: 'menu', label: 'القائمه (فتح القائمة الجانبية)' }
    ];

    const ADMIN_BOTTOM_BAR_ITEMS = [
        { id: 'admin_salesLog', label: 'سجل المبيعات' },
        { id: 'admin_competitorReports', label: 'اسعار (تقارير المنافسين)' },
        { id: 'admin_leaveBalance', label: 'رصيد الاجازات' },
        { id: 'admin_addLeave', label: 'تسجيل اجازه (فتح نافذة تسجيل إجازة)' },
        { id: 'admin_attendance', label: 'تسجيل حضور' },
        { id: 'admin_priceComparison', label: 'مقارنه سعر (فتح نافذة المقارنة)' }
    ];

    const getModalBottomBarList = (targetUser: User) => {
        const isAdminUser = targetUser.role === 'admin' || targetUser.key === 'admin_root';
        const baseItems = isAdminUser ? ADMIN_BOTTOM_BAR_ITEMS : EMPLOYEE_BOTTOM_BAR_ITEMS;
        const savedOrder = isAdminUser
            ? (targetUser.bottomBarOrder || localSettings.adminBottomBarOrder || [])
            : (targetUser.bottomBarOrder || []);
        const defaultOrder = baseItems.map(i => i.id);
        const mergedOrder = [
            ...savedOrder.filter(id => defaultOrder.includes(id)),
            ...defaultOrder.filter(id => !savedOrder.includes(id))
        ];
        return mergedOrder.map(id => baseItems.find(i => i.id === id)!).filter(Boolean);
    };

    const isBottomBarItemHidden = (targetUser: User, itemId: string) => {
        const isAdminUser = targetUser.role === 'admin' || targetUser.key === 'admin_root';
        if (isAdminUser) {
            const hidden = targetUser.bottomBarHidden || localSettings.adminBottomBarHidden || [];
            return hidden.includes(itemId);
        }
        if (targetUser.bottomBarHidden) {
            return targetUser.bottomBarHidden.includes(itemId);
        }
        // الافتراضي للموظف مقابل المنسق إذا لم يتم تخصيصه بعد
        const isCoordinator = targetUser.role === 'coordinator' || targetUser.role === 'merchandiser';
        if (isCoordinator) {
            return itemId === 'sales' || itemId === 'salesLog';
        } else {
            return itemId === 'competitorPrices';
        }
    };

    const toggleBottomBarItemVisibility = async (itemId: string) => {
        if (!permModal) return;
        const isAdminUser = permModal.role === 'admin' || permModal.key === 'admin_root';
        const baseItems = isAdminUser ? ADMIN_BOTTOM_BAR_ITEMS : EMPLOYEE_BOTTOM_BAR_ITEMS;

        let currentHidden: string[] = [];
        if (isAdminUser) {
            currentHidden = [...(permModal.bottomBarHidden || localSettings.adminBottomBarHidden || [])];
        } else if (permModal.bottomBarHidden) {
            currentHidden = [...permModal.bottomBarHidden];
        } else {
            currentHidden = baseItems.filter(i => isBottomBarItemHidden(permModal, i.id)).map(i => i.id);
        }

        const nextHidden = currentHidden.includes(itemId)
            ? currentHidden.filter(id => id !== itemId)
            : [...currentHidden, itemId];

        const currentOrder = getModalBottomBarList(permModal).map(i => i.id);
        const updatedUser = {
            ...permModal,
            bottomBarHidden: nextHidden,
            bottomBarOrder: currentOrder
        };
        setPermModal(updatedUser);

        try {
            if (isAdminUser) {
                setLocalSettings(prev => ({
                    ...prev,
                    adminBottomBarHidden: nextHidden,
                    adminBottomBarOrder: currentOrder
                }));
                await update(ref(db, 'settings/app'), {
                    adminBottomBarHidden: nextHidden,
                    adminBottomBarOrder: currentOrder
                });
                if (permModal.key && permModal.key !== 'admin_root') {
                    await update(ref(db, `users/${permModal.key}`), {
                        bottomBarHidden: nextHidden,
                        bottomBarOrder: currentOrder
                    });
                }
            } else if (permModal.key) {
                await update(ref(db, `users/${permModal.key}`), {
                    bottomBarHidden: nextHidden,
                    bottomBarOrder: currentOrder
                });
            }
        } catch (err) {
            console.error('Error updating bottom bar visibility:', err);
        }
    };

    const moveBottomBarItemOrder = async (index: number, direction: 'right' | 'left') => {
        if (!permModal) return;
        const list = getModalBottomBarList(permModal);
        // في التخطيط العربي من اليمين إلى اليسار: اليمين يعني فهرس أقل (-1) واليسار يعني فهرس أكبر (+1)
        const targetIndex = direction === 'right' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= list.length) return;

        const newOrder = list.map(i => i.id);
        const [moved] = newOrder.splice(index, 1);
        newOrder.splice(targetIndex, 0, moved);

        const isAdminUser = permModal.role === 'admin' || permModal.key === 'admin_root';
        const baseItems = isAdminUser ? ADMIN_BOTTOM_BAR_ITEMS : EMPLOYEE_BOTTOM_BAR_ITEMS;
        const currentHidden = permModal.bottomBarHidden
            ? permModal.bottomBarHidden
            : baseItems.filter(i => isBottomBarItemHidden(permModal, i.id)).map(i => i.id);

        const updatedUser = {
            ...permModal,
            bottomBarOrder: newOrder,
            bottomBarHidden: currentHidden
        };
        setPermModal(updatedUser);

        try {
            if (isAdminUser) {
                setLocalSettings(prev => ({
                    ...prev,
                    adminBottomBarOrder: newOrder,
                    adminBottomBarHidden: currentHidden
                }));
                await update(ref(db, 'settings/app'), {
                    adminBottomBarOrder: newOrder,
                    adminBottomBarHidden: currentHidden
                });
                if (permModal.key && permModal.key !== 'admin_root') {
                    await update(ref(db, `users/${permModal.key}`), {
                        bottomBarOrder: newOrder,
                        bottomBarHidden: currentHidden
                    });
                }
            } else if (permModal.key) {
                await update(ref(db, `users/${permModal.key}`), {
                    bottomBarOrder: newOrder,
                    bottomBarHidden: currentHidden
                });
            }
        } catch (err) {
            console.error('Error reordering bottom bar items:', err);
        }
    };

    const displayedUsersList: User[] = React.useMemo(() => {
        const hasAdminAccount = users.some(u => u.role === 'admin' || u.username === 'admin' || u.name === 'المدير العام');
        if (hasAdminAccount) {
            return users.map(u => {
                if (u.role === 'admin' || u.username === 'admin' || u.name === 'المدير العام') {
                    return {
                        ...u,
                        bottomBarOrder: u.bottomBarOrder || localSettings.adminBottomBarOrder,
                        bottomBarHidden: u.bottomBarHidden || localSettings.adminBottomBarHidden
                    };
                }
                return u;
            });
        }
        const adminEntry: User = {
            key: 'admin_root',
            name: 'المدير العام',
            username: 'admin',
            role: 'admin',
            permissions: {
                showDailySales: true,
                showSalesLog: true,
                showInventoryReg: true,
                showInventoryLog: true,
                showCompetitorPrices: true,
                showCompetitorReports: true,
                showProductsRegistry: true,
                showCustomerFeedback: true,
                showLeaveBalance: true,
                showAttendance: true,
                showBranchNumbers: true,
                showEmployees: true,
                showSettings: true
            },
            bottomBarOrder: localSettings.adminBottomBarOrder,
            bottomBarHidden: localSettings.adminBottomBarHidden
        };
        return [adminEntry, ...users];
    }, [users, localSettings.adminBottomBarOrder, localSettings.adminBottomBarHidden]);

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

    if (user.role !== 'admin' && user.role !== 'manager' && !user.permissions?.showSettings) {
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
                <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center gap-2 text-blue-500 border-b border-gray-700 pb-3">
                    <Edit2 size={20} /> الإعدادات العامة للمنصة
                </h3>
                {/* في نسخة الهاتف: اسم التطبيق بجانب رقم الواتساب وأسفلهم نص الشريط المتحرك */}
                <div className="grid grid-cols-2 gap-2.5 sm:gap-6">
                    <div className="min-w-0">
                        <label className="block text-xs sm:text-sm font-bold mb-1.5 opacity-80 text-white truncate">اسم التطبيق (AppName)</label>
                        <input className={`${inputClass} text-xs sm:text-sm p-2 sm:p-2.5`} value={localSettings.appName || ''} onChange={e => setLocalSettings({...localSettings, appName: e.target.value})} />
                    </div>
                    <div className="min-w-0">
                        <label className="block text-xs sm:text-sm font-bold mb-1.5 opacity-80 text-white truncate">رقم واتساب الدعم</label>
                        <input className={`${inputClass} text-xs sm:text-sm p-2 sm:p-2.5`} placeholder="2010XXXXXXXX" value={localSettings.whatsappNumber || ''} onChange={e => setLocalSettings({...localSettings, whatsappNumber: e.target.value})} />
                    </div>
                    <div className="col-span-2 text-white min-w-0">
                        <label className="block text-xs sm:text-sm font-bold mb-1.5 opacity-80">نص الشريط المتحرك (Ticker Text)</label>
                        <div className="flex gap-2">
                            <input className={`${inputClass} text-xs sm:text-sm p-2 sm:p-2.5 flex-1 min-w-0`} value={localSettings.tickerText || ''} onChange={e => setLocalSettings({...localSettings, tickerText: e.target.value})} />
                            <button 
                                onClick={() => setLocalSettings({...localSettings, tickerEnabled: !localSettings.tickerEnabled})}
                                className={`px-3 sm:px-4 rounded-lg flex items-center gap-1.5 font-bold text-xs sm:text-sm shrink-0 ${localSettings.tickerEnabled ? 'bg-green-600 text-white' : 'bg-gray-300 text-gray-700'}`}
                            >
                                {localSettings.tickerEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />} {localSettings.tickerEnabled ? 'مفعل' : 'معطل'}
                            </button>
                        </div>
                    </div>
                </div>
                <button onClick={saveAppSettings} className="mt-5 w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition transform active:scale-95">
                    <Save size={20} /> حفظ الإعدادات العامة
                </button>
            </div>

            {/* إعدادات التطبيق (روابط التحميل والتثبيت) */}
            <div className={sectionClass}>
                <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center gap-2 text-cyan-400 border-b border-gray-700 pb-3">
                    <Smartphone size={22} /> إعدادات التطبيق
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    <div>
                        <label className="block text-sm font-bold mb-2 opacity-80 text-white flex items-center gap-1.5">
                            <LinkIcon size={15} className="text-cyan-400" />
                            <span>أضف رابط</span>
                        </label>
                        <input
                            type="url"
                            dir="ltr"
                            placeholder="https://example.com/file.apk"
                            className={inputClass}
                            value={localSettings.appDownloadLink || ''}
                            onChange={e => setLocalSettings({ ...localSettings, appDownloadLink: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2 opacity-80 text-white flex items-center gap-1.5">
                            <Download size={15} className="text-cyan-400" />
                            <span>لنك التطبيق</span>
                        </label>
                        <input
                            type="url"
                            dir="ltr"
                            placeholder="https://example.com/app"
                            className={inputClass}
                            value={localSettings.appStoreLink || ''}
                            onChange={e => setLocalSettings({ ...localSettings, appStoreLink: e.target.value })}
                        />
                    </div>
                </div>
                <button
                    onClick={saveAppSettings}
                    className="mt-6 w-full bg-cyan-600 hover:bg-cyan-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition transform active:scale-95 cursor-pointer"
                >
                    <Save size={20} /> حفظ
                </button>
            </div>

            {/* إدارة البيانات */}
            <div className={sectionClass}>
                <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center gap-2 text-green-500 border-b border-gray-700 pb-3">
                    <Save size={20} /> إدارة البيانات (نسخ احتياطي واستعادة)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
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

            {/* إدارة الشركات والأسواق - في نسخة الهاتف تصغير مساحة الشركات المسجلة وإظهار اسم الماركت بشكل كامل مهما كان كبير */}
            <div className={sectionClass}>
                <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center gap-2 text-yellow-500 border-b border-gray-700 pb-3">
                    <Building2 size={20} /> إدارة الشركات والأسواق
                </h3>
                <div className="grid grid-cols-12 gap-2 sm:gap-6 w-full min-w-0">
                    {/* الشركات المسجلة (مصغرة ومضمومة قليلاً في الهاتف) */}
                    <div className="col-span-5 sm:col-span-5 min-w-0">
                        <h4 className="font-bold mb-2.5 sm:mb-4 text-white flex items-center gap-1 text-[11px] sm:text-base truncate">
                            <Building2 size={13} className="shrink-0 text-yellow-400"/>
                            <span className="truncate">الشركات المسجلة</span>
                        </h4>
                        <div className="flex gap-1 sm:gap-2 mb-3">
                            <input 
                                className={`${inputClass} p-1.5 sm:p-2.5 text-[10px] sm:text-sm min-w-0`} 
                                placeholder="شركة جديدة" 
                                value={newCompanyName} 
                                onChange={e => setNewCompanyName(e.target.value)} 
                            />
                            <button 
                                onClick={handleAddCompany} 
                                className="bg-green-600 hover:bg-green-700 text-white px-2 sm:px-4 rounded-lg font-bold flex items-center justify-center transition shrink-0"
                            >
                                <Plus size={15} />
                            </button>
                        </div>
                        <div className="space-y-1.5 sm:space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-0.5 sm:pr-2">
                            {companyList.map(c => (
                                <div key={c.key} className="flex justify-between items-center gap-1 bg-gray-700/50 p-1.5 sm:p-3 rounded-xl border border-gray-600 min-w-0">
                                    <span className="font-bold text-white text-[10px] sm:text-sm truncate min-w-0 flex-1" title={c.name}>{c.name}</span>
                                    <div className="flex gap-0.5 sm:gap-1 shrink-0">
                                        <button onClick={() => setEditCompanyModal(c)} className="text-blue-400 hover:bg-blue-400/10 p-1 sm:p-2 rounded-lg transition">
                                            <Edit2 size={12}/>
                                        </button>
                                        <button onClick={() => handleDeleteCompany(c.key)} className="text-red-400 hover:bg-red-400/10 p-1 sm:p-2 rounded-lg transition">
                                            <Trash2 size={12}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {companyList.length === 0 && <div className="text-center opacity-50 text-xs py-4">لا توجد شركات</div>}
                        </div>
                    </div>

                    {/* الأسواق المسجلة (تأخذ مساحة أوسع ويظهر اسم الماركت بشكل كامل مهما كان كبير) */}
                    <div className="col-span-7 sm:col-span-7 min-w-0">
                        <h4 className="font-bold mb-2.5 sm:mb-4 text-white flex items-center gap-1 text-xs sm:text-base truncate">
                            <MapPin size={14} className="shrink-0 text-yellow-400"/>
                            <span className="truncate">الأسواق المسجلة</span>
                        </h4>
                        <div className="flex gap-1 sm:gap-2 mb-3">
                            <input 
                                className={`${inputClass} p-1.5 sm:p-2.5 text-[11px] sm:text-sm min-w-0`} 
                                placeholder="سوق جديد" 
                                value={newMarketName} 
                                onChange={e => setNewMarketName(e.target.value)} 
                            />
                            <button 
                                onClick={handleAddMarket} 
                                className="bg-green-600 hover:bg-green-700 text-white px-2 sm:px-4 rounded-lg font-bold flex items-center justify-center transition shrink-0"
                            >
                                <Plus size={16} />
                            </button>
                        </div>
                        <div className="space-y-1.5 sm:space-y-2 max-h-60 overflow-y-auto custom-scrollbar pr-0.5 sm:pr-2">
                            {marketList.map(m => (
                                <div key={m.key} className="flex justify-between items-center gap-1.5 bg-gray-700/50 p-2 sm:p-3 rounded-xl border border-gray-600 min-w-0">
                                    <span className="font-bold text-white text-[11px] sm:text-sm whitespace-normal break-words leading-snug min-w-0 flex-1">
                                        {m.name}
                                    </span>
                                    <div className="flex gap-0.5 sm:gap-1 shrink-0">
                                        <button onClick={() => setEditMarketModal(m)} className="text-blue-400 hover:bg-blue-400/10 p-1 sm:p-2 rounded-lg transition">
                                            <Edit2 size={13}/>
                                        </button>
                                        <button onClick={() => handleDeleteMarket(m.key)} className="text-red-400 hover:bg-red-400/10 p-1 sm:p-2 rounded-lg transition">
                                            <Trash2 size={13}/>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {marketList.length === 0 && <div className="text-center opacity-50 text-xs py-4">لا توجد أسواق</div>}
                        </div>
                    </div>
                </div>
            </div>

            {/* إدارة المستخدمين */}
            <div className={sectionClass}>
                <h3 className="text-lg sm:text-xl font-bold mb-4 sm:mb-6 flex items-center gap-2 text-purple-400 border-b border-gray-700 pb-3">
                    <Users size={20} /> إدارة حسابات وصلاحيات الموظفين
                </h3>
                
                {/* إضافة مستخدم جديد: في الهاتف الاسم الكامل بجانب اسم المستخدم وأسفلهم كلمة المرور بجانب الوظيفة */}
                <div className="bg-gray-700/50 p-3.5 sm:p-6 rounded-2xl mb-5 border border-gray-600">
                    <h4 className="font-bold mb-3 sm:mb-4 flex items-center gap-2 text-xs sm:text-sm text-white"><UserPlus size={16}/> إضافة موظف جديد</h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4">
                        <input className={`${inputClass} text-xs sm:text-sm p-2 sm:p-2.5 min-w-0`} placeholder="الاسم الكامل" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} />
                        <input className={`${inputClass} text-xs sm:text-sm p-2 sm:p-2.5 min-w-0`} placeholder="اسم المستخدم" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
                        <input className={`${inputClass} text-xs sm:text-sm p-2 sm:p-2.5 min-w-0`} type="password" placeholder="كلمة المرور" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
                        <select className={`${inputClass} text-xs sm:text-sm p-2 sm:p-2.5 min-w-0`} value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})}>
                            <option value="user">موظف (User)</option>
                            <option value="admin">مسؤول (Admin)</option>
                            <option value="manager">مدير (Manager)</option>
                            <option value="coordinator">منسق (Coordinator)</option>
                            <option value="supervisor">مشرف (Supervisor)</option>
                            <option value="usher">أشر (Usher)</option>
                        </select>
                    </div>
                    <button onClick={handleAddUser} className="mt-3.5 w-full bg-green-600 text-white font-bold py-2.5 rounded-lg hover:bg-green-700 transition shadow-lg text-xs sm:text-sm">إضافة الموظف</button>
                </div>

                {/* الحسابات المسجلة: في نسخة الهاتف يختفي لاين الاسم الإنجليزي ويظهر فقط المستخدم (باللغة العربية) والدور والإجراءات في سطر واحد بدون اختفاء أي جزء من الأزرار */}
                <div className="w-full overflow-hidden rounded-2xl border border-gray-700 bg-gray-900/50">
                    {/* ترويسة الجدول */}
                    <div className="grid grid-cols-12 items-center gap-1 bg-gray-700/80 px-2 sm:px-4 py-2.5 text-[11px] sm:text-sm font-black text-white">
                        <div className="hidden sm:block sm:col-span-3 text-right truncate">الاسم (اضغط للمراسلة)</div>
                        <div className="col-span-5 sm:col-span-3 text-right truncate">المستخدم</div>
                        <div className="col-span-2 sm:col-span-2 text-center truncate">الدور</div>
                        <div className="col-span-5 sm:col-span-4 text-center truncate">الإجراءات</div>
                    </div>

                    <div className="divide-y divide-gray-700/70">
                        {displayedUsersList.map(u => {
                            const isVirtualAdmin = u.key === 'admin_root';
                            // في الهاتف يظهر الموظف باللغة العربية في خانة المستخدم
                            const hasArabicInName = /[\u0600-\u06FF]/.test(u.name || '');
                            const hasArabicInUsername = /[\u0600-\u06FF]/.test(u.username || '');
                            const mobileArabicLabel = hasArabicInName ? u.name : (hasArabicInUsername ? u.username : (u.name || u.username));

                            return (
                                <div
                                    key={u.key || u.username}
                                    className="grid grid-cols-12 items-center gap-1 px-2 sm:px-4 py-2 sm:py-3 hover:bg-black/20 transition w-full min-w-0"
                                >
                                    {/* الاسم: يظهر في الكمبيوتر فقط ويختفي في نسخة الهاتف */}
                                    <div className="hidden sm:block sm:col-span-3 min-w-0 text-right">
                                        <button
                                            type="button"
                                            onClick={() => setEmployeeActionModal(u)}
                                            className="font-black text-sm text-white hover:text-cyan-300 underline decoration-cyan-400/50 underline-offset-2 truncate w-full text-right cursor-pointer"
                                            title="اضغط لإرسال رسالة للموظف"
                                        >
                                            {u.name}
                                        </button>
                                    </div>

                                    {/* المستخدم: في الهاتف يظهر باللغة العربية وعند الضغط عليه يفتح نافذة إرسال رسالة */}
                                    <div className="col-span-5 sm:col-span-3 min-w-0 text-right">
                                        <button
                                            type="button"
                                            onClick={() => setEmployeeActionModal(u)}
                                            className="sm:hidden font-black text-xs text-white hover:text-cyan-300 underline decoration-cyan-400/50 underline-offset-2 truncate w-full text-right cursor-pointer"
                                            title="اضغط لإرسال رسالة للموظف"
                                        >
                                            {mobileArabicLabel}
                                        </button>
                                        <span className="hidden sm:block text-sm text-gray-300 truncate">
                                            {u.username}
                                        </span>
                                    </div>

                                    {/* الدور */}
                                    <div className="col-span-2 sm:col-span-2 text-center min-w-0">
                                        <span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-[11px] font-bold truncate max-w-full ${u.role === 'admin' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'}`}>
                                            {getRoleLabel(u.role)}
                                        </span>
                                    </div>

                                    {/* الإجراءات: في سطر واحد داخل البوكس بدون اختفاء أي جزء من الأزرار نهائياً */}
                                    <div className="col-span-5 sm:col-span-4 flex items-center justify-center gap-1 sm:gap-2 min-w-0">
                                        {!isVirtualAdmin && (
                                            <button onClick={() => setRoleModal(u)} className="p-1.5 sm:p-2 text-purple-400 hover:bg-purple-400/10 rounded-lg transition shrink-0" title="تعديل المسمى الوظيفي">
                                                <Edit2 size={15} className="sm:w-4 sm:h-4"/>
                                            </button>
                                        )}
                                        <button onClick={() => setPermModal(u)} className="p-1.5 sm:p-2 text-blue-400 hover:bg-blue-400/10 rounded-lg permission-btn transition shrink-0" title="تعديل صلاحيات الأقسام والشريط السفلي">
                                            <Shield size={15} className="sm:w-4 sm:h-4"/>
                                        </button>
                                        {!isVirtualAdmin && (
                                            <>
                                                <button onClick={() => setPassModal({key: u.key!, name: u.name})} className="p-1.5 sm:p-2 text-orange-400 hover:bg-orange-400/10 rounded-lg transition shrink-0" title="تغيير كلمة المرور">
                                                    <Key size={15} className="sm:w-4 sm:h-4"/>
                                                </button>
                                                <button onClick={() => handleDeleteUser(u.key!)} className="p-1.5 sm:p-2 text-red-400 hover:bg-red-400/10 rounded-lg transition shrink-0" title="حذف الحساب">
                                                    <Trash2 size={15} className="sm:w-4 sm:h-4"/>
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* نافذة عند الضغط على اسم الموظف تحتوي على زر إرسال رسالة */}
            {employeeActionModal && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-gray-900 p-5 rounded-2xl border border-white/15 w-full max-w-sm shadow-2xl space-y-4 text-right animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                            <h4 className="font-black text-base text-white">{employeeActionModal.name}</h4>
                            <button onClick={() => setEmployeeActionModal(null)} className="text-white/60 hover:text-white p-1">
                                <X size={18} />
                            </button>
                        </div>
                        <div className="text-xs text-gray-300 space-y-1">
                            <div>اسم المستخدم: <strong className="text-white">{employeeActionModal.username}</strong></div>
                            <div>المسمى الوظيفي: <strong className="text-blue-300">{getRoleLabel(employeeActionModal.role)}</strong></div>
                        </div>
                        <button
                            type="button"
                            onClick={() => {
                                const target = { username: employeeActionModal.username, name: employeeActionModal.name };
                                setEmployeeActionModal(null);
                                setNotifModal(target);
                            }}
                            className="w-full bg-green-600 hover:bg-green-500 text-white py-3 rounded-xl font-black flex items-center justify-center gap-2 shadow-lg transition cursor-pointer"
                        >
                            <Send size={17} />
                            <span>إرسال رسالة</span>
                        </button>
                    </div>
                </div>
            )}

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
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
                    <div className="bg-gray-900 p-4 sm:p-6 rounded-2xl border border-white/10 w-full max-w-xl my-auto shadow-2xl max-h-[94vh] flex flex-col">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3 shrink-0">
                            <h4 className="font-bold text-white flex items-center gap-2 text-sm sm:text-lg">
                                <Shield className="text-blue-500" size={20}/> تعديل صلاحيات الأقسام والشريط السفلي: {permModal.name}
                            </h4>
                            <button onClick={() => setPermModal(null)} className="text-white/50 hover:text-white p-1">
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1 pl-1">
                            {permModal.role !== 'admin' && permModal.key !== 'admin_root' && (
                                <>
                                    <div className="flex items-center justify-between gap-2 bg-white/5 p-2.5 rounded-xl text-xs">
                                        <span className="text-gray-300 font-bold">صلاحيات القائمة الجانبية:</span>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => handleSetAllPerms(true)}
                                                className="bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white px-3 py-1.5 rounded-lg font-bold transition text-xs"
                                            >
                                                تحديد الكل
                                            </button>
                                            <button 
                                                onClick={() => handleSetAllPerms(false)}
                                                className="bg-red-600/30 hover:bg-red-600 text-red-300 hover:text-white px-3 py-1.5 rounded-lg font-bold transition text-xs"
                                            >
                                                إلغاء تحديد الكل
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {ALL_SIDE_TABS.map(item => {
                                            const isEnabled = !!(permModal.permissions as any)?.[item.key];
                                            return (
                                                <button 
                                                    key={item.key} 
                                                    onClick={() => toggleUserPerm(item.key as any)}
                                                    className={`p-2.5 sm:p-3 rounded-xl border text-xs sm:text-sm font-bold flex justify-between items-center transition cursor-pointer select-none active:scale-[0.98] ${ isEnabled ? 'bg-blue-600/20 border-blue-500 text-white shadow-sm' : 'bg-white/5 border-white/5 text-white/40 hover:bg-white/10 hover:text-white/70'}`}
                                                >
                                                    <span className="truncate">{item.label}</span>
                                                    {isEnabled ? <ToggleRight size={22} className="text-blue-400 shrink-0"/> : <ToggleLeft size={22} className="shrink-0 text-white/30"/>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </>
                            )}

                            {/* التحكم في أزرار الشريط السفلي لنسخة الهاتف (إظهار/إخفاء + ترتيب من اليمين إلى اليسار) */}
                            <div className="border-t border-white/10 pt-3 space-y-2.5">
                                <div className="flex items-center justify-between">
                                    <h5 className="font-black text-xs sm:text-sm text-cyan-300 flex items-center gap-1.5">
                                        <Smartphone size={16} className="text-cyan-400" />
                                        <span>أزرار الشريط السفلي في الهاتف (من اليمين إلى اليسار):</span>
                                    </h5>
                                    <span className="text-[10px] text-gray-400 font-bold">إظهار / إخفاء وترتيب</span>
                                </div>

                                <div className="space-y-1.5">
                                    {getModalBottomBarList(permModal).map((btnItem, idx, arr) => {
                                        const hidden = isBottomBarItemHidden(permModal, btnItem.id);
                                        return (
                                            <div
                                                key={btnItem.id}
                                                className={`flex items-center justify-between gap-2 p-2.5 rounded-xl border transition ${
                                                    !hidden
                                                        ? 'bg-cyan-950/30 border-cyan-500/40 text-white'
                                                        : 'bg-white/5 border-white/10 text-gray-400 opacity-60'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="w-6 h-6 rounded-lg bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[11px] font-black flex items-center justify-center shrink-0">
                                                        {idx + 1}
                                                    </span>
                                                    <span className="font-bold text-xs sm:text-sm truncate">{btnItem.label}</span>
                                                </div>

                                                <div className="flex items-center gap-1 shrink-0">
                                                    <button
                                                        type="button"
                                                        disabled={idx === 0}
                                                        onClick={() => moveBottomBarItemOrder(idx, 'right')}
                                                        className="px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                                                        title="تحريك لليمين (قبل)"
                                                    >
                                                        <ArrowRight size={12} />
                                                        <span>يمين</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        disabled={idx === arr.length - 1}
                                                        onClick={() => moveBottomBarItemOrder(idx, 'left')}
                                                        className="px-2 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white text-[10px] font-bold flex items-center gap-0.5 cursor-pointer"
                                                        title="تحريك لليسار (بعد)"
                                                    >
                                                        <span>يسار</span>
                                                        <ArrowLeft size={12} />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleBottomBarItemVisibility(btnItem.id)}
                                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-black flex items-center gap-1 cursor-pointer transition ${
                                                            !hidden
                                                                ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                                                                : 'bg-red-600/20 text-red-300 border border-red-500/30'
                                                        }`}
                                                    >
                                                        {!hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                                                        <span>{!hidden ? 'يظهر' : 'مخفي'}</span>
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        <div className="text-[11px] text-blue-300/80 my-3 bg-blue-950/40 border border-blue-500/20 p-2.5 rounded-xl flex items-center gap-2 shrink-0">
                            <span>⚡</span>
                            <span>يتم حفظ وتفعيل الصلاحيات وترتيب الشريط السفلي(من اليمين إلى اليسار) للحساب لحظياً وفورياً.</span>
                        </div>

                        <div className="flex gap-2 shrink-0">
                            <button onClick={handleUpdatePermissions} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2.5 sm:py-3 rounded-xl font-bold shadow-lg active:scale-95 transition cursor-pointer text-sm">
                                حفظ وإغلاق
                            </button>
                            <button onClick={() => setPermModal(null)} className="flex-1 bg-white/5 hover:bg-white/10 text-white py-2.5 sm:py-3 rounded-xl cursor-pointer transition text-sm">
                                إلغاء
                            </button>
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
