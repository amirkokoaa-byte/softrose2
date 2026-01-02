
import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, onValue } from "firebase/database";
import { User, AppSettings } from '../types';
import { 
    ShoppingCart, FileText, PackagePlus, ClipboardList, 
    TrendingUp, BarChart2, Settings as SettingsIcon, CalendarOff,
    Users, Circle
} from 'lucide-react';

interface SidebarProps {
    currentView: string;
    setView: (view: string) => void;
    user: User;
    theme: string;
    containerClass: string;
    settings: AppSettings;
}

interface UserStatus {
    username: string;
    name: string;
    online: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, user, theme, containerClass, settings }) => {
    const [onlineUsers, setOnlineUsers] = useState<UserStatus[]>([]);

    useEffect(() => {
        if (user.role === 'admin') {
            const statusRef = ref(db, 'status');
            const unsubscribe = onValue(statusRef, (snapshot) => {
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

    const allItems = [
        { id: 'sales', label: 'المبيعات اليومية', icon: ShoppingCart, permissionKey: 'showDailySales' },
        { id: 'salesLog', label: 'سجل المبيعات', icon: FileText, permissionKey: 'showSalesLog' },
        { id: 'inventoryReg', label: 'تسجيل المخزون', icon: PackagePlus, permissionKey: 'showInventoryReg' },
        { id: 'inventoryLog', label: 'سجل المخزون', icon: ClipboardList, permissionKey: 'showInventoryLog' },
        { id: 'competitorPrices', label: 'أسعار المنافسين', icon: TrendingUp, permissionKey: 'showCompetitorPrices' },
        { id: 'competitorReports', label: 'تقارير المنافسين', icon: BarChart2, permissionKey: 'showCompetitorReports' },
        { id: 'leaveBalance', label: 'رصيد الإجازات', icon: CalendarOff, alwaysShow: true },
        { id: 'settings', label: 'الإعدادات', icon: SettingsIcon, adminOnly: true },
    ];

    const menuItems = allItems.filter(item => {
        if (user.role === 'admin') return true;
        if (item.adminOnly) return false;
        if (item.alwaysShow) return true;
        if (item.permissionKey) {
            const perms = user.permissions || {} as any;
            return perms[item.permissionKey] === true;
        }
        return false;
    });

    const getButtonClass = (isActive: boolean) => {
        let classes = "group w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-200 font-bold mb-1 ";
        
        if (isActive) {
            switch (theme) {
                case 'win10': classes += "bg-blue-600 text-white shadow-lg"; break;
                case 'glass': classes += "bg-white/20 text-white backdrop-blur-md border border-white/20"; break;
                case 'light': classes += "bg-blue-600 text-white shadow-md"; break;
                default: classes += "bg-blue-600 text-white shadow-lg shadow-blue-600/20"; break;
            }
        } else {
            classes += theme === 'light' ? "text-gray-600 hover:bg-gray-100" : "text-gray-400 hover:bg-white/5";
        }
        
        return classes;
    };

    const headerClass = "text-[10px] font-bold uppercase tracking-[0.2em] mb-8 px-4 opacity-50 border-b border-white/5 pb-4";

    return (
        <aside className={`w-64 md:w-72 p-6 flex flex-col ${containerClass} transition-all duration-300`}>
            <div className={headerClass}>نظام سوفت روز</div>
            <nav className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar">
                {menuItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setView(item.id)}
                        className={getButtonClass(currentView === item.id)}
                    >
                        <item.icon size={20} strokeWidth={2.5} />
                        <span className="text-sm">{item.label}</span>
                    </button>
                ))}

                {user.role === 'admin' && (
                    <div className="mt-10 border-t pt-6 border-white/10">
                        <div className="flex items-center gap-2 mb-4 px-2 text-[10px] font-bold uppercase opacity-50">
                            <Users size={14} />
                            <span>المتواجدون حالياً</span>
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                            {onlineUsers.length === 0 ? (
                                <div className="text-[10px] opacity-40 italic px-2">لا يوجد مستخدمون نشطون</div>
                            ) : onlineUsers.map((u) => (
                                <div key={u.username} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/5">
                                    <span className="text-xs font-bold truncate flex-1 opacity-80">
                                        {u.name}
                                    </span>
                                    <div 
                                        className={`w-2.5 h-2.5 rounded-full ${u.online ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-gray-600'}`} 
                                        title={u.online ? "متصل" : "غير متصل"} 
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </nav>
            
            <div className="mt-auto text-[9px] px-4 pt-4 border-t border-white/10 opacity-30 font-bold uppercase tracking-widest flex justify-between items-center">
                <span>Soft Rose System</span>
                <span>v1.5.0</span>
            </div>
        </aside>
    );
};

export default Sidebar;
