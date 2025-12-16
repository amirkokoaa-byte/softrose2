import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { ref, onValue, set } from "firebase/database";
import { User, AppSettings } from './types';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import DailySales from './components/DailySales';
import SalesLog from './components/SalesLog';
import InventoryRegistration from './components/InventoryRegistration';
import InventoryLog from './components/InventoryLog';
import CompetitorPrices from './components/CompetitorPrices';
import CompetitorReports from './components/CompetitorReports';
import Settings from './components/Settings';
import { Home, LogOut, Phone, Wifi, WifiOff, Menu, X, Palette } from 'lucide-react';
import { INITIAL_MARKETS } from './constants';

// Default Settings
const DEFAULT_SETTINGS: AppSettings = {
  appName: "Soft Rose Modern Trade",
  tickerText: "أهلاً بكم في نظام سوفت روز للتجارة الحديثة",
  tickerEnabled: true,
  whatsappNumber: "",
  permissions: {
    showSalesLog: true, 
    showInventoryLog: false, // Hidden by default for users
    showInventoryReg: false, // Hidden by default for users
    showCompetitorReports: false // Hidden by default for users
  }
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<string>('sales');
  const [theme, setTheme] = useState<'glass' | 'dark' | 'win10' | 'light'>('win10');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [markets, setMarkets] = useState<string[]>(INITIAL_MARKETS);
  const [isConnected, setIsConnected] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  
  // Realtime Listeners
  useEffect(() => {
    const settingsRef = ref(db, 'settings/app');
    const marketsRef = ref(db, 'settings/markets');
    const connectedRef = ref(db, ".info/connected");

    const unsubscribeSettings = onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
          // Merge with defaults to ensure permissions object exists if old data
          setSettings({...DEFAULT_SETTINGS, ...data});
      }
    });

    const unsubscribeMarkets = onValue(marketsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setMarkets(Object.values(data));
      } else {
         setMarkets(INITIAL_MARKETS);
      }
    });

    const unsubscribeConnected = onValue(connectedRef, (snap) => {
        setIsConnected(!!snap.val());
    });

    return () => {
        unsubscribeSettings();
        unsubscribeMarkets();
        unsubscribeConnected();
    };
  }, []);

  const handleLogout = () => {
    setUser(null);
  };

  if (!user) {
    return <Login onLogin={setUser} theme={theme} />;
  }

  // Dynamic Theme Classes
  const getThemeClasses = () => {
    switch(theme) {
        case 'glass': return "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 min-h-screen text-white";
        case 'dark': return "bg-gray-900 text-white min-h-screen";
        case 'win10': return "bg-[#0078D7] min-h-screen font-sans";
        default: return "bg-gray-100 text-gray-800 min-h-screen";
    }
  };

  const getContainerClasses = () => {
      switch(theme) {
          case 'glass': return "glass rounded-xl shadow-2xl";
          case 'dark': return "bg-gray-800 border border-gray-700 rounded-lg";
          case 'win10': return "bg-white text-black shadow-lg rounded-none border-2 border-[#005a9e]";
          default: return "bg-white shadow-lg rounded-lg";
      }
  };

  return (
    <div className={`${getThemeClasses()} flex flex-col overflow-hidden`}>
      {/* Ticker */}
      {settings.tickerEnabled && (
        <div className="bg-black text-yellow-400 py-1 overflow-hidden whitespace-nowrap border-b border-yellow-600">
           <div className="animate-marquee inline-block px-4">
              {settings.tickerText}
           </div>
        </div>
      )}

      {/* Header */}
      <header className={`p-4 flex justify-between items-center ${theme === 'glass' ? 'bg-white/10' : theme === 'dark' ? 'bg-gray-800' : 'bg-white text-black shadow-md'}`}>
        <div className="flex items-center gap-4">
            {/* Mobile Menu Toggle */}
            <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
                className="md:hidden p-2 rounded hover:bg-black/10 transition-colors"
                aria-label="Toggle Menu"
            >
                {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>

            <h1 className="text-xl md:text-2xl font-bold truncate max-w-[200px] md:max-w-none">{settings.appName}</h1>
            
            <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${isConnected ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}`} title={isConnected ? "متصل بالخادم" : "غير متصل"}>
                {isConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
                <span className="hidden md:inline">{isConnected ? "متصل" : "غير متصل"}</span>
            </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
            {settings.whatsappNumber && (
                <a href={`https://wa.me/${settings.whatsappNumber}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full transition text-xs md:text-sm">
                    <Phone size={16} />
                    <span className="hidden md:inline">تواصل واتس آب</span>
                </a>
            )}
            
            {/* Theme Selector Trigger */}
            <button 
                onClick={() => setShowThemeSelector(true)}
                className="p-2 rounded-full hover:bg-black/10 transition-colors" 
                title="تغيير المظهر"
            >
                <Palette size={20} />
            </button>

            <div className="text-sm hidden md:block">
                مرحباً، <span className="font-bold">{user.name}</span>
            </div>
            <button onClick={handleLogout} className="text-red-500 hover:text-red-700 p-1">
                <LogOut size={20} />
            </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Overlay */}
        {isSidebarOpen && (
            <div 
                className="absolute inset-0 bg-black/50 z-20 md:hidden backdrop-blur-sm"
                onClick={() => setIsSidebarOpen(false)}
            />
        )}

        {/* Sidebar */}
        <div className={`
            absolute top-0 bottom-0 right-0 z-30 h-full shadow-2xl transition-transform duration-300 ease-in-out
            md:relative md:transform-none md:shadow-none
            ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
        `}>
            <Sidebar 
                currentView={currentView} 
                setView={(view) => {
                    setCurrentView(view);
                    setIsSidebarOpen(false);
                }} 
                user={user} 
                theme={theme}
                settings={settings}
                containerClass={`${theme === 'glass' ? 'bg-white/10 backdrop-blur-md' : theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50 border-l border-gray-200'} h-full`}
            />
        </div>

        {/* Main Content */}
        <main className="flex-1 p-2 md:p-4 overflow-y-auto w-full relative z-0">
            <div className={`p-3 md:p-6 min-h-full ${getContainerClasses()} transition-all duration-300`}>
                {currentView === 'sales' && <DailySales user={user} markets={markets} theme={theme} />}
                {currentView === 'salesLog' && <SalesLog user={user} markets={markets} theme={theme} />}
                {currentView === 'inventoryReg' && <InventoryRegistration user={user} markets={markets} theme={theme} />}
                {currentView === 'inventoryLog' && <InventoryLog user={user} markets={markets} theme={theme} />}
                {currentView === 'competitorPrices' && <CompetitorPrices user={user} markets={markets} theme={theme} />}
                {currentView === 'competitorReports' && <CompetitorReports user={user} markets={markets} theme={theme} />}
                {currentView === 'settings' && (
                    <Settings 
                        user={user} 
                        settings={settings} 
                        markets={markets}
                        theme={theme} 
                        setTheme={setTheme}
                    />
                )}
            </div>
        </main>
      </div>

      <footer className="p-2 text-center text-xs opacity-70 bg-black/5">
        مع تحيات المطور Amir Lamay
      </footer>

      {/* Global Theme Selector Modal */}
      {showThemeSelector && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowThemeSelector(false)}>
              <div 
                className={`p-6 rounded-xl shadow-2xl max-w-sm w-full ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-gray-900'}`} 
                onClick={e => e.stopPropagation()}
              >
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold flex items-center gap-2"><Palette size={20} /> اختر مظهر التطبيق</h3>
                      <button onClick={() => setShowThemeSelector(false)} className="opacity-50 hover:opacity-100"><X size={20}/></button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                       <button onClick={() => {setTheme('win10'); setShowThemeSelector(false)}} className={`p-4 border-2 rounded-lg hover:border-blue-500 transition flex flex-col items-center gap-2 ${theme === 'win10' ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent bg-gray-100 dark:bg-gray-700'}`}>
                          <div className="w-10 h-10 bg-[#0078D7] rounded shadow-md"></div>
                          <span className="font-semibold">Windows 10</span>
                       </button>
                       <button onClick={() => {setTheme('glass'); setShowThemeSelector(false)}} className={`p-4 border-2 rounded-lg hover:border-purple-500 transition flex flex-col items-center gap-2 ${theme === 'glass' ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-transparent bg-gray-100 dark:bg-gray-700'}`}>
                          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded shadow-md"></div>
                          <span className="font-semibold">Glass</span>
                       </button>
                       <button onClick={() => {setTheme('dark'); setShowThemeSelector(false)}} className={`p-4 border-2 rounded-lg hover:border-gray-500 transition flex flex-col items-center gap-2 ${theme === 'dark' ? 'border-gray-500 bg-gray-700 text-white' : 'border-transparent bg-gray-100 dark:bg-gray-700'}`}>
                          <div className="w-10 h-10 bg-gray-900 rounded border border-gray-600 shadow-md"></div>
                          <span className="font-semibold">Dark Mode</span>
                       </button>
                       <button onClick={() => {setTheme('light'); setShowThemeSelector(false)}} className={`p-4 border-2 rounded-lg hover:border-gray-400 transition flex flex-col items-center gap-2 ${theme === 'light' ? 'border-gray-400 bg-gray-200' : 'border-transparent bg-gray-100 dark:bg-gray-700'}`}>
                          <div className="w-10 h-10 bg-gray-100 rounded border shadow-md"></div>
                          <span className="font-semibold">Light</span>
                       </button>
                  </div>
              </div>
          </div>
      )}
      
      <style>{`
        @keyframes marquee {
            0% { transform: translateX(100%); }
            100% { transform: translateX(-100%); }
        }
        .animate-marquee {
            animation: marquee 20s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default App;