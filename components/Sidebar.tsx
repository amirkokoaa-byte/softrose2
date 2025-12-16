import React from 'react';
import { User, AppSettings } from '../types';
import { 
    ShoppingCart, FileText, PackagePlus, ClipboardList, 
    TrendingUp, BarChart2, Settings as SettingsIcon 
} from 'lucide-react';

interface SidebarProps {
    currentView: string;
    setView: (view: string) => void;
    user: User;
    theme: string;
    containerClass: string;
    settings: AppSettings;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, user, theme, containerClass, settings }) => {
    
    // Define all possible items
    const allItems = [
        { id: 'sales', label: 'المبيعات اليومية', icon: ShoppingCart, alwaysShow: true },
        { id: 'salesLog', label: 'سجل المبيعات', icon: FileText, permission: settings.permissions?.showSalesLog },
        { id: 'inventoryReg', label: 'تسجيل المخزون', icon: PackagePlus, permission: settings.permissions?.showInventoryReg },
        { id: 'inventoryLog', label: 'سجل المخزون', icon: ClipboardList, permission: settings.permissions?.showInventoryLog },
        { id: 'competitorPrices', label: 'أسعار المنافسين', icon: TrendingUp, alwaysShow: true },
        { id: 'competitorReports', label: 'تقارير المنافسين', icon: BarChart2, permission: settings.permissions?.showCompetitorReports },
        { id: 'settings', label: 'الإعدادات', icon: SettingsIcon, adminOnly: true },
    ];

    // Filter items logic
    const menuItems = allItems.filter(item => {
        // Admin sees everything
        if (user.role === 'admin') return true;

        // If item is admin only, hide from users
        if (item.adminOnly) return false;

        // If item has a specific permission check
        if (item.permission !== undefined) {
            return item.permission === true;
        }

        // Default to showing items marked as alwaysShow (like DailySales)
        return true;
    });

    const getButtonClass = (isActive: boolean) => {
        // Base classes for layout, spacing, and transition
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
            // Light/Default
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
            <div className={headerClass}>
                القائمة الرئيسية
            </div>
            <nav className="flex-1 flex flex-col gap-3">
                {menuItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setView(item.id)}
                        className={getButtonClass(currentView === item.id)}
                    >
                        {/* Active Indicator for specific themes */}
                        {currentView === item.id && theme !== 'win10' && theme !== 'glass' && (
                             <div className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-1 bg-current rounded-l-full opacity-60" />
                        )}
                        
                        <item.icon size={22} strokeWidth={1.5} className="flex-shrink-0" />
                        <span className="text-base tracking-wide">{item.label}</span>
                    </button>
                ))}
            </nav>
            
            <div className={`mt-auto text-xs px-2 pt-4 border-t ${theme === 'dark' ? 'border-gray-700 text-gray-500' : 'border-gray-200/20 text-gray-400'}`}>
                v1.1.0
            </div>
        </aside>
    );
};

export default Sidebar;