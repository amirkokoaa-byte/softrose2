import React from 'react';
import { User } from '../types';
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
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setView, user, theme, containerClass }) => {
    
    const menuItems = [
        { id: 'sales', label: 'المبيعات اليومية', icon: ShoppingCart },
        { id: 'salesLog', label: 'سجل المبيعات', icon: FileText },
        { id: 'inventoryReg', label: 'تسجيل المخزون', icon: PackagePlus },
        { id: 'inventoryLog', label: 'سجل المخزون', icon: ClipboardList },
        { id: 'competitorPrices', label: 'أسعار المنافسين', icon: TrendingUp },
        { id: 'competitorReports', label: 'تقارير المنافسين', icon: BarChart2 },
        { id: 'settings', label: 'الإعدادات', icon: SettingsIcon },
    ];

    const getButtonClass = (isActive: boolean) => {
        const base = "w-full flex items-center gap-3 p-3 rounded-lg transition-all mb-2 ";
        if (theme === 'win10') {
            return isActive 
                ? "bg-[#0078D7] text-white font-bold shadow-md" 
                : "hover:bg-gray-200 text-gray-700";
        }
        if (theme === 'dark') {
            return isActive 
                ? "bg-blue-600 text-white" 
                : "hover:bg-gray-700 text-gray-300";
        }
        // Glass/Light
        return isActive 
            ? "bg-white/40 shadow-inner font-bold text-blue-900 border border-white/50" 
            : "hover:bg-white/20 hover:text-blue-800";
    };

    return (
        <aside className={`w-64 p-4 flex flex-col ${containerClass}`}>
            <nav className="flex-1">
                {menuItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setView(item.id)}
                        className={getButtonClass(currentView === item.id)}
                    >
                        <item.icon size={20} />
                        <span>{item.label}</span>
                    </button>
                ))}
            </nav>
        </aside>
    );
};

export default Sidebar;