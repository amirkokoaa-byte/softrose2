
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { ref, onValue, set, update, onDisconnect, serverTimestamp } from "firebase/database";
import { User, AppSettings, AppNotification } from './types';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import DailySales from './components/DailySales';
import SalesLog from './components/SalesLog';
import InventoryRegistration from './components/InventoryRegistration';
import InventoryLog from './components/InventoryLog';
import CompetitorPrices from './components/CompetitorPrices';
import CompetitorReports from './components/CompetitorReports';
import LeaveBalanceComponent from './components/LeaveBalance';
import Settings from './components/Settings';
import { Home, LogOut, Phone, Wifi, WifiOff, Menu, X, Palette, Bell, MailOpen, Check } from 'lucide-react';
import { INITIAL_MARKETS } from './constants';

const DEFAULT_SETTINGS: AppSettings = {
  appName: "Soft Rose Modern Trade",
  tickerText: "أهلاً بكم في نظام سوفت روز للتجارة الحديثة",
  tickerEnabled: true,
  whatsappNumber: "",
  permissions: {
    showSalesLog: true, 
    showInventoryLog: false, 
    showInventoryReg: false, 
    showCompetitorReports: false 
  }
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<string>('sales');
  const [theme, setTheme] = useState<'glass' | 'dark' | 'win10' | 'light'>('win10');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [markets, setMarkets] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  useEffect(() => {
    const settingsRef = ref(db, 'settings/app');
    const marketsRef = ref(db, 'settings/markets');
    const connectedRef = ref(db, ".info/connected");

    onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) setSettings({...DEFAULT_SETTINGS, ...snapshot.val()});
    });

    onValue(marketsRef, (snapshot) => {
      const systemMarkets = INITIAL_MARKETS.map(name => ({ name, createdBy: 'system' }));
      const dbMarkets = snapshot.exists() ? Object.values(snapshot.val()).map((m: any) => 
        typeof m === 'string' ? { name: m, createdBy: 'system' } : m
      ) : [];
      const allCombined = [...systemMarkets, ...dbMarkets];

      if (user) {
        let filtered;
        if (user.role === 'admin') {
          filtered = allCombined;
        } else {
          filtered = allCombined.filter(m => m.createdBy === 'system' || m.createdBy === user.username);
        }
        const uniqueNames = Array.from(new Set(filtered.map(m => m.name)));
        setMarkets(uniqueNames);
      }
    }, { onlyOnce: false });

    onValue(connectedRef, (snap) => setIsConnected(!!snap.val()));
  }, [user?.username, user?.role]);

  useEffect(() => {
    if (!user) return;
    const safeKey = user.username.replace(/[.#$/[\]]/g, "_");
    const userStatusRef = ref(db, `status/${safeKey}`);
    set(userStatusRef, { online: true, lastSeen: serverTimestamp(), name: user.name, username: user.username });
    onDisconnect(userStatusRef).set({ online: false, lastSeen: serverTimestamp(), name: user.name, username: user.username });

    onValue(ref(db, `notifications/${user.username}`), (snapshot) => {
        if(snapshot.exists()) {
            const data = snapshot.val();
            const list = Object.keys(data).map(key => ({ id: key, ...data[key] })).sort((a,b) => b.timestamp - a.timestamp);
            setNotifications(list);
            setUnreadCount(list.filter(n => !n.isRead).length);
        }
    });
  }, [user?.username]);

  const handleLogout = async () => {
    if (user) {
        const safeKey = user.username.replace(/[.#$/[\]]/g, "_");
        await set(ref(db, `status/${safeKey}`), { online: false, lastSeen: serverTimestamp(), name: user.name, username: user.username });
    }
    localStorage.removeItem('soft_rose_user');
    setUser(null);
  };

  if (!user) return <Login onLogin={setUser} theme={theme} />;

  const getThemeClasses = () => {
    switch(theme) {
        case 'glass': return "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 min-h-screen text-white";
        case 'dark': return "bg-gray-900 text-white min-h-screen";
        case 'win10': return "bg-[#0078D7] min-h-screen font-sans";
        default: return "bg-gray-100 text-gray-800 min-h-screen";
    }
  };

  const themesList = [
      { id: 'win10', name: 'ويندوز 10', color: 'bg-blue-600' },
      { id: 'dark', name: 'الوضع الليلي', color: 'bg-gray-800' },
      { id: 'glass', name: 'زجاجي مودرن', color: 'bg-purple-500' },
      { id: 'light', name: 'فاتح كلاسيك', color: 'bg-white border' },
  ];

  return (
    <div className={`${getThemeClasses()} flex flex-col overflow-hidden`}>
      {settings.tickerEnabled && (
        <div className="bg-black text-yellow-400 py-1 overflow-hidden whitespace-nowrap border-b border-yellow-600">
           <div className="animate-marquee inline-block px-4">{settings.tickerText}</div>
        </div>
      )}

      <header className={`p-4 flex justify-between items-center z-50 ${theme === 'glass' ? 'bg-white/10' : theme === 'dark' ? 'bg-gray-800' : 'bg-white text-black shadow-md'}`}>
        <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 rounded hover:bg-black/10">
                {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h1 className="text-xl md:text-2xl font-bold truncate">{settings.appName}</h1>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
            {/* زر الواتساب */}
            {settings.whatsappNumber && (
                <a 
                    href={`https://wa.me/${settings.whatsappNumber}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-2 rounded-full hover:bg-green-500/10 text-green-600 transition-colors"
                    title="الدعم الفني"
                >
                    <Phone size={20} />
                </a>
            )}

            {/* زر الاستيلات */}
            <div className="relative">
                <button 
                    onClick={() => setShowThemeSelector(!showThemeSelector)} 
                    className={`p-2 rounded-full hover:bg-black/10 transition-colors ${showThemeSelector ? 'bg-black/10' : ''}`}
                    title="تغيير المظهر"
                >
                    <Palette size={20} />
                </button>
                {showThemeSelector && (
                    <div className="absolute left-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-gray-100 p-2 animate-in fade-in zoom-in duration-200 z-[60]">
                        <div className="text-[10px] font-bold text-gray-400 px-3 py-1 uppercase mb-1">اختر المظهر</div>
                        {themesList.map((t) => (
                            <button 
                                key={t.id}
                                onClick={() => { setTheme(t.id as any); setShowThemeSelector(false); }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${theme === t.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${t.color}`} />
                                    <span>{t.name}</span>
                                </div>
                                {theme === t.id && <Check size={14} />}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className="relative p-2 rounded-full hover:bg-black/10">
                <Bell size={20} />
                {unreadCount > 0 && <span className="absolute top-1 right-1 bg-red-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-white">{unreadCount}</span>}
            </button>

            <div className="text-sm hidden lg:block opacity-70">مرحباً، <span className="font-bold">{user.name}</span></div>
            
            <button onClick={handleLogout} className="text-red-500 p-2 rounded-full hover:bg-red-500/10 transition-colors" title="تسجيل الخروج">
                <LogOut size={20} />
            </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        <div className={`absolute top-0 bottom-0 right-0 z-30 h-full transition-transform duration-300 md:relative md:transform-none ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
            <Sidebar currentView={currentView} setView={(view) => { setCurrentView(view); setIsSidebarOpen(false); }} user={user} theme={theme} settings={settings} containerClass={`${theme === 'glass' ? 'bg-white/10 backdrop-blur-md' : theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50 border-l border-gray-200'} h-full shadow-xl`} />
        </div>
        <main className="flex-1 p-2 md:p-4 overflow-y-auto w-full">
            <div className={`p-4 md:p-6 min-h-full ${theme === 'win10' ? 'bg-white text-black border-2 border-[#005a9e]' : 'bg-white/90 backdrop-blur-sm rounded-xl shadow-lg text-black'}`}>
                {currentView === 'sales' && <DailySales user={user} markets={markets} theme={theme} />}
                {currentView === 'salesLog' && <SalesLog user={user} markets={markets} theme={theme} />}
                {currentView === 'inventoryReg' && <InventoryRegistration user={user} markets={markets} theme={theme} />}
                {currentView === 'inventoryLog' && <InventoryLog user={user} markets={markets} theme={theme} />}
                {currentView === 'competitorPrices' && <CompetitorPrices user={user} markets={markets} theme={theme} />}
                {currentView === 'competitorReports' && <CompetitorReports user={user} markets={markets} theme={theme} />}
                {currentView === 'leaveBalance' && <LeaveBalanceComponent user={user} theme={theme} />}
                {currentView === 'settings' && <Settings user={user} settings={settings} markets={markets} theme={theme} setTheme={setTheme} />}
            </div>
        </main>
      </div>
    </div>
  );
};

export default App;
