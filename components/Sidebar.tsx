import { onCachedValue } from "../firebaseCache";

import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue, set } from "firebase/database";
import { User, AppSettings } from '../types';
import { 
    ShoppingCart, FileText, PackagePlus, ClipboardList, 
    TrendingUp, BarChart2, Settings as SettingsIcon, CalendarOff,
    Users, Circle, BookOpen, MessageSquareQuote, UserCheck,
    Move, Save, ChevronUp, ChevronDown, GripVertical, PhoneCall, X
} from 'lucide-react';

interface SidebarProps {
    currentView: string;
    setView: (view: string) => void;
    user: User;
    theme: string;
    containerClass: string;
    settings: AppSettings;
    onClose?: () => void;
}

interface UserStatus {
    username: string;
    name: string;
    online: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, user, theme, containerClass, settings, onClose }) => {
    const [onlineUsers, setOnlineUsers] = useState<UserStatus[]>([]);
    const [itemsOrder, setItemsOrder] = useState<string[]>([]);
    const [isReordering, setIsReordering] = useState<boolean>(false);
    const [hasReorderChanges, setHasReorderChanges] = useState<boolean>(false);
    const [isSavingOrder, setIsSavingOrder] = useState<boolean>(false);
    const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

    const defaultItems = [
        { id: 'sales', label: 'المبيعات اليومية', icon: ShoppingCart, permissionKey: 'showDailySales' },
        { id: 'salesLog', label: 'سجل المبيعات', icon: FileText, permissionKey: 'showSalesLog' },
        { id: 'inventoryReg', label: 'تسجيل المخزون', icon: PackagePlus, permissionKey: 'showInventoryReg' },
        { id: 'inventoryLog', label: 'سجل المخزون', icon: ClipboardList, permissionKey: 'showInventoryLog' },
        { id: 'competitorPrices', label: 'أسعار المنافسين', icon: TrendingUp, permissionKey: 'showCompetitorPrices' },
        { id: 'competitorReports', label: 'تقارير المنافسين', icon: BarChart2, permissionKey: 'showCompetitorReports' },
        { id: 'productsRegistry', label: 'سجل المنتجات', icon: BookOpen, permissionKey: 'showProductsRegistry' },
        { id: 'customerFeedback', label: 'الشكاوي و المقترحات', icon: MessageSquareQuote, permissionKey: 'showCustomerFeedback' },
        { id: 'leaveBalance', label: 'رصيد الإجازات', icon: CalendarOff, permissionKey: 'showLeaveBalance' },
        { id: 'attendance', label: 'الحضور والانصراف', icon: UserCheck, permissionKey: 'showAttendance' },
        { id: 'branchNumbers', label: 'أرقام الفروع', icon: PhoneCall, permissionKey: 'showBranchNumbers' },
        { id: 'employees', label: 'الموظفين', icon: Users, permissionKey: 'showEmployees' },
        { id: 'settings', label: 'الإعدادات', icon: SettingsIcon, permissionKey: 'showSettings' },
    ];

    useEffect(() => {
        const orderRef = ref(db, 'settings/sidebarOrder');
        const unsub = onCachedValue(orderRef, 'settings_sidebarOrder', (snapshot) => {
            if (snapshot.exists()) {
                const val = snapshot.val();
                if (Array.isArray(val) && val.length > 0) {
                    setItemsOrder(val);
                    return;
                }
            }
            try {
                const local = localStorage.getItem('softrose_sidebar_order');
                if (local) {
                    const parsed = JSON.parse(local);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        setItemsOrder(parsed);
                        return;
                    }
                }
            } catch {}
            setItemsOrder(defaultItems.map(i => i.id));
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (user.role === 'admin') {
            const statusRef = ref(db, 'status');
            const unsubscribe = onCachedValue(statusRef, 'status', (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const list: UserStatus[] = Object.keys(data).map(key => ({
                        username: data[key].username || key,
                        name: data[key].name || key,
                        online: data[key].online || false
                    }));
                    
                    const sortedList = list.sort((a, b) => {
                        if (a.online === b.online) {
                            return a.name.localeCompare(b.name, 'ar');
                        }
                        return a.online ? -1 : 1;
                    });
                    
                    setOnlineUsers(sortedList);
                } else {
                    setOnlineUsers([]);
                }
            });
            return () => unsubscribe();
        }
    }, [user.role]);

    const sortedAllItems = [...defaultItems].sort((a, b) => {
        const posA = itemsOrder.indexOf(a.id);
        const posB = itemsOrder.indexOf(b.id);
        const effectiveA = posA === -1 ? 999 : posA;
        const effectiveB = posB === -1 ? 999 : posB;
        return effectiveA - effectiveB;
    });

    const menuItems = sortedAllItems.filter(item => {
        if (user.role === 'admin') return true;
        const perms = (user.permissions || {}) as any;
        const pKey = item.permissionKey;
        if (pKey && perms[pKey] !== undefined) {
            return perms[pKey] === true;
        }
        if (item.id === 'sales' || item.id === 'salesLog' || item.id === 'competitorPrices') {
            return !!perms[pKey];
        }
        if (item.id === 'employees' || item.id === 'settings') {
            return false;
        }
        return true;
    });

    const moveMenuItem = (fromIdx: number, toIdx: number) => {
        if (toIdx < 0 || toIdx >= menuItems.length) return;
        const newMenuItems = [...menuItems];
        const [moved] = newMenuItems.splice(fromIdx, 1);
        newMenuItems.splice(toIdx, 0, moved);

        const newOrderedIds = newMenuItems.map(m => m.id);
        defaultItems.forEach(item => {
            if (!newOrderedIds.includes(item.id)) {
                newOrderedIds.push(item.id);
            }
        });
        setItemsOrder(newOrderedIds);
        setHasReorderChanges(true);
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        if (!isReordering) return;
        setDraggedIndex(index);
        e.dataTransfer.setData('text/plain', String(index));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => {
        if (!isReordering) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e: React.DragEvent, targetIndex: number) => {
        if (!isReordering) return;
        e.preventDefault();
        if (draggedIndex !== null && draggedIndex !== targetIndex) {
            moveMenuItem(draggedIndex, targetIndex);
        }
        setDraggedIndex(null);
    };

    const handleSaveSidebarOrder = async () => {
        try {
            setIsSavingOrder(true);
            await set(ref(db, 'settings/sidebarOrder'), itemsOrder);
            localStorage.setItem('softrose_sidebar_order', JSON.stringify(itemsOrder));
            setHasReorderChanges(false);
            setIsReordering(false);
            alert('تم حفظ ترتيب القائمة الجانبية بنجاح!');
        } catch (err) {
            console.error('Failed to save sidebar order', err);
            alert('حدث خطأ أثناء حفظ الترتيب');
        } finally {
            setIsSavingOrder(false);
        }
    };

    const getButtonClass = (itemId: string, isActive: boolean) => {
        const isHovered = hoveredItemId === itemId;
        const isAnyHovered = hoveredItemId !== null;

        // تعديل المسافات بين الاختيارات على الهاتف لتكون أكثر راحة وانسيابية (py-2 md:py-3.5 و gap-3 md:gap-4)
        let classes = "w-full flex items-center gap-3 md:gap-4 px-3 md:px-4 py-2 md:py-3.5 rounded-xl transition-all duration-200 font-bold mb-0.5 md:mb-1 border ";
        
        if (isHovered) {
            // الخانة التي يمر عليها الماوس تحديداً: إضاءة الحواف بلون أبيض
            classes += "border-white shadow-[0_0_15px_rgba(255,255,255,0.7)] text-white " + 
                       (isActive ? "bg-blue-600/90" : "bg-white/10 backdrop-blur-md");
        } else if (isActive && !isAnyHovered) {
            // عند عدم مرور الماوس على أي خانة، تظهر الخانة النشطة بتوهجها المعتاد
            classes += "bg-blue-600/80 text-white border-blue-400/50 shadow-[0_0_15px_rgba(59,130,246,0.4)] backdrop-blur-md";
        } else if (isActive && isAnyHovered) {
            // عند مرور الماوس على خانة أخرى، تنطفئ إضاءة الخانة النشطة حتى لا تضيء أي خانة أخرى
            classes += "border-transparent bg-blue-900/40 text-blue-200/80 shadow-none";
        } else {
            // باقي الخانات العادية غير المضاءة
            classes += "border-transparent text-gray-300 shadow-none";
        }
        
        return classes;
    };

    return (
        <aside className={`w-64 md:w-72 p-3.5 md:p-6 flex flex-col ${containerClass} transition-all duration-300`}>
            {/* عنوان القائمة مع زر إغلاق يظهر في نسخة الهاتف عند فتح القائمة */}
            <div className="flex items-center justify-between mb-3 md:mb-8 px-2 md:px-4 pb-2.5 md:pb-4 border-b border-blue-500/20">
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-70 text-blue-300 drop-shadow-[0_0_8px_rgba(59,130,246,0.4)]">
                    نظام سوفت روز
                </span>
                {onClose && (
                    <button 
                        type="button"
                        onClick={onClose} 
                        className="md:hidden p-1.5 rounded-xl text-gray-300 hover:text-white hover:bg-white/10 transition active:scale-95"
                        title="إغلاق القائمة الجانبية"
                    >
                        <X size={18} />
                    </button>
                )}
            </div>
            
            {/* حذف المسطرة الطولية مع الحفاظ على التمرير السلس */}
            <nav 
                onMouseLeave={() => setHoveredItemId(null)}
                className="flex-1 flex flex-col gap-0.5 md:gap-1 overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
            >
                {menuItems.map((item, idx) => (
                    <div
                        key={item.id}
                        draggable={isReordering && user.role === 'admin'}
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, idx)}
                        className={`relative flex items-center transition-all ${isReordering ? 'cursor-move' : ''}`}
                    >
                        <button
                            type="button"
                            onMouseEnter={() => setHoveredItemId(item.id)}
                            onMouseLeave={() => setHoveredItemId(null)}
                            onClick={() => {
                                if (!isReordering) {
                                    setView(item.id);
                                }
                            }}
                            className={`${getButtonClass(item.id, currentView === item.id)} ${
                                isReordering ? 'border-2 border-dashed border-amber-500/40 bg-amber-500/5' : ''
                            } flex-1`}
                        >
                            <item.icon size={20} strokeWidth={2.5} className="shrink-0" />
                            <span className="text-sm truncate">{item.label}</span>
                        </button>

                        {/* أدوات التحريك لأعلى وأسفل وسحب أثناء وضع الترتيب */}
                        {isReordering && user.role === 'admin' && (
                            <div className="absolute left-2 flex items-center gap-0.5 bg-gray-900/90 p-1 rounded-lg border border-white/10 shadow-lg z-10">
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); moveMenuItem(idx, idx - 1); }}
                                    disabled={idx === 0}
                                    className="p-1 text-gray-300 hover:text-white disabled:opacity-20 transition active:scale-95 cursor-pointer"
                                    title="تحريك لأعلى"
                                >
                                    <ChevronUp size={14} />
                                </button>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); moveMenuItem(idx, idx + 1); }}
                                    disabled={idx === menuItems.length - 1}
                                    className="p-1 text-gray-300 hover:text-white disabled:opacity-20 transition active:scale-95 cursor-pointer"
                                    title="تحريك لأسفل"
                                >
                                    <ChevronDown size={14} />
                                </button>
                                <GripVertical size={14} className="text-amber-400 opacity-60 ml-0.5" />
                            </div>
                        )}
                    </div>
                ))}

                {/* زر تحريك وزر حفظ أسفل اختيار الإعدادات */}
                {user.role === 'admin' && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5 px-1">
                        <button
                            type="button"
                            onClick={() => setIsReordering(prev => !prev)}
                            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition flex-1 active:scale-95 cursor-pointer ${
                                isReordering 
                                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm' 
                                    : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                            }`}
                            title="تحريك وترتيب عناصر القائمة الجانبية"
                        >
                            <Move size={14} className={isReordering ? "animate-pulse text-amber-400" : ""} />
                            <span>{isReordering ? 'إنهاء التحريك' : 'تحريك'}</span>
                        </button>

                        {/* زر حفظ يظهر عند التحريك بشكل مصغر بجانب زر تحريك */}
                        {(isReordering || hasReorderChanges) && (
                            <button
                                type="button"
                                onClick={handleSaveSidebarOrder}
                                disabled={isSavingOrder}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1 shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50 shrink-0 animate-in fade-in"
                                title="حفظ الترتيب الجديد"
                            >
                                <Save size={13} />
                                <span>{isSavingOrder ? 'حفظ...' : 'حفظ'}</span>
                            </button>
                        )}
                    </div>
                )}

                {user.role === 'admin' && (
                    <div className="mt-10 border-t pt-6 border-white/10">
                        <div className="flex items-center gap-2 mb-4 px-2 text-[10px] font-bold uppercase opacity-50">
                            <Users size={14} />
                            <span>المتواجدون حالياً</span>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                            {onlineUsers.length === 0 ? (
                                <div className="text-[10px] opacity-40 italic px-2">لا يوجد مستخدمون نشطون</div>
                            ) : onlineUsers.map((u) => (
                                <div key={u.username} className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/50 border border-blue-500/20 transition-all duration-300 hover:border-blue-500/40">
                                    <span className="text-xs font-bold truncate flex-1 opacity-90 text-white">
                                        {u.name}
                                    </span>
                                    <div 
                                        className={`w-2.5 h-2.5 rounded-full ${u.online ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]' : 'bg-gray-600'}`} 
                                        title={u.online ? "متصل" : "غير متصل"} 
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </nav>
            
            <div className="mt-auto pt-4 border-t border-blue-500/20 flex flex-col gap-3">
                <div className="flex items-center gap-3 px-4 py-2.5 bg-slate-900/60 rounded-2xl border border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.2)] transition-all duration-300">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-[0_0_10px_rgba(59,130,246,0.5)]">
                        {(user?.name || user?.username || '?').charAt(0)}
                    </div>
                    <div className="flex flex-col overflow-hidden">
                        <span className="text-sm font-bold text-white truncate">{user?.name || user?.username || 'مستخدم'}</span>
                        <span className="text-[10px] text-blue-300/70">
                            {user.role === 'admin' ? 'مسؤول' : 
                             user.role === 'manager' ? 'مدير' :
                             user.role === 'coordinator' ? 'منسق' :
                             user.role === 'supervisor' ? 'مشرف' : 'موظف'}
                        </span>
                    </div>
                </div>
                <div className="text-[9px] px-4 opacity-40 font-bold uppercase tracking-widest flex justify-between items-center text-blue-200">
                    <span>Soft Rose System</span>
                    <span>v1.5.0</span>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
