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
import { Home, LogOut, Phone } from 'lucide-react';
import { INITIAL_MARKETS } from './constants';

// Default Settings
const DEFAULT_SETTINGS: AppSettings = {
  appName: "Soft Rose Modern Trade",
  tickerText: "أهلاً بكم في نظام سوفت روز للتجارة الحديثة",
  tickerEnabled: true,
  whatsappNumber: ""
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<string>('sales');
  const [theme, setTheme] = useState<'glass' | 'dark' | 'win10' | 'light'>('win10');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [markets, setMarkets] = useState<string[]>(INITIAL_MARKETS);
  
  // Realtime Listeners
  useEffect(() => {
    const settingsRef = ref(db, 'settings/app');
    const marketsRef = ref(db, 'settings/markets');

    onValue(settingsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) setSettings(data);
    });

    onValue(marketsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setMarkets(Object.values(data));
      } else {
         setMarkets(INITIAL_MARKETS);
      }
    });
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
            <h1 className="text-2xl font-bold">{settings.appName}</h1>
        </div>
        <div className="flex items-center gap-4">
            {settings.whatsappNumber && (
                <a href={`https://wa.me/${settings.whatsappNumber}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-full transition">
                    <Phone size={18} />
                    <span>تواصل واتس آب</span>
                </a>
            )}
            <div className="text-sm">
                مرحباً، <span className="font-bold">{user.name}</span>
            </div>
            <button onClick={handleLogout} className="text-red-500 hover:text-red-700">
                <LogOut size={20} />
            </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <Sidebar 
            currentView={currentView} 
            setView={setCurrentView} 
            user={user} 
            theme={theme}
            containerClass={theme === 'glass' ? 'bg-white/10 backdrop-blur-md' : theme === 'dark' ? 'bg-gray-800' : 'bg-gray-50 border-l border-gray-200'}
        />

        {/* Main Content */}
        <main className="flex-1 p-4 overflow-y-auto">
            <div className={`p-6 min-h-full ${getContainerClasses()} transition-all duration-300`}>
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

      <footer className="p-2 text-center text-xs opacity-70">
        مع تحيات المطور Amir Lamay
      </footer>
      
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