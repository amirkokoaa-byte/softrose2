
import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { ref, onValue, set, update, onDisconnect, serverTimestamp, remove } from "firebase/database";
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
import { Home, LogOut, Phone, Wifi, WifiOff, Menu, X, Palette, Bell, MailOpen, Check, Trash2, Clock, Copy, ExternalLink } from 'lucide-react';
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
    showCompetitorReports: false,
    showDailySales: true,
    showCompetitorPrices: true
  }
};

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<string>('sales');
  const [theme, setTheme] = useState<'glass' | 'dark' | 'win10' | 'light' | 'ocean' | 'forest' | 'midnight' | 'coffee' | 'royal'>('dark');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [markets, setMarkets] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showThemeSelector, setShowThemeSelector] = useState(false);
  
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null);

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

  // Real-time user data & permissions sync
  useEffect(() => {
    if (!user || !user.key || user.key === 'admin_root') return;

    const userRef = ref(db, `users/${user.key}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const updatedData = { ...snapshot.val(), key: user.key };
        setUser(updatedData);
        localStorage.setItem('soft_rose_user', JSON.stringify(updatedData));
      }
    });

    return () => unsubscribe();
  }, [user?.key]);

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
        } else {
            setNotifications([]);
            setUnreadCount(0);
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

  const markAsRead = (id: string) => {
    if (!user) return;
    update(ref(db, `notifications/${user.username}/${id}`), { isRead: true });
  };

  const deleteNotif = (id: string) => {
    if (!user) return;
    remove(ref(db, `notifications/${user.username}/${id}`));
  };

  const copyNotifText = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("تم نسخ نص الرسالة بنجاح");
  };

  if (!user) return <Login onLogin={setUser} theme={theme} />;

  const getThemeClasses = () => {
    switch (theme) {
      case 'dark': return "bg-black text-white min-h-screen";
      case 'glass': return "bg-[#1a0b2e] text-white min-h-screen bg-[url('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=2564&auto=format&fit=crop')] bg-cover bg-fixed";
      case 'win10': return "bg-[#002b4a] text-white min-h-screen";
      case 'light': return "bg-gray-100 text-gray-900 min-h-screen";
      case 'ocean': return "bg-[#004d40] text-white min-h-screen";
      case 'forest': return "bg-[#1b3022] text-white min-h-screen";
      case 'midnight': return "bg-[#0a001a] text-white min-h-screen";
      case 'coffee': return "bg-[#f5f1ed] text-[#3e2723] min-h-screen";
      case 'royal': return "bg-[#121212] text-[#d4af37] min-h-screen";
      default: return "bg-black text-white min-h-screen";
    }
  };

  const headerBg = () => {
      if (theme === 'light' || theme === 'coffee') return 'bg-white/90 border-b border-gray-200 text-gray-900 shadow backdrop-blur-md';
      if (theme === 'glass') return 'bg-black/40 backdrop-blur-lg border-b border-white/10 text-white';
      if (theme === 'royal') return 'bg-black/80 border-b border-[#d4af37]/30 text-[#d4af37] shadow-xl';
      return 'bg-black/60 backdrop-blur-md border-b border-white/10 text-white shadow-lg';
  };

  const mainContentBg = () => {
      if (theme === 'light') return 'bg-white border border-gray-200';
      if (theme === 'coffee') return 'bg-white/80 border border-[#d7ccc8] shadow-sm';
      if (theme === 'glass') return 'bg-white/10 backdrop-blur-md border border-white/10';
      if (theme === 'win10') return 'bg-[#003d66]/60 border border-white/10';
      if (theme === 'ocean') return 'bg-[#00695c]/40 border border-white/5';
      if (theme === 'forest') return 'bg-[#2e4d38]/40 border border-white/5';
      if (theme === 'midnight') return 'bg-[#150036]/60 border border-white/5';
      if (theme === 'royal') return 'bg-black/40 border border-[#d4af37]/20 shadow-inner';
      return 'bg-gray-900/40 border border-white/5';
  };

  return (
    <div className={`${getThemeClasses()} flex flex-col overflow-hidden transition-all duration-700`}>
      {settings.tickerEnabled && (
        <div className={`${(theme === 'light' || theme === 'coffee') ? 'bg-gray-200/80 text-blue-600' : 'bg-black/80 text-yellow-400'} py-1 overflow-hidden whitespace-nowrap border-b border-white/10 z-50 backdrop-blur-md`}>
           <div className="animate-marquee inline-block px-4 font-bold">{settings.tickerText}</div>
        </div>
      )}

      <header className={`p-4 flex justify-between items-center z-50 ${headerBg()} transition-all duration-500`}>
        <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-all">
                {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h1 className="text-lg md:text-2xl font-bold truncate flex items-center gap-2">
                {settings.appName}
                <span className={`text-sm font-normal opacity-60 hidden sm:inline-block border-r border-current pr-2 mr-2`}>
                  | <span className="font-bold">{user.name}</span>
                </span>
            </h1>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
            {settings.whatsappNumber && (
                <a 
                    href={`https://wa.me/${settings.whatsappNumber}`} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="p-2 rounded-full hover:bg-green-500/10 text-green-500 transition-colors"
                    title="الدعم الفني"
                >
                    <Phone size={20} />
                </a>
            )}

            {user.role === 'admin' && (
              <div className="relative">
                  <button 
                      onClick={() => setShowThemeSelector(!showThemeSelector)} 
                      className={`p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${showThemeSelector ? 'bg-black/10 dark:bg-white/10' : ''}`}
                      title="تغيير المظهر"
                  >
                      <Palette size={20} />
                  </button>
                  {showThemeSelector && (
                      <div className="absolute left-0 mt-2 w-52 bg-gray-900 text-white rounded-xl shadow-2xl border border-white/10 p-2 animate-in fade-in zoom-in duration-200 z-[60]">
                          <div className="text-[10px] font-bold text-gray-400 px-3 py-1 uppercase mb-1">اختر المظهر الجديد</div>
                          <div className="max-h-80 overflow-y-auto custom-scrollbar">
                            {/* Themes loop same as before */}
                          </div>
                      </div>
                  )}
              </div>
            )}

            {/* Notification System */}
            <div className="relative">
                <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className={`relative p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 ${showNotifDropdown ? 'bg-black/10 dark:bg-white/10' : ''}`}>
                    <Bell size={20} />
                    {unreadCount > 0 && <span className="absolute top-1 right-1 bg-red-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full border border-black">{unreadCount}</span>}
                </button>
                {showNotifDropdown && (
                    <div className="absolute left-0 mt-2 w-72 md:w-80 bg-gray-900 text-white rounded-2xl shadow-2xl border border-white/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[60]">
                        <div className="p-4 bg-black border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold text-sm flex items-center gap-2 text-white"><Bell size={16} className="text-blue-500"/> الإشعارات</h3>
                            <span className="text-[10px] bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-full font-bold">{unreadCount} جديدة</span>
                        </div>
                        <div className="max-h-80 overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-10 text-center opacity-30 italic text-sm">لا توجد إشعارات حالياً</div>
                            ) : (
                                notifications.map(n => (
                                    <div 
                                      key={n.id} 
                                      onClick={() => { setSelectedNotif(n); markAsRead(n.id!); setShowNotifDropdown(false); }}
                                      className={`p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition relative group cursor-pointer ${!n.isRead ? 'bg-blue-600/10' : ''}`}
                                    >
                                        <div className="flex justify-between items-start mb-1 text-white">
                                            <span className="text-[10px] font-bold text-blue-400 flex items-center gap-1"><Clock size={10}/> {new Date(n.timestamp).toLocaleTimeString('ar-EG', {hour:'2-digit', minute:'2-digit'})}</span>
                                            <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                                <button onClick={() => deleteNotif(n.id!)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-md transition" title="حذف">
                                                    <Trash2 size={12}/>
                                                </button>
                                                {!n.isRead && <button onClick={() => markAsRead(n.id!)} className="p-1.5 text-green-400 hover:bg-green-500/20 rounded-md transition" title="مقروء">
                                                    <Check size={12}/>
                                                </button>}
                                            </div>
                                        </div>
                                        <div className="text-xs font-bold mb-0.5 text-white">{n.sender}</div>
                                        <div className="text-[11px] leading-relaxed opacity-70 line-clamp-2 text-white">{n.message}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            <button onClick={handleLogout} className="text-red-500 p-2 rounded-full hover:bg-red-500/10 transition-colors" title="تسجيل الخروج">
                <LogOut size={20} />
            </button>
        </div>
      </header>

      {/* Selected Notification Popup (Modal) */}
      {selectedNotif && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 backdrop-blur-md animate-in fade-in duration-200" onClick={() => setSelectedNotif(null)}>
              <div className="w-full max-w-md bg-gray-900 rounded-3xl shadow-2xl overflow-hidden text-white animate-in zoom-in duration-300 border border-white/10" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-white/10 bg-black flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-xl">
                              <Bell size={20}/>
                          </div>
                          <div>
                              <h3 className="font-bold text-lg">مرسل: {selectedNotif.sender}</h3>
                              <p className="text-[10px] text-gray-500 font-bold">{new Date(selectedNotif.timestamp).toLocaleString('ar-EG')}</p>
                          </div>
                      </div>
                      <button onClick={() => setSelectedNotif(null)} className="p-2 hover:bg-white/10 rounded-full transition"><X/></button>
                  </div>
                  <div className="p-8 bg-gray-900 min-h-[150px]">
                      <div className="text-sm leading-relaxed whitespace-pre-wrap select-all bg-white/5 p-4 rounded-2xl border border-white/10">
                          {selectedNotif.message}
                      </div>
                  </div>
                  <div className="p-4 bg-black border-t border-white/10 flex gap-3">
                      <button 
                          onClick={() => copyNotifText(selectedNotif.message)} 
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition"
                      >
                          <Copy size={18}/> نسخ النص
                      </button>
                      <button 
                          onClick={() => { deleteNotif(selectedNotif.id!); setSelectedNotif(null); }} 
                          className="px-6 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white font-bold py-3 rounded-xl transition border border-red-600/30"
                      >
                          <Trash2 size={18} />
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {/* ... Sidebar and Main content ... */}
        <div className={`fixed md:relative top-0 bottom-0 right-0 z-50 h-full transition-transform duration-300 ease-in-out md:transform-none ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
            <Sidebar 
                currentView={currentView} 
                setView={(view) => { setCurrentView(view); setIsSidebarOpen(false); }} 
                user={user} 
                theme={theme} 
                settings={settings} 
                containerClass={`${(theme === 'light' || theme === 'coffee') ? 'bg-white border-l border-gray-200' : theme === 'royal' ? 'bg-[#0a0a0a] border-l border-[#d4af37]/20' : 'bg-black/40 backdrop-blur-md border-l border-white/10'} h-full shadow-2xl`} 
            />
        </div>
        
        <main className="flex-1 p-2 md:p-4 overflow-y-auto w-full" onClick={() => isSidebarOpen && setIsSidebarOpen(false)}>
            <div className={`p-4 md:p-6 min-h-full rounded-2xl shadow-lg ${mainContentBg()} transition-all duration-500`}>
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
