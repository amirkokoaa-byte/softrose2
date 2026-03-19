
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
import { Home, LogOut, Phone, Wifi, WifiOff, Menu, X, Palette, Bell, MailOpen, Check, Trash2, Clock, Copy, ExternalLink, Sparkles, MessageCircle } from 'lucide-react';
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
  const [theme, setTheme] = useState<'dark'>('dark');
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [markets, setMarkets] = useState<string[]>([]);
  const [products, setProducts] = useState<{id: string, name: string, category: string}[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [welcomeToast, setWelcomeToast] = useState<string | null>(null);
  
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null);

  useEffect(() => {
    const settingsRef = ref(db, 'settings/app');
    const marketsRef = ref(db, 'settings/markets');
    const productsRef = ref(db, 'products');
    const connectedRef = ref(db, ".info/connected");

    onValue(settingsRef, (snapshot) => {
      if (snapshot.exists()) setSettings({...DEFAULT_SETTINGS, ...snapshot.val()});
    });

    onValue(productsRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const prods = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setProducts(prods);
      } else {
        // Initialize from constants if empty
        import('./constants').then(constants => {
          const initialProducts: any[] = [];
          const addCat = (items: string[], cat: string) => {
            items.forEach(name => {
              const id = "prod_" + Math.random().toString(36).substr(2, 9);
              initialProducts.push({ id, name, category: cat });
            });
          };
          addCat(constants.PRODUCTS_FACIAL, 'Facial');
          addCat(constants.PRODUCTS_KITCHEN, 'Kitchen');
          addCat(constants.PRODUCTS_TOILET, 'Toilet');
          addCat(constants.PRODUCTS_DOLPHIN, 'Dolphin');
          
          const updates: any = {};
          initialProducts.forEach(p => {
            updates[p.id] = { name: p.name, category: p.category };
          });
          update(ref(db, 'products'), updates);
        });
      }
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
    if (!user || !user.key || user.key === 'admin_root') return;
    const userRef = ref(db, `users/${user.key}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const updatedData = { ...snapshot.val(), key: user.key };
        setUser(updatedData);
      }
    });
    return () => unsubscribe();
  }, [user?.key]);

  useEffect(() => {
    if (!user) return;
    setWelcomeToast(`مرحباً ${user.name}`);
    const timer = setTimeout(() => setWelcomeToast(null), 3000);

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

    return () => clearTimeout(timer);
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
    setSelectedNotif(null);
  };

  const openWhatsApp = () => {
    if (settings.whatsappNumber) {
      window.open(`https://wa.me/${settings.whatsappNumber}`, '_blank');
    } else {
      alert("رقم الواتساب غير مسجل في الإعدادات");
    }
  };

  if (!user) return <Login onLogin={setUser} theme={theme} />;

  return (
    <div className="bg-black text-white min-h-screen flex flex-col overflow-hidden relative">
      {welcomeToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] bg-blue-600 px-6 py-3 rounded-2xl shadow-2xl font-bold flex items-center gap-2 toast-in border border-white/20">
            <Sparkles size={18} />
            {welcomeToast}
        </div>
      )}

      {settings.tickerEnabled && (
        <div className="bg-black/90 text-yellow-400 py-1.5 overflow-hidden whitespace-nowrap border-b border-white/10 z-50">
           <div className="animate-marquee inline-block px-4 font-bold">{settings.tickerText}</div>
        </div>
      )}

      <header className="p-4 flex justify-between items-center z-50 bg-black/80 backdrop-blur-md border-b border-white/10 text-white shadow-lg">
        <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 rounded-lg hover:bg-white/10">
                {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h1 className="text-lg md:text-2xl font-bold truncate">
                {settings.appName}
            </h1>
        </div>
        
        <div className="flex items-center gap-2 md:gap-4">
            {/* زر الواتساب */}
            <button onClick={openWhatsApp} className="p-2 rounded-full hover:bg-green-500/10 text-green-500 transition-colors" title="واتساب الدعم">
                <MessageCircle size={22} />
            </button>

            <div className="relative">
                <button onClick={() => setShowNotifDropdown(!showNotifDropdown)} className="relative p-2 rounded-full hover:bg-white/10">
                    <Bell size={20} />
                    {unreadCount > 0 && <span className="absolute top-1 right-1 bg-red-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full">{unreadCount}</span>}
                </button>
                {showNotifDropdown && (
                    <div className="absolute left-0 mt-2 w-72 md:w-80 bg-gray-900 text-white rounded-2xl shadow-2xl border border-white/10 overflow-hidden z-[60]">
                        <div className="p-4 bg-black border-b border-white/10 flex justify-between items-center">
                            <h3 className="font-bold text-sm text-white">الإشعارات</h3>
                        </div>
                        <div className="max-h-80 overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-10 text-center opacity-30 italic text-sm text-white">لا توجد إشعارات</div>
                            ) : (
                                notifications.map(n => (
                                    <div 
                                      key={n.id} 
                                      onClick={() => { setSelectedNotif(n); markAsRead(n.id!); setShowNotifDropdown(false); }}
                                      className={`p-4 border-b border-white/5 last:border-0 hover:bg-white/5 cursor-pointer ${!n.isRead ? 'bg-blue-600/10' : ''}`}
                                    >
                                        <div className="text-xs font-bold mb-0.5 text-white">{n.sender}</div>
                                        <div className="text-[11px] opacity-70 line-clamp-2 text-white">{n.message}</div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            <button onClick={handleLogout} className="text-red-500 p-2 rounded-full hover:bg-red-500/10 transition-colors">
                <LogOut size={20} />
            </button>
        </div>
      </header>

      {/* نافذة تفاصيل الإشعار */}
      {selectedNotif && (
        <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto my-auto">
          <div className="bg-gray-900 border border-white/20 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 my-auto">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <Bell className="text-blue-500" size={20} />
                <h3 className="font-bold text-white">تفاصيل الإشعار</h3>
              </div>
              <button onClick={() => setSelectedNotif(null)} className="text-white/50 hover:text-white"><X size={20}/></button>
            </div>
            <div className="mb-8">
              <div className="text-xs font-black opacity-40 uppercase mb-2">المرسل: {selectedNotif.sender}</div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-sm leading-relaxed text-gray-200">
                {selectedNotif.message}
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(selectedNotif.message);
                  alert("تم النسخ بنجاح");
                }}
                className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition"
              >
                <Copy size={16}/> نسخ النص
              </button>
              <button 
                onClick={() => deleteNotif(selectedNotif.id!)}
                className="flex-1 bg-red-600/20 hover:bg-red-600 text-red-500 hover:text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition"
              >
                <Trash2 size={16}/> حذف الإشعار
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        {isSidebarOpen && (
            <div 
                className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm transition-opacity"
                onClick={() => setIsSidebarOpen(false)}
            />
        )}
        <div className={`fixed md:relative top-0 bottom-0 right-0 z-50 h-full transition-transform duration-300 md:transform-none ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}`}>
            <Sidebar 
                currentView={currentView} 
                setView={(view) => { setCurrentView(view); setIsSidebarOpen(false); }} 
                user={user} 
                theme={theme} 
                settings={settings} 
                containerClass="bg-black/60 backdrop-blur-2xl border-l border-white/10 h-full shadow-2xl" 
            />
        </div>
        
        <main className="flex-1 p-2 md:p-4 overflow-y-auto w-full">
            <div className={`p-4 md:p-6 min-h-full rounded-2xl shadow-xl bg-gray-900/60 border border-white/5`}>
                {currentView === 'sales' && <DailySales user={user} markets={markets} theme={theme} products={products} />}
                {currentView === 'salesLog' && <SalesLog user={user} markets={markets} theme={theme} />}
                {currentView === 'inventoryReg' && <InventoryRegistration user={user} markets={markets} theme={theme} products={products} />}
                {currentView === 'inventoryLog' && <InventoryLog user={user} markets={markets} theme={theme} />}
                {currentView === 'competitorPrices' && <CompetitorPrices user={user} markets={markets} theme={theme} products={products} />}
                {currentView === 'competitorReports' && <CompetitorReports user={user} markets={markets} theme={theme} />}
                {currentView === 'leaveBalance' && <LeaveBalanceComponent user={user} theme={theme} />}
                {currentView === 'settings' && <Settings user={user} settings={settings} markets={markets} theme={theme} setTheme={setTheme as any} />}
            </div>
        </main>
      </div>

      <footer className="py-2 px-4 text-center text-[10px] font-bold opacity-50 text-white border-t border-white/5">
          مع تحيات المطور Amir Lamay
      </footer>
    </div>
  );
};

export default App;
