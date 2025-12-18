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

    // Load Online Status for Admin
    useEffect(() => {
        if (user.role === 'admin') {
            const statusRef = ref(db, 'status');
            const unsubscribe = onValue(statusRef, (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    const list: UserStatus[] = Object.keys(data).map(key => ({
                        username: key,
                        name: data[key].name || key,
                        online: data[key].online || false
                    }));
                    // Sort: Online users first
                    setOnlineUsers(list.sort((a, b) => Number(b.online) - Number(a.online)));
                } else {
                    setOnlineUsers([]);
                }
            });
            return () => unsubscribe();
        }
    }, [user.role]);

    // Define all possible items
    const allItems = [
        { id: 'sales', label: 'المبيعات اليومية', icon: ShoppingCart, alwaysShow: true },
        { id: 'salesLog', label: 'سجل المبيعات', icon: FileText, permission: settings.permissions?.showSalesLog },
        { id: 'inventoryReg', label: 'تسجيل المخزون', icon: PackagePlus, permission: settings.permissions?.showInventoryReg },
        { id: 'inventoryLog', label: 'سجل المخزون', icon: ClipboardList, permission: settings.permissions?.showInventoryLog },
        { id: 'competitorPrices', label: 'أسعار المنافسين', icon: TrendingUp, alwaysShow: true },
        { id: 'competitorReports', label: 'تقارير المنافسين', icon: BarChart2, permission: settings.permissions?.showCompetitorReports },
        { id: 'leaveBalance', label: 'رصيد الإجازات', icon: CalendarOff, alwaysShow: true },
        { id: 'settings', label: 'الإعدادات', icon: SettingsIcon, adminOnly: true },
    ];

    // Filter items logic
    const menuItems = allItems.filter(item => {
        if (user.role === 'admin') return true;
        if (item.adminOnly) return false;
        if (item.permission !== undefined) {
            return item.permission === true;
        }
        return true;
    });

    const getButtonClass = (isActive: boolean) => {
        let classes = "group w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-all duration-300 ease-out font-medium relative overflow-hidden ";
        
        if (theme === 'win10') {
            classes += isActive 
                ? "bg-[#0078D7] text-white shadow-lg translate-x-2 " 
                : "text-gray-700 hover:bg-gray-200 hover:translate-x-1 ";
        } else if (theme === 'dark') {
            classes += isActive 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 translate-x-2 ring-1 ring-blue-400/30 " 
                : "text-gray-400 hover:bg-gray-800 hover:text-gray-100 hover:translate-x-1 ";
        } else if (theme === 'glass') {
            classes += isActive 
                ? "bg-gradient-to-r from-white/20 to-white/5 text-white shadow-lg border-r-4 border-white backdrop-blur-md translate-x-2 " 
                : "text-white/80 hover:bg-white/10 hover:text-white hover:translate-x-1 ";
        } else {
             classes += isActive 
                ? "bg-white text-blue-700 shadow-md translate-x-2 border-r-4 border-blue-500 " 
                : "text-gray-600 hover:bg-white hover:shadow-sm hover:text-blue-900 hover:translate-x-1 ";
        }
        
        return classes;
    };

    const headerClass = `text-xs font-bold uppercase tracking-wider mb-6 px-2 ${
        theme === 'glass' ? 'text-white/50' : theme === 'dark' ? 'text-gray-500' : 'text-gray-400'
    }`;

    return (
        <aside className={`w-64 md:w-72 p-6 flex flex-col ${containerClass} transition-all duration-300`}>
            <div className={headerClass}>القائمة الرئيسية</div>
            <nav className="flex-1 flex flex-col gap-3 overflow-y-auto">
                {menuItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setView(item.id)}
                        className={getButtonClass(currentView === item.id)}
                    >
                        {currentView === item.id && theme !== 'win10' && theme !== 'glass' && (
                             <div className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-current rounded-l-full opacity-60" />
                        )}
                        <item.icon size={22} strokeWidth={1.5} className="flex-shrink-0" />
                        <span className="text-base tracking-wide">{item.label}</span>
                    </button>
                ))}

                {/* Online Users Section - Only for Admin */}
                {user.role === 'admin' && (
                    <div className="mt-8 border-t pt-4 border-gray-500/20">
                        <div className="flex items-center gap-2 mb-4 px-2 text-xs font-bold uppercase text-gray-400">
                            <Users size={14} />
                            <span>المستخدمين الآن (Online)</span>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto px-1">
                            {onlineUsers.length === 0 ? (
                                <div className="text-[10px] text-gray-500 italic px-2">لا توجد سجلات حالية</div>
                            ) : onlineUsers.map((u) => (
                                <div key={u.username} className="flex items-center justify-between px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 transition">
                                    <span className={`text-xs font-medium truncate ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
                                        {u.name}
                                    </span>
                                    <div className={`w-2.5 h-2.5 rounded-full ${u.online ? 'bg-blue-500 lamp-glow-blue' : 'bg-red-500 lamp-glow-red'}`} title={u.online ? "متصل" : "غير متصل"} />
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </nav>
            
            <div className={`mt-auto text-xs px-2 pt-4 border-t ${theme === 'dark' ? 'border-gray-700 text-gray-500' : 'border-gray-200/20 text-gray-400'}`}>
                v1.2.0
            </div>
        </aside>
    );
};

export default Sidebar;