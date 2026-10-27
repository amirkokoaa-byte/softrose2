import { onCachedValue } from "./firebaseCache";

import React, { useState, useEffect, useRef } from 'react';
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
import ProductsRegistry from './components/ProductsRegistry';
import { CustomerFeedbackComponent } from './components/CustomerFeedback';
import LeaveBalanceComponent from './components/LeaveBalance';
import { Attendance } from './components/Attendance';
import BranchNumbers from './components/BranchNumbers';
import Employees from './components/Employees';
import Settings from './components/Settings';
import { Home, LogOut, Phone, Wifi, WifiOff, Menu, X, Palette, Bell, MailOpen, Check, Trash2, Clock, Copy, ExternalLink, Sparkles, MessageCircle, ChevronUp, Download, Smartphone, Monitor, Share2, PlusSquare, CheckCircle2 } from 'lucide-react';
import { INITIAL_MARKETS } from './constants';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DEFAULT_SETTINGS: AppSettings = {
  appName: "Soft Rose Modern Trade",
  tickerText: "أهلاً بكم في نظام سوفت روز للتجارة الحديثة",
  tickerEnabled: true,
  whatsappNumber: "",
  appDownloadLink: "",
  appStoreLink: "",
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
  const [products, setProducts] = useState<{id: string, name: string, category: string, order?: number}[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);
  const [welcomeToast, setWelcomeToast] = useState<string | null>(null);
  
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [selectedNotif, setSelectedNotif] = useState<AppNotification | null>(null);
  const [highlightSaleId, setHighlightSaleId] = useState<string | null>(null);

  const mainRef = useRef<HTMLElement>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // حالات تثبيت التطبيق (PWA) والنافذة المنبثقة للتثبيت
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isPWAInstalled, setIsPWAInstalled] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsPWAInstalled(isStandalone);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsPWAInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleDirectPWAInstall = async () => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsPWAInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
    } catch (e) {
      console.error('PWA install error:', e);
    }
    return false;
  };

  const getConfiguredDownloadUrl = (): string => {
    const raw = (settings.appStoreLink && settings.appStoreLink.trim()) ||
                (settings.appDownloadLink && settings.appDownloadLink.trim()) ||
                '';
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw;
    return `https://${raw}`;
  };

  const handleDownloadAppClick = async () => {
    const configuredUrl = getConfiguredDownloadUrl();
    if (configuredUrl) {
      const link = document.createElement('a');
      link.href = configuredUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }
    if (deferredPrompt) {
      await handleDirectPWAInstall();
      return;
    }
    alert('يرجى إدخال رابط التطبيق في (الإعدادات > إعدادات التطبيق) أو اتباع تعليمات التثبيت بالأسفل.');
  };

  useEffect(() => {
    const mainEl = mainRef.current;
    const handleScroll = () => {
      const scrollPos = mainEl ? mainEl.scrollTop : (window.scrollY || document.documentElement.scrollTop);
      setShowScrollTop(scrollPos > 120);
    };

    if (mainEl) {
      mainEl.addEventListener('scroll', handleScroll, { passive: true });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      if (mainEl) mainEl.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
    };
  }, [user]);

  const scrollToTop = () => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const settingsRef = ref(db, 'settings/app');
    const marketsRef = ref(db, 'settings/markets');
    const productsRef = ref(db, 'products');
    const connectedRef = ref(db, ".info/connected");

    const unsubSettings = onCachedValue(settingsRef, 'settings_app', (snapshot) => {
      if (snapshot.exists()) setSettings({...DEFAULT_SETTINGS, ...snapshot.val()});
    });

    const unsubProducts = onCachedValue(productsRef, 'products', (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const prods = Object.keys(data).map(key => {
          const item = data[key];
          let name = typeof item === 'string' ? item : item?.name || '';
          if (typeof name === 'object' && name !== null) name = name.name || String(name);
          return {
            id: key,
            name: String(name),
            category: item?.category || 'Uncategorized',
            order: item?.order || 0
          };
        }).sort((a, b) => (a.order || 0) - (b.order || 0));
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

    const unsubMarkets = onCachedValue(marketsRef, 'settings_markets', (snapshot) => {
      const systemMarkets = INITIAL_MARKETS.map(name => ({ name, createdBy: 'system' }));
      const dbMarkets = snapshot.exists() ? Object.values(snapshot.val()).map((m: any) => {
        if (typeof m === 'string') return { name: m, createdBy: 'system' };
        if (m && typeof m === 'object') {
            let extractedName = m.name;
            if (typeof extractedName === 'object' && extractedName !== null) {
                extractedName = extractedName.name || String(extractedName);
            }
            return { name: extractedName, createdBy: m.createdBy || 'system' };
        }
        return { name: String(m), createdBy: 'system' };
      }) : [];

      const allCombined = [...systemMarkets, ...dbMarkets];

      if (user) {
        let filtered;
        if (user.role === 'admin') {
          filtered = allCombined;
        } else {
          filtered = allCombined.filter(m => m.createdBy === 'system' || m.createdBy === user.username);
        }
        const uniqueNames = Array.from(new Set(filtered.map(m => m.name).filter(n => typeof n === 'string' && n !== '[object Object]')));
        if (user.market) uniqueNames.push(user.market);
        if (Array.isArray(user.branches)) uniqueNames.push(...user.branches);
        INITIAL_MARKETS.forEach(im => {
          if (!uniqueNames.includes(im)) uniqueNames.push(im);
        });
        setMarkets(Array.from(new Set(uniqueNames.filter(Boolean))));
      }
    }, { onlyOnce: false });

    const unsubConnected = onValue(connectedRef, (snap) => setIsConnected(!!snap.val()));
    return () => { unsubSettings(); unsubProducts(); unsubMarkets(); unsubConnected(); };
  }, [user?.username, user?.role]);

  useEffect(() => {
    if (!user || user.key === 'admin_root') return;
    if (user.key) {
      const userRef = ref(db, `users/${user.key}`);
      const unsubscribe = onValue(userRef, (snapshot) => {
        if (snapshot.exists()) {
          const updatedData = { ...snapshot.val(), key: user.key };
          setUser(prev => {
            if (!prev) return updatedData;
            // Check if anything relevant changed
            const permsChanged = JSON.stringify(prev.permissions) !== JSON.stringify(updatedData.permissions);
            const roleChanged = prev.role !== updatedData.role;
            const nameChanged = prev.name !== updatedData.name;
            if (permsChanged || roleChanged || nameChanged) {
              try {
                localStorage.setItem('soft_rose_user', JSON.stringify(updatedData));
              } catch (e) {}
              return updatedData;
            }
            return prev;
          });
        }
      });
      return () => unsubscribe();
    }
  }, [user?.key]);

  useEffect(() => {
    if (!user) return;
    setWelcomeToast(`مرحباً ${user.name}`);
    const timer = setTimeout(() => setWelcomeToast(null), 3000);

    const safeKey = user.username.replace(/[.#$/[\]]/g, "_");
    const userStatusRef = ref(db, `status/${safeKey}`);
    set(userStatusRef, { online: true, lastSeen: serverTimestamp(), name: user.name, username: user.username });
    onDisconnect(userStatusRef).set({ online: false, lastSeen: serverTimestamp(), name: user.name, username: user.username });

    const fetchNotifs = () => {
        const unsubUser = onValue(ref(db, `notifications/${user.username}`), (snapshot) => {
            const data = snapshot.val();
            const list = data ? Object.keys(data).map(key => ({ id: key, notifPath: `notifications/${user.username}/${key}`, ...data[key] })) : [];
            setNotifications(prev => {
                const others = prev.filter(n => n.type === 'admin_alert');
                const newAll = [...others, ...list].sort((a,b) => b.timestamp - a.timestamp);
                setUnreadCount(newAll.filter(n => !n.isRead).length);
                return newAll;
            });
        });

        let unsubAdmin = () => {};
        if (user.role === 'admin') {
            unsubAdmin = onValue(ref(db, `notifications/admin_alerts`), (snapshot) => {
                const data = snapshot.val();
                const list = data ? Object.keys(data).map(key => ({ id: key, notifPath: `notifications/admin_alerts/${key}`, type: 'admin_alert', ...data[key] })) : [];
                setNotifications(prev => {
                    const others = prev.filter(n => n.type !== 'admin_alert');
                    const newAll = [...others, ...list].sort((a,b) => b.timestamp - a.timestamp);
                    setUnreadCount(newAll.filter(n => !n.isRead).length);
                    return newAll;
                });
            });
        }
        return () => { unsubUser(); unsubAdmin(); };
    };
    const unsubNotifs = fetchNotifs();

    return () => { clearTimeout(timer); unsubNotifs(); };
  }, [user?.username]);

  useEffect(() => {
    // مراقبة النوافذ المنبثقة للتأكد من أنها تفتح دائماً في أعلى الشاشة وإخفاء الشريط العلوي فور فتح أي شاشة منبثقة
    const checkModals = () => {
      const modal = document.querySelector<HTMLElement>(
        'div[class*="fixed"][class*="z-[999"], div[class*="fixed"][class*="z-[100"], div[class*="fixed"][class*="z-[120"], div[class*="fixed"][class*="z-[140"]'
      );
      const open = !!modal;
      setIsAnyModalOpen(open);
      if (open) {
        document.body.classList.add('modal-open');
        if (modal && modal.dataset.modalInit !== 'true') {
          modal.scrollTop = 0;
          modal.dataset.modalInit = 'true';
        }
      } else {
        document.body.classList.remove('modal-open');
      }
    };

    const observer = new MutationObserver(() => {
      checkModals();
    });

    observer.observe(document.body, { childList: true, subtree: true });
    checkModals();

    return () => {
      observer.disconnect();
      document.body.classList.remove('modal-open');
    };
  }, []);

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
    const notif = notifications.find(n => n.id === id);
    if (notif && notif.notifPath) {
        update(ref(db, notif.notifPath), { isRead: true });
    } else {
        update(ref(db, `notifications/${user.username}/${id}`), { isRead: true });
    }
  };

  const deleteNotif = (id: string) => {
    if (!user) return;
    const notif = notifications.find(n => n.id === id);
    if (notif && notif.notifPath) {
        remove(ref(db, notif.notifPath));
    } else {
        remove(ref(db, `notifications/${user.username}/${id}`));
    }
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
    <div className="bg-slate-950 text-white min-h-screen flex flex-col overflow-hidden relative selection:bg-blue-500/30">
      {/* خلفيات إضاءة نيون هادئة متوهجة تبرز وتدعم تأثير الزجاج المصنفر الشفاف Glassmorphism */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '6s' }} />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-blue-500/15 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDuration: '8s' }} />
      </div>

      {welcomeToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[200] backdrop-blur-xl bg-slate-900/65 px-6 py-3 rounded-2xl border border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.35)] font-bold flex items-center gap-2 toast-in text-white transition-all duration-300">
            <Sparkles size={18} className="text-blue-400" />
            {welcomeToast}
        </div>
      )}

      {settings.tickerEnabled && (
        <div className={`${isSidebarOpen || isAnyModalOpen ? 'hidden' : 'block'} app-top-ticker backdrop-blur-xl bg-slate-900/65 text-yellow-300 py-1.5 overflow-hidden whitespace-nowrap border-b border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.35)] z-50 transition-all duration-300`}>
           <div className="animate-marquee inline-block px-4 font-bold">{settings.tickerText}</div>
        </div>
      )}

      <header className={`${isAnyModalOpen ? 'hidden' : isSidebarOpen ? 'hidden md:flex' : 'flex'} app-main-header sticky top-0 z-40 p-3 md:p-4 justify-between items-center backdrop-blur-xl bg-slate-900/65 border-b border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.35)] text-white transition-all duration-300 shrink-0 gap-2`}>
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="md:hidden p-2 rounded-xl hover:bg-blue-500/20 text-white transition-all duration-300 border border-transparent hover:border-blue-500/40 shrink-0">
                {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <h1 className="text-base sm:text-lg md:text-2xl font-bold truncate text-white drop-shadow-[0_0_12px_rgba(59,130,246,0.4)]">
                {settings.appName}
            </h1>
        </div>

        {/* زر تثبيت ما بين Soft Rose وزر المراسلة في نسخة الهاتف والكمبيوتر */}
        <div className="flex items-center justify-center shrink-0">
            <button
                onClick={() => setShowInstallModal(true)}
                className="px-3 md:px-4 py-1.5 md:py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs md:text-sm flex items-center gap-1.5 shadow-[0_0_15px_rgba(6,182,212,0.4)] hover:shadow-[0_0_22px_rgba(6,182,212,0.65)] border border-cyan-400/40 transition-all duration-300 active:scale-95 cursor-pointer"
                title="تثبيت التطبيق على الجهاز"
            >
                <Download size={16} className="shrink-0" />
                <span>تثبيت</span>
            </button>
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4 shrink-0">
            {/* زر الواتساب */}
            <button onClick={openWhatsApp} className="p-2.5 rounded-xl hover:bg-green-500/20 text-green-400 hover:text-green-300 transition-all duration-300 border border-transparent hover:border-green-500/40 hover:shadow-[0_0_15px_rgba(34,197,94,0.35)]" title="واتساب الدعم">
                <MessageCircle size={22} />
            </button>

            <div className="relative">
                <button onClick={() => {
        setShowNotifDropdown(!showNotifDropdown);
        if (!showNotifDropdown && user.role === 'admin') {
            // mark all as read
            notifications.filter(n => !n.isRead).forEach(n => {
                if (n.notifPath) update(ref(db, n.notifPath), { isRead: true });
            });
            setUnreadCount(0);
        }
    }} className="relative p-2.5 rounded-xl hover:bg-blue-500/20 text-blue-300 hover:text-white transition-all duration-300 border border-transparent hover:border-blue-500/40">
                    <Bell size={20} />
                    {unreadCount > 0 && <span className="absolute top-1 right-1 bg-red-600 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)]">{unreadCount}</span>}
                </button>
                {showNotifDropdown && (
                    <div className="absolute left-0 mt-2 w-72 md:w-80 backdrop-blur-xl bg-slate-900/65 text-white rounded-3xl shadow-[0_0_20px_rgba(59,130,246,0.35)] border border-blue-500/40 overflow-hidden z-[60] transition-all duration-300">
                        <div className="p-4 backdrop-blur-xl bg-slate-900/80 border-b border-blue-500/30 flex justify-between items-center">
                            <h3 className="font-bold text-sm text-blue-300">الإشعارات</h3>
                        </div>
                        <div className="max-h-80 overflow-y-auto custom-scrollbar">
                            {notifications.length === 0 ? (
                                <div className="p-10 text-center opacity-40 italic text-sm text-white">لا توجد إشعارات</div>
                            ) : (
                                notifications.map(n => (
                                    <div 
                                      key={n.id} 
                                      onClick={() => { 
                                          markAsRead(n.id!); 
                                          setShowNotifDropdown(false); 
                                          if (n.saleId || n.actionType === 'comment') {
                                              if (n.saleId) {
                                                  setHighlightSaleId(n.saleId);
                                              }
                                              setCurrentView('salesLog');
                                          } else if (n.actionType === 'prices' && user.role === 'admin') {
                                              setCurrentView('competitorReports'); 
                                          } else {
                                              setSelectedNotif(n);
                                          }
                                      }}
                                      className={`p-4 border-b border-blue-500/20 last:border-0 hover:bg-blue-500/15 cursor-pointer transition-all duration-200 ${!n.isRead ? 'bg-blue-600/20' : ''}`}
                                    >
                                        <div className="font-bold text-sm text-blue-400 mb-1">{n.sender || 'System'}</div>
                                        <div className="text-xs text-white opacity-80 mb-2">{n.message}</div>
                                        <div className="flex justify-between items-center text-[9px] opacity-40">
                                            <span>{n.dateString || new Date(n.timestamp).toLocaleDateString('ar-EG')}</span>
                                            <span>{n.timeString || new Date(n.timestamp).toLocaleTimeString('ar-EG')}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            <button onClick={handleLogout} className="text-red-400 hover:text-red-300 p-2.5 rounded-xl hover:bg-red-500/20 transition-all duration-300 border border-transparent hover:border-red-500/40 hover:shadow-[0_0_15px_rgba(239,68,68,0.35)]">
                <LogOut size={20} />
            </button>
        </div>
      </header>

      {/* نافذة تثبيت التطبيق وتعليمات التسطيب (PWA & Download) */}
      {showInstallModal && (
        <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto my-auto">
          <div className="backdrop-blur-xl bg-slate-900/95 border border-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.35)] w-full max-w-xl rounded-3xl p-5 md:p-6 text-white transition-all duration-300 animate-in zoom-in-95 my-auto max-h-[90vh] overflow-y-auto custom-scrollbar">
            {/* رأس النافذة */}
            <div className="flex justify-between items-center border-b border-white/10 pb-4 mb-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
                  <Smartphone size={24} />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-black text-white">تثبيت تطبيق {settings.appName}</h3>
                  <p className="text-xs text-cyan-300/80 font-bold">يعمل كتطبيق أصلي (Native App) على الهاتف والكمبيوتر</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstallModal(false)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* زر داون لود (يفتح رابط الملف المدخل في إعدادات التطبيق) + زر التثبيت المباشر */}
            <div className="bg-slate-950/70 border border-cyan-500/30 rounded-2xl p-4 mb-5 space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleDownloadAppClick}
                  className="flex-1 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm md:text-base flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_25px_rgba(16,185,129,0.65)] border border-emerald-400/40 transition-all active:scale-95 cursor-pointer"
                >
                  <Download size={20} />
                  <span>داون لود (Download)</span>
                </button>

                {deferredPrompt && !isPWAInstalled && (
                  <button
                    onClick={handleDirectPWAInstall}
                    className="flex-1 py-3.5 px-5 rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-black text-sm md:text-base flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-400/40 transition-all active:scale-95 cursor-pointer"
                  >
                    <Smartphone size={20} />
                    <span>تثبيت مباشر الآن</span>
                  </button>
                )}
              </div>

              {isPWAInstalled && (
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 py-2 px-3 rounded-xl">
                  <CheckCircle2 size={16} />
                  <span>التطبيق مثبت بالفعل ويعمل بوضع التطبيق الأصلي</span>
                </div>
              )}
            </div>

            {/* تعليمات تسطيب النسخة لجميع الأنظمة */}
            <div className="space-y-3.5 text-right">
              <h4 className="font-black text-sm md:text-base text-cyan-300 flex items-center gap-2">
                <span>📋</span>
                <span>تعليمات تسطيب النسخة على جميع الأجهزة:</span>
              </h4>

              {/* أندرويد */}
              <div className="bg-slate-800/70 border border-white/10 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 font-black text-emerald-400 text-sm">
                  <Smartphone size={18} />
                  <span>1. هواتف أندرويد (Android):</span>
                </div>
                <ol className="text-xs md:text-sm text-gray-200 space-y-1.5 list-decimal list-inside leading-relaxed font-semibold">
                  <li>اضغط على زر <strong className="text-emerald-300">داون لود</strong> بالأعلى لتحميل وتثبيت التطبيق مباشرة، أو اضغط على <strong className="text-cyan-300">تثبيت مباشر الآن</strong> إن ظهر لك.</li>
                  <li>أو من متصفح <strong>Google Chrome</strong> اضغط على القائمة الجانبية <strong>(⋮)</strong> أعلى الشاشة.</li>
                  <li>اختر <strong>"تثبيت التطبيق" (Install App)</strong> أو <strong>"الإضافة إلى الشاشة الرئيسية"</strong> ثم اضغط <strong>تثبيت</strong>.</li>
                </ol>
              </div>

              {/* آيفون وآيباد */}
              <div className="bg-slate-800/70 border border-white/10 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 font-black text-blue-400 text-sm">
                  <Share2 size={18} />
                  <span>2. هواتف آيفون وآيباد (iPhone / iOS):</span>
                </div>
                <ol className="text-xs md:text-sm text-gray-200 space-y-1.5 list-decimal list-inside leading-relaxed font-semibold">
                  <li>افتح النظام من متصفح <strong>Safari</strong> على جهاز الآيفون.</li>
                  <li>اضغط على زر <strong>المشاركة (Share)</strong> <span className="inline-block px-1.5 py-0.5 bg-white/10 rounded text-[11px]">⬆️</span> في الشريط السفلي للمتصفح.</li>
                  <li>مرر للأسفل واختر <strong>"إضافة إلى الصفحة الرئيسية" (Add to Home Screen)</strong> <PlusSquare size={14} className="inline text-blue-300" />.</li>
                  <li>اضغط على <strong>"إضافة" (Add)</strong> في أعلى الشاشة ليظهر التطبيق كأيقونة مستقلة.</li>
                </ol>
              </div>

              {/* ويندوز وماك */}
              <div className="bg-slate-800/70 border border-white/10 rounded-2xl p-4 space-y-2">
                <div className="flex items-center gap-2 font-black text-purple-400 text-sm">
                  <Monitor size={18} />
                  <span>3. أجهزة الكمبيوتر (Windows & Mac):</span>
                </div>
                <ol className="text-xs md:text-sm text-gray-200 space-y-1.5 list-decimal list-inside leading-relaxed font-semibold">
                  <li>اضغط على زر <strong className="text-emerald-300">داون لود</strong> بالأعلى أو زر <strong className="text-cyan-300">تثبيت مباشر الآن</strong>.</li>
                  <li>أو من شريط العنوان أعلى متصفح <strong>Chrome</strong> أو <strong>Edge</strong> اضغط على أيقونة التثبيت <span className="inline-block px-1.5 py-0.5 bg-white/10 rounded text-[11px]">🖥️⬇️</span> الموجودة بجانب رابط الموقع.</li>
                  <li>اضغط على <strong>"تثبيت" (Install)</strong> ليتم إنشاء اختصار للتطبيق على سطح المكتب يعمل في نافذة مستقلة تماماً.</li>
                </ol>
              </div>
            </div>

            <button
              onClick={() => setShowInstallModal(false)}
              className="mt-5 w-full py-3 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm transition cursor-pointer border border-white/10"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}

      {/* نافذة تفاصيل الإشعار */}
      {selectedNotif && (
        <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto my-auto">
          <div className="backdrop-blur-xl bg-slate-900/65 border border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.35)] w-full max-w-md rounded-3xl p-6 transition-all duration-300 animate-in zoom-in-95 my-auto">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <Bell className="text-blue-400" size={20} />
                <h3 className="font-bold text-white">تفاصيل الإشعار</h3>
              </div>
              <button onClick={() => setSelectedNotif(null)} className="text-white/60 hover:text-white transition-colors"><X size={20}/></button>
            </div>
            <div className="mb-8">
              <div className="text-xs font-black opacity-60 uppercase mb-2 text-blue-300">المرسل: {selectedNotif.sender || 'System'}</div>
              <div className="bg-slate-900/60 p-4 rounded-2xl border border-blue-500/30 text-sm leading-relaxed text-gray-200 mb-4 shadow-inner">
                {selectedNotif.message}
              </div>
              {selectedNotif.dateString && (
                  <div className="flex justify-between items-center text-[10px] opacity-60 uppercase font-black bg-slate-950/60 border border-blue-500/20 p-3 rounded-xl">
                      <span>التاريخ: {selectedNotif.dateString}</span>
                      <span>الساعة: {selectedNotif.timeString}</span>
                  </div>
              )}
            </div>
            {selectedNotif.saleId && (
              <button
                onClick={() => {
                  setHighlightSaleId(selectedNotif.saleId!);
                  setCurrentView('salesLog');
                  setSelectedNotif(null);
                }}
                className="w-full mb-3 bg-blue-600/90 hover:bg-blue-500 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.4)] hover:shadow-[0_0_25px_rgba(59,130,246,0.6)] border border-blue-400/40 text-xs"
              >
                <ExternalLink size={16} /> الذهاب إلى حركة البيع المحددة
              </button>
            )}
            <div className="flex gap-3">
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(selectedNotif.message);
                  alert("تم النسخ بنجاح");
                }}
                className="flex-1 bg-white/10 hover:bg-white/20 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 border border-white/10 hover:border-blue-400/30"
              >
                <Copy size={16}/> نسخ النص
              </button>
              <button 
                onClick={() => deleteNotif(selectedNotif.id!)}
                className="flex-1 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all duration-300 border border-red-500/30 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]"
              >
                <Trash2 size={16}/> حذف الإشعار
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative z-10">
        {isSidebarOpen && (
            <div 
                className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
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
                onClose={() => setIsSidebarOpen(false)}
                containerClass="backdrop-blur-xl bg-slate-900/65 border-l border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.35)] h-full transition-all duration-300" 
            />
        </div>
        
        <main ref={mainRef} className="flex-1 p-2 md:p-4 overflow-y-auto w-full z-10">
            <div className="p-4 md:p-6 min-h-full rounded-2xl md:rounded-3xl bg-slate-900/85 border border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.35)] transition-all duration-300">
                {currentView === 'sales' && <DailySales user={user} markets={markets} theme={theme} products={products} />}
                {currentView === 'salesLog' && <SalesLog user={user} markets={markets} theme={theme} products={products} highlightSaleId={highlightSaleId || undefined} />}
                {currentView === 'inventoryReg' && <InventoryRegistration user={user} markets={markets} theme={theme} products={products} />}
                {currentView === 'inventoryLog' && <InventoryLog user={user} markets={markets} theme={theme} />}
                {currentView === 'competitorPrices' && <CompetitorPrices user={user} markets={markets} theme={theme} products={products} />}
                {currentView === 'competitorReports' && <CompetitorReports user={user} markets={markets} theme={theme} products={products} />}
                {currentView === 'productsRegistry' && <ProductsRegistry user={user} theme={theme} products={products} />}
                {currentView === 'customerFeedback' && <CustomerFeedbackComponent user={user} theme={theme} markets={markets} />}
                {currentView === 'leaveBalance' && <LeaveBalanceComponent user={user} theme={theme} />}
                {currentView === 'attendance' && <Attendance user={user} theme={theme} markets={markets} />}
                {currentView === 'branchNumbers' && <BranchNumbers user={user} theme={theme} markets={markets} />}
                {currentView === 'employees' && <Employees user={user} theme={theme} />}
                {currentView === 'settings' && <Settings user={user} settings={settings} markets={markets} theme={theme} setTheme={setTheme as any} />}
            </div>
        </main>
      </div>

      {/* سهم جانبي صغير للرجوع لأعلى الصفحة - يظهر في نسخة الكمبيوتر فقط ولا يظهر على الهاتف نهائياً */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="hidden md:flex fixed bottom-8 right-6 z-40 items-center justify-center w-11 h-11 rounded-full backdrop-blur-xl bg-slate-900/65 border border-blue-500/40 text-blue-400 hover:text-white shadow-[0_0_20px_rgba(59,130,246,0.35)] hover:shadow-[0_0_25px_rgba(59,130,246,0.6)] hover:border-blue-400 hover:scale-110 active:scale-95 transition-all duration-300 cursor-pointer group"
          title="الطلوع إلى بداية الصفحة"
          aria-label="الطلوع إلى بداية الصفحة"
        >
          <ChevronUp size={20} className="group-hover:-translate-y-0.5 transition-transform" />
        </button>
      )}

      <footer className="py-2.5 px-4 text-center text-[10px] font-bold text-white/60 backdrop-blur-xl bg-slate-900/65 border-t border-blue-500/40 shadow-[0_0_20px_rgba(59,130,246,0.35)] transition-all duration-300 z-10">
          مع تحيات المطور Amir Lamay
      </footer>
    </div>
  );
};

export default App;
