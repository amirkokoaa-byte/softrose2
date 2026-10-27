import { onCachedValue } from "../firebaseCache";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { ref, onValue, remove, update, get, set, push } from "firebase/database";
import { User, SaleRecord, ProductItem, UserTarget, TargetHistory, LeaveRecord } from '../types';
import { 
    Trash2, Edit, FileSpreadsheet, Save, X, Calendar, User as UserIcon, TrendingUp, Star, Trophy, Download, Filter, Target, History, Copy, Search, Package, ShoppingBag, Calculator, ChevronDown, ChevronUp, Printer, ThumbsUp, ThumbsDown, MessageSquare, Send, Heart, Activity, Clock, Image as ImageIcon, Sparkles, Smartphone, Loader2
} from 'lucide-react';
import { PRODUCTS_FACIAL, PRODUCTS_KITCHEN, PRODUCTS_TOILET, PRODUCTS_DOLPHIN, INITIAL_MARKETS } from '../constants';
import { exportToCSV, exportToExcel } from '../utils';
import { Share2, FileDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Props {
    user: User;
    markets: string[];
    theme: string;
    products: ProductItem[];
    highlightSaleId?: string;
}

const SalesLog: React.FC<Props> = ({ user, markets, theme, products, highlightSaleId }) => {
    const [sales, setSales] = useState<SaleRecord[]>([]);
    const [allCompanySales, setAllCompanySales] = useState<SaleRecord[]>([]);
    const [usersList, setUsersList] = useState<User[]>([]);

    const [commentText, setCommentText] = useState<{[key: string]: string}>({});
    const [commentSender, setCommentSender] = useState<{[key: string]: string}>({});
    const [showCommentInput, setShowCommentInput] = useState<{[key: string]: boolean}>({});
    const [editingCommentId, setEditingCommentId] = useState<{[saleId: string]: string | null}>({});
    const [editingCommentText, setEditingCommentText] = useState<{[commentId: string]: string}>({});

    const handleReaction = async (saleId: string, type: 'like' | 'dislike') => {
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;
        
        let likes = Array.isArray(sale.likes) ? [...sale.likes] : (sale.likes ? Object.values(sale.likes) : []);
        let dislikes = Array.isArray(sale.dislikes) ? [...sale.dislikes] : (sale.dislikes ? Object.values(sale.dislikes) : []);
        
        const userKey = user.username || user.name;
        
        if (type === 'like') {
            if (likes.includes(userKey)) {
                likes = likes.filter(u => u !== userKey);
            } else {
                likes.push(userKey);
                dislikes = dislikes.filter(u => u !== userKey);
            }
        } else {
            if (dislikes.includes(userKey)) {
                dislikes = dislikes.filter(u => u !== userKey);
            } else {
                dislikes.push(userKey);
                likes = likes.filter(u => u !== userKey);
            }
        }
        
        await update(ref(db, `sales/${saleId}`), { likes, dislikes });
    };

    const adminCommenters = useMemo(() => {
        const list: { id: string; name: string }[] = [];
        const seen = new Set<string>();

        // 1. Mr. Amir (حساب admin)
        list.push({ id: 'admin', name: 'Mr. Amir' });
        seen.add('mr. amir');
        seen.add('admin');

        // 2. Mr. Khaled attef
        list.push({ id: 'khaled_attef', name: 'Mr. Khaled attef' });
        seen.add('mr. khaled attef');
        seen.add('khaled attef');
        seen.add('khaled');

        // 3. الحسابات المسجلة بوظيفة مسؤول / admin من قائمة المستخدمين
        usersList.forEach(u => {
            const uRole = (u.role || '').toLowerCase();
            if (uRole === 'admin' || uRole === 'manager' || uRole === 'supervisor' || uRole === 'مسؤول') {
                let displayName = u.name;
                const uname = (u.username || '').toLowerCase();
                if (uname === 'admin' || displayName.toLowerCase() === 'admin') {
                    displayName = 'Mr. Amir';
                } else if (uname.includes('khaled') || displayName.toLowerCase().includes('khaled')) {
                    displayName = 'Mr. Khaled attef';
                }
                if (displayName && !seen.has(displayName.toLowerCase())) {
                    list.push({ id: u.key || u.username || displayName, name: displayName });
                    seen.add(displayName.toLowerCase());
                }
            }
        });

        return list;
    }, [usersList]);

    const handleAddComment = async (saleId: string) => {
        const text = commentText[saleId]?.trim();
        if (!text) return;
        
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;

        let sender = user.name || user.username || 'مستخدم';
        let senderId = user.username || user.name || 'user';

        if (user.role === 'admin') {
            sender = commentSender[saleId] || (user.username === 'admin' ? 'Mr. Amir' : (adminCommenters[0]?.name || user.name || 'Mr. Amir'));
            const senderObj = adminCommenters.find(a => a.name === sender);
            senderId = senderObj?.id || user.username || user.name;
        }
        
        const newComment = {
            id: Date.now().toString() + '-' + Math.random().toString(36).substr(2, 5),
            text,
            senderId: senderId,
            senderName: sender,
            timestamp: Date.now(),
            isLiked: false
        };
        
        const comments = [...(Array.isArray(sale.comments) ? sale.comments : (sale.comments ? Object.values(sale.comments) : [])), newComment];
        await update(ref(db, `sales/${saleId}`), { comments });
        
        setCommentText(prev => ({ ...prev, [saleId]: '' }));
        setShowCommentInput(prev => ({ ...prev, [saleId]: false }));

        // Send notification to employee
        const employeeUser = usersList.find(u => u.name === sale.employeeName);
        const notifTarget = sale.username || (employeeUser ? employeeUser.username : null);
        if (notifTarget && notifTarget !== user.username) {
            push(ref(db, `notifications/${notifTarget}`), {
                message: `أضاف ${sender} تعليقاً على مبيعاتك في ${sale.market}`,
                sender: sender,
                timestamp: Date.now(),
                isRead: false,
                saleId: saleId,
                actionType: 'comment',
                comment: newComment,
                dateString: new Date().toLocaleDateString('ar-EG'),
                timeString: new Date().toLocaleTimeString('ar-EG')
            });
        }
    };

    const handleDeleteComment = async (saleId: string, commentId: string) => {
        if (!confirm("هل أنت متأكد من حذف هذا التعليق؟")) return;
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;

        const currentComments = Array.isArray(sale.comments) ? sale.comments : (sale.comments ? Object.values(sale.comments) : []);
        const comments = currentComments.filter((c, idx) => (c.id ? c.id !== commentId : `${idx}` !== commentId));

        await update(ref(db, `sales/${saleId}`), { comments });
    };

    const handleSaveEditedComment = async (saleId: string, commentId: string) => {
        const newText = (editingCommentText[commentId] || '').trim();
        if (!newText) {
            alert("لا يمكن حفظ تعليق فارغ");
            return;
        }
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;

        const currentComments = Array.isArray(sale.comments) ? sale.comments : (sale.comments ? Object.values(sale.comments) : []);
        const comments = currentComments.map((c, idx) => {
            const cKey = c.id || `${idx}`;
            if (cKey === commentId) {
                return {
                    ...c,
                    text: newText,
                    editedAt: Date.now()
                };
            }
            return c;
        });

        await update(ref(db, `sales/${saleId}`), { comments });
        setEditingCommentId(prev => ({ ...prev, [saleId]: null }));
    };

    const handleLikeComment = async (saleId: string, commentId: string) => {
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;
        
        const comments = (Array.isArray(sale.comments) ? sale.comments : (sale.comments ? Object.values(sale.comments) : [])).map(c => 
            c.id === commentId ? { ...c, isLiked: !c.isLiked } : c
        );
        
        await update(ref(db, `sales/${saleId}`), { comments });
        
        const comment = sale.comments?.find(c => c.id === commentId);
        if (comment) {
            push(ref(db, `notifications/admin_alerts`), {
                message: `أعجب ${user.name} بتعليق ${comment.senderName}`,
                sender: user.name,
                timestamp: Date.now(),
                isRead: false
            });
        }
    };

    const [filteredSales, setFilteredSales] = useState<SaleRecord[]>([]);
    const [selectedSalesIds, setSelectedSalesIds] = useState<string[]>([]);
    const [visibleCount, setVisibleCount] = useState(15);
    const [selectedTargetEmployeeToShare, setSelectedTargetEmployeeToShare] = useState<string>('');
    const [filterDate, setFilterDate] = useState('');
    const [filterEndDate, setFilterEndDate] = useState('');
    const [filterEmployee, setFilterEmployee] = useState('');
    const [filterMarket, setFilterMarket] = useState('');
    
    // Target Management State
    const [showTargetModal, setShowTargetModal] = useState(false);
    const [showArchiveModal, setShowArchiveModal] = useState(false);
    const [archiveEmployee, setArchiveEmployee] = useState('all');
    const [archiveSearch, setArchiveSearch] = useState('');
    const [archiveData, setArchiveData] = useState<TargetHistory[]>([]);
    const [expandedArchiveMonths, setExpandedArchiveMonths] = useState<Record<string, boolean>>({});
    
    // Product Sales Report State
    const [showProductSalesModal, setShowProductSalesModal] = useState(false);
    const [showProductSalesDataModal, setShowProductSalesDataModal] = useState(false);
    const [reportItem, setReportItem] = useState('all');
    const [reportMarket, setReportMarket] = useState('all');
    const [reportEmployee, setReportEmployee] = useState('all');
    const [reportStart, setReportStart] = useState('');
    const [reportEnd, setReportEnd] = useState('');

    // Performance Report State (شاشة الأداء)
    const [showPerformanceModal, setShowPerformanceModal] = useState(false);
    const [perfEmployee, setPerfEmployee] = useState<string>('all');
    const [perfYearMode, setPerfYearMode] = useState<'current' | 'previous'>('current');
    const [perfEndMonth, setPerfEndMonth] = useState<number>(() => new Date().getMonth());
    const [isExportingPerfImage, setIsExportingPerfImage] = useState(false);
    const [showPerfImageQualityModal, setShowPerfImageQualityModal] = useState(false);
    const [perfImageQualityLoading, setPerfImageQualityLoading] = useState<'ultra' | 'normal' | null>(null);

    const [targetMarket, setTargetMarket] = useState('');
    const [targetEmployeeKey, setTargetEmployeeKey] = useState('');
    const [targetPrintEmployee, setTargetPrintEmployee] = useState('');
    const [suggestedTarget, setSuggestedTarget] = useState(0);
    const [growthPercent, setGrowthPercent] = useState(0);
    const [finalTarget, setFinalTarget] = useState(0);
    const [currentActiveTarget, setCurrentActiveTarget] = useState(0);

    const [editingSale, setEditingSale] = useState<SaleRecord | null>(null);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportStart, setExportStart] = useState('');
    const [exportEnd, setExportEnd] = useState('');
    const [exportMarket, setExportMarket] = useState('');
    const [exportEmployee, setExportEmployee] = useState('');

    const [showCurrentTargetsModal, setShowCurrentTargetsModal] = useState(false);
    const [selectedTargetMonth, setSelectedTargetMonth] = useState<string>('current');
    const [showPastTargetsModal, setShowPastTargetsModal] = useState(false);
    const [targetsList, setTargetsList] = useState<UserTarget[]>([]);
    const [showTargetDropdown, setShowTargetDropdown] = useState(false);

    // Faqd (تقرير الفقد) states
    const [showFaqdDropdown, setShowFaqdDropdown] = useState(false);
    const [showFaqdModal, setShowFaqdModal] = useState(false);
    const [faqdExportTarget, setFaqdExportTarget] = useState<'pdf' | 'excel'>('pdf');
    const [faqdSelectedEmployee, setFaqdSelectedEmployee] = useState<string>('');
    const [faqdStartDate, setFaqdStartDate] = useState<string>(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}-01`;
    });
    const [faqdEndDate, setFaqdEndDate] = useState<string>(() => {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    });
    const [leaveHistory, setLeaveHistory] = useState<LeaveRecord[]>([]);
    const [leaveBalances, setLeaveBalances] = useState<Record<string, any>>({});
    const [isExportingFaqdPDF, setIsExportingFaqdPDF] = useState(false);

    const faqdDropdownRef = React.useRef<HTMLDivElement>(null);
    const targetDropdownRef = React.useRef<HTMLDivElement>(null);
    const faqdPrintContainerRef = React.useRef<HTMLDivElement>(null);
    const targetPdfPrintContainerRef = React.useRef<HTMLDivElement>(null);
    const targetImageExportContainerRef = React.useRef<HTMLDivElement>(null);
    const [isExportingTargetImage, setIsExportingTargetImage] = useState(false);

    useEffect(() => {
        const leavesRef = ref(db, 'leave_history');
        const unsubLeaves = onCachedValue(leavesRef, 'leave_history', (snap) => {
            if (snap.exists()) {
                const list: LeaveRecord[] = [];
                snap.forEach((child: any) => {
                    list.push({ id: child.key, ...child.val() });
                });
                setLeaveHistory(list);
            } else {
                setLeaveHistory([]);
            }
        });

        const balancesRef = ref(db, 'leave_balances');
        const unsubBalances = onCachedValue(balancesRef, 'leave_balances', (snap) => {
            if (snap.exists()) {
                setLeaveBalances(snap.val() || {});
            } else {
                setLeaveBalances({});
            }
        });

        return () => {
            unsubLeaves();
            unsubBalances();
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (faqdDropdownRef.current && !faqdDropdownRef.current.contains(e.target as Node)) {
                setShowFaqdDropdown(false);
            }
            if (targetDropdownRef.current && !targetDropdownRef.current.contains(e.target as Node)) {
                setShowTargetDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (!highlightSaleId) return;

        // Auto open comments for this sale
        setShowCommentInput(prev => ({ ...prev, [highlightSaleId]: true }));

        // Ensure visibleCount covers this sale
        const saleIndex = filteredSales.findIndex(s => s.id === highlightSaleId);
        if (saleIndex >= 0 && saleIndex >= visibleCount) {
            setVisibleCount(saleIndex + 10);
        }

        // Scroll to the sale card
        const timer = setTimeout(() => {
            const el = document.getElementById(`sale-${highlightSaleId}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 400);

        return () => clearTimeout(timer);
    }, [highlightSaleId, filteredSales, visibleCount]);

    const explicitEmployees = useMemo(() => ["Malak", "Omnia", "Asmaa", "Toqa", "Mena Ahmed"], []);

    const allProductNames = useMemo(() => {
        const namesSet = new Set<string>();
        (products || []).forEach(p => {
            if (p.name && p.name.trim()) namesSet.add(p.name.trim());
        });
        [...PRODUCTS_FACIAL, ...PRODUCTS_KITCHEN, ...PRODUCTS_TOILET, ...PRODUCTS_DOLPHIN].forEach(n => {
            if (n && n.trim()) namesSet.add(n.trim());
        });
        sales.forEach(s => {
            (s.items || []).forEach(item => {
                if (item.name && item.name.trim()) namesSet.add(item.name.trim());
            });
        });
        return Array.from(namesSet).sort();
    }, [products, sales]);

    const archiveEmployeesList = useMemo(() => {
        const list: { id: string; name: string }[] = [];
        const addedNames = new Set<string>();

        // 1. Explicit employees
        explicitEmployees.forEach(name => {
            const u = usersList.find(usr => usr.name?.trim().toLowerCase() === name.toLowerCase() || usr.username?.trim().toLowerCase() === name.toLowerCase());
            list.push({
                id: u?.key || name,
                name: u?.name || name
            });
            addedNames.add(name.toLowerCase());
            if (u?.name) addedNames.add(u.name.toLowerCase());
        });

        // 2. All users in usersList
        usersList.forEach(u => {
            if (u.name && !addedNames.has(u.name.toLowerCase())) {
                list.push({ id: u.key, name: u.name });
                addedNames.add(u.name.toLowerCase());
            }
        });

        // 3. All employees in sales
        sales.forEach(s => {
            if (s.employeeName && !addedNames.has(s.employeeName.toLowerCase())) {
                list.push({ id: s.employeeName, name: s.employeeName });
                addedNames.add(s.employeeName.toLowerCase());
            }
        });

        // 4. All employees in archiveData
        archiveData.forEach(h => {
            if (h.employeeName && !addedNames.has(h.employeeName.toLowerCase())) {
                list.push({ id: h.userId || h.employeeName, name: h.employeeName });
                addedNames.add(h.employeeName.toLowerCase());
            }
        });

        return list;
    }, [explicitEmployees, usersList, sales, archiveData]);

    const resolveMarketForSale = (item: any, empMarketMap?: Map<string, string>): string => {
        let m = (item?.market || '').trim();
        if (m && m !== 'undefined' && m !== 'null' && !m.includes('اختر')) {
            return m;
        }
        const emp = `${item?.employeeName || ''} ${item?.username || ''}`.toLowerCase();
        if (emp.includes('malak') || emp.includes('ملك') || emp.includes('asmaa') || emp.includes('اسماء')) {
            return 'محلاوي الحي العاشر';
        }
        if (emp.includes('omnia') || emp.includes('امنيه') || emp.includes('أمنية')) {
            return 'جمال سلامه ميدان الجامع';
        }
        if (emp.includes('toqa') || emp.includes('تقي') || emp.includes('تقى')) {
            return 'محلاوي التجمع الخامس';
        }
        if (emp.includes('mena') || emp.includes('منه') || emp.includes('منة')) {
            return 'فرجاني ترعه الجبل';
        }
        if (targetsList && targetsList.length > 0) {
            const matchedTarget = targetsList.find(t => 
                (t.employeeName && item.employeeName && t.employeeName.trim().toLowerCase() === item.employeeName.trim().toLowerCase()) ||
                (t.userId && (t.userId === item.userId || t.userId === item.username))
            );
            if (matchedTarget?.market && matchedTarget.market.trim()) {
                return matchedTarget.market.trim();
            }
        }
        if (usersList && usersList.length > 0) {
            const matchedUser = usersList.find(u => 
                (u.name && item.employeeName && u.name.trim().toLowerCase() === item.employeeName.trim().toLowerCase()) ||
                (u.username && item.username && u.username.trim() === item.username.trim())
            );
            if (matchedUser?.market && matchedUser.market.trim()) {
                return matchedUser.market.trim();
            }
            if (matchedUser?.branches && Array.isArray(matchedUser.branches) && matchedUser.branches.length > 0) {
                return matchedUser.branches[0].trim();
            }
        }
        if (empMarketMap) {
            const empNameKey = (item?.employeeName || '').trim().toLowerCase();
            const userKey = (item?.username || '').trim().toLowerCase();
            if (empNameKey && empMarketMap.has(empNameKey)) return empMarketMap.get(empNameKey)!;
            if (userKey && empMarketMap.has(userKey)) return empMarketMap.get(userKey)!;
        }
        return 'محلاوي الحي العاشر';
    };

    const allAvailableFilterMarkets = useMemo(() => {
        const set = new Set<string>(markets);
        sales.forEach(s => {
            const m = (s.market || '').trim();
            if (m && !m.includes('اختر') && m !== 'undefined' && m !== 'null') {
                set.add(m);
            }
        });
        INITIAL_MARKETS.forEach(m => set.add(m));
        return Array.from(set).filter(Boolean).sort();
    }, [markets, sales]);

    useEffect(() => {
        let unsubUsers, unsubTargets, unsubHistory;
        const unsubSales = onCachedValue(ref(db, 'sales'), 'sales', (snapshot, isCached) => {
            const data = snapshot.val();
            if (data) {
                const empMarketMap = new Map<string, string>();
                const keys = Object.keys(data);
                for (let i = 0; i < keys.length; i++) {
                    const otherSale = data[keys[i]];
                    if (otherSale && otherSale.market && typeof otherSale.market === 'string') {
                        const m = otherSale.market.trim();
                        if (m && m !== 'undefined' && m !== 'null' && !m.includes('اختر')) {
                            if (otherSale.employeeName) empMarketMap.set(otherSale.employeeName.trim().toLowerCase(), m);
                            if (otherSale.username) empMarketMap.set(otherSale.username.trim().toLowerCase(), m);
                        }
                    }
                }

                let missingFixCount = 0;
                const allLoaded: SaleRecord[] = new Array(keys.length);
                for (let i = 0; i < keys.length; i++) {
                    const key = keys[i];
                    const item = data[key];
                    const hasValidMarket = item.market && typeof item.market === 'string' && item.market.trim() !== '' && item.market !== 'undefined' && item.market !== 'null';
                    const market = hasValidMarket ? item.market.trim() : resolveMarketForSale(item, empMarketMap);
                    if (!hasValidMarket && !isCached && missingFixCount < 5) {
                        missingFixCount++;
                        update(ref(db, `sales/${key}`), { market }).catch(() => {});
                    }
                    allLoaded[i] = { id: key, ...item, market };
                }

                setAllCompanySales(allLoaded);
                let loadedSales = allLoaded;
                if (user.role !== 'admin' && !user.canViewAllSales) {
                    const targetName = (user.name || '').trim().toLowerCase();
                    const targetUser = (user.username || '').trim();
                    loadedSales = allLoaded.filter(s => {
                        const nameMatches = s.employeeName && targetName && s.employeeName.trim().toLowerCase() === targetName;
                        const usernameMatches = s.username && targetUser && s.username.trim() === targetUser;
                        return nameMatches || usernameMatches;
                    });
                } else {
                    loadedSales = [...allLoaded];
                }
                loadedSales.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                setSales(loadedSales);
            } else { 
                setAllCompanySales([]);
                setSales([]); 
            }
        });

        if (user.role === 'admin') {
            unsubUsers = onCachedValue(ref(db, 'users'), 'users', (snap) => {
                if (snap.exists()) {
                    const list: User[] = [];
                    snap.forEach(child => { list.push({ key: child.key!, ...child.val() }); });
                    setUsersList(list);
                }
            });
            unsubTargets = onCachedValue(ref(db, 'targets'), 'targets', snap => {
                if (snap.exists()) {
                    setTargetsList(Object.values(snap.val()));
                } else {
                    setTargetsList([]);
                }
            });
            unsubHistory = onCachedValue(ref(db, 'target_history'), 'target_history', snap => {
                if (snap.exists()) {
                    const data: TargetHistory[] = [];
                    snap.forEach(userSnap => {
                        userSnap.forEach(historySnap => {
                            data.push({ id: historySnap.key!, ...historySnap.val() });
                        });
                    });
                    setArchiveData(data);
                } else {
                    setArchiveData([]);
                }
            });
        }
        return () => {
            unsubSales();
            if (unsubUsers) unsubUsers();
            if (unsubTargets) unsubTargets();
            if (unsubHistory) unsubHistory();
        };
    }, [user]);

    const isoDateCacheRef = React.useRef<WeakMap<SaleRecord, string>>(new WeakMap());

    // دالة مساعدة لتوحيد صيغة التاريخ إلى YYYY-MM-DD لمطابقة دقيقة مع تخزين مؤقت فوري
    const getSaleISODate = (s: SaleRecord): string => {
        if (!s || typeof s !== 'object') return '';
        const cached = isoDateCacheRef.current.get(s);
        if (cached !== undefined) return cached;

        let result = '';
        if (s.timestamp && typeof s.timestamp === 'number' && !isNaN(s.timestamp)) {
            const d = new Date(s.timestamp);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            result = `${y}-${m}-${day}`;
        } else if (s.date) {
            const clean = s.date
                .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
                .replace(/[\u200e\u200f]/g, '')
                .trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
                result = clean;
            } else {
                const parts = clean.split(/[-/]/);
                if (parts.length === 3) {
                    const [p1, p2, p3] = parts;
                    if (p1.length === 4) result = `${p1}-${p2.padStart(2, '0')}-${p3.padStart(2, '0')}`;
                    else if (p3.length === 4) result = `${p3}-${p2.padStart(2, '0')}-${p1.padStart(2, '0')}`;
                }
                if (!result) {
                    const parsed = new Date(clean);
                    if (!isNaN(parsed.getTime())) {
                        const y = parsed.getFullYear();
                        const m = String(parsed.getMonth() + 1).padStart(2, '0');
                        const day = String(parsed.getDate()).padStart(2, '0');
                        result = `${y}-${m}-${day}`;
                    }
                }
            }
        }
        isoDateCacheRef.current.set(s, result);
        return result;
    };

    useEffect(() => {
        let result = sales;

        if (filterDate || filterEndDate) {
            result = result.filter(s => {
                const sDate = getSaleISODate(s);
                if (!sDate) {
                    if (filterDate && !filterEndDate) return Boolean(s.date && s.date.includes(filterDate));
                    return false;
                }

                if (filterDate && filterEndDate) {
                    const start = filterDate <= filterEndDate ? filterDate : filterEndDate;
                    const end = filterDate <= filterEndDate ? filterEndDate : filterDate;
                    return sDate >= start && sDate <= end;
                } else if (filterDate) {
                    return sDate === filterDate || Boolean(s.date && s.date.includes(filterDate));
                } else if (filterEndDate) {
                    return sDate <= filterEndDate;
                }
                return true;
            });
        }

        if (filterEmployee) {
            result = result.filter(s => 
                (s.employeeName && s.employeeName.includes(filterEmployee)) || 
                (s.username && s.username.includes(filterEmployee))
            );
        }
        if (filterMarket) {
            result = result.filter(s => s.market === filterMarket);
        }

        setFilteredSales(result);
    }, [sales, filterDate, filterEndDate, filterEmployee, filterMarket]);

    // حساب التارجت المقترح تلقائياً مع جلب التارجت الحالي
    useEffect(() => {
        if (targetEmployeeKey) {
            const employee = usersList.find(u => u.key === targetEmployeeKey);
            if (employee) {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                const end = new Date(now.getFullYear(), now.getMonth(), 30, 23, 59, 59).getTime();
                
                const employeeSales = sales.filter(s => 
                    s.employeeName === employee.name && 
                    s.timestamp >= start && 
                    s.timestamp <= end
                );
                const sum = employeeSales.reduce((acc, s) => acc + s.total, 0);
                setSuggestedTarget(sum);

                // Fetch existing valid target for the selected employee
                const activeTgt = targetsList.find(t => t.userId === targetEmployeeKey);
                if (activeTgt) {
                    setCurrentActiveTarget(activeTgt.finalTarget);
                } else {
                    setCurrentActiveTarget(0);
                }
            }
        } else {
            setCurrentActiveTarget(0);
        }
    }, [targetEmployeeKey, sales, usersList, targetsList]);

    // حساب التارجت النهائي تلقائياً
    useEffect(() => {
        const final = suggestedTarget + (suggestedTarget * (growthPercent / 100));
        setFinalTarget(Math.round(final));
    }, [suggestedTarget, growthPercent]);

    // استخراج قائمة الأصناف الفريدة والأسواق التي بها مبيعات
const normalizeName = (name: string) => {
        if (!name) return '';
        return name.trim().replace(/\s+/g, ' ');
    };

    const uniqueItems = useMemo(() => {
        const set = new Set<string>();
        sales.forEach(s => s.items?.forEach(i => set.add(normalizeName(i.name))));
        return Array.from(set).sort();
    }, [sales]);

    const groupedItems = useMemo(() => {
        const groups: Record<string, string[]> = {
            'Facial': [],
            'Kitchen': [],
            'Toilet': [],
            'Dolphin': [],
            'Uncategorized': []
        };
        
        uniqueItems.forEach(itemName => {
            // إخفاء منتجات Soft Rose باللغة الإنجليزية من القوائم المنبثقة
            if (/[a-zA-Z]/.test(itemName)) return;
            const product = products.find(p => normalizeName(p.name) === itemName);
            const cat = product?.category || 'Uncategorized';
            if (groups[cat]) {
                groups[cat].push(itemName);
            } else {
                if (!groups['Uncategorized']) groups['Uncategorized'] = [];
                groups['Uncategorized'].push(itemName);
            }
        });
        
        return groups;
    }, [uniqueItems, products]);

    const categoryLabels: Record<string, string> = {
        'Facial': 'مناديل السحب (Facial)',
        'Kitchen': 'مناديل المطبخ (Kitchen)',
        'Toilet': 'تواليت (Toilet)',
        'Dolphin': 'دولفن (Dolphin)',
        'Uncategorized': 'أصناف أخرى'
    };

    const marketsWithSales = useMemo(() => {
        const set = new Set<string>();
        sales.forEach(s => set.add(s.market));
        return Array.from(set).sort();
    }, [sales]);

    const employeesWithSales = useMemo(() => {
        const archivedNames = new Set(usersList.filter(u => u.isArchived).map(u => (u.name || '').trim().toLowerCase()));
        const names = new Set<string>();
        sales.forEach(s => {
            if (s.employeeName && s.employeeName.trim()) {
                const trimmed = s.employeeName.trim();
                if (!archivedNames.has(trimmed.toLowerCase())) {
                    names.add(trimmed);
                }
            }
        });
        return Array.from(names).sort();
    }, [sales, usersList]);

    // حساب نتائج تقرير مبيعات الأصناف (فقط عند فتح نافذة مبيعات الأصناف لتسريع الأداء)
    const reportResults = useMemo<{ 
        totalQty: number; 
        totalValue: number; 
        itemsGrouped: Record<string, { price: number; qty: number; total: number }>;
        categoryGrouped: Record<string, number>;
    }>(() => {
        if (!showProductSalesModal && !showProductSalesDataModal) {
            return { totalQty: 0, totalValue: 0, itemsGrouped: {}, categoryGrouped: {} };
        }

        const prodCatMap = new Map<string, string>();
        products.forEach(p => {
            prodCatMap.set(normalizeName(p.name), p.category || 'Uncategorized');
        });

        let results = sales;
        if (reportMarket !== 'all') results = results.filter(s => s.market === reportMarket);
        if (reportEmployee !== 'all') results = results.filter(s => s.employeeName && s.employeeName.trim() === reportEmployee.trim());
        if (reportStart) {
            const startTS = new Date(reportStart).setHours(0,0,0,0);
            results = results.filter(s => s.timestamp >= startTS);
        }
        if (reportEnd) {
            const endTS = new Date(reportEnd).setHours(23,59,59,999);
            results = results.filter(s => s.timestamp <= endTS);
        }

        let totalQty = 0;
        let totalValue = 0;
        const itemsGrouped: Record<string, { price: number, qty: number, total: number }> = {};
        const categoryGrouped: Record<string, number> = {};

        results.forEach(s => {
            (s.items || []).forEach(i => {
                const nName = normalizeName(i.name);
                // إخفاء منتجات Soft Rose باللغة الإنجليزية من التقرير
                if (/[a-zA-Z]/.test(nName)) return;
                if (reportItem === 'all' || nName === reportItem) {
                    totalQty += i.qty;
                    totalValue += (i.qty * i.price);
                    
                    if (!itemsGrouped[nName]) {
                        itemsGrouped[nName] = { price: i.price, qty: 0, total: 0 };
                    }
                    itemsGrouped[nName].qty += i.qty;
                    itemsGrouped[nName].total += (i.qty * i.price);
                    
                    // compute category
                    const cat = prodCatMap.get(nName) || 'Uncategorized';
                    if (!categoryGrouped[cat]) categoryGrouped[cat] = 0;
                    categoryGrouped[cat] += (i.qty * i.price);
                }
            });
        });

        return { totalQty, totalValue, itemsGrouped, categoryGrouped };
    }, [showProductSalesModal, showProductSalesDataModal, sales, reportItem, reportMarket, reportEmployee, reportStart, reportEnd, products]);

    
    const handleShareSales = async (isHighQuality: boolean) => {
        let element = document.getElementById('selected-sales-print-area');
        if (!element) return;
        try {
            const scale = isHighQuality ? (8000 / 1000) : 2;
            const canvas = await html2canvas(element, {
                backgroundColor: '#111827',
                scale: scale,
                width: 1000
            });
            
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `sales_export_${new Date().getTime()}.png`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                }
            }, 'image/png', isHighQuality ? 1.0 : 0.8);
        } catch (err) {
            console.error("Failed to capture image", err);
            alert("حدث خطأ أثناء استخراج الصورة");
        }
    };
    
    const handleShareTarget = async () => {
        let element = document.getElementById('selected-target-print-area');
        if (!element) return;
        try {
            const canvas = await html2canvas(element, {
                backgroundColor: '#111827',
                scale: 8000 / 1000,
                width: 1000
            });
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            
            if (navigator.share) {
                const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 1.0));
                if (blob) {
                    const file = new File([blob], 'target.png', { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: 'التارجت' });
                        return;
                    }
                }
            }
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `target_export_${new Date().getTime()}.png`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                }
            }, 'image/png', 1.0);
        } catch (err) {
            console.error("Failed to capture target image", err);
            alert("حدث خطأ أثناء استخراج الصورة");
        }
    };

    const handleUpdateActiveTarget = async () => {
        if (!targetEmployeeKey) return alert('اختر الموظف أولاً');
        const employee = usersList.find(u => u.key === targetEmployeeKey);
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;

        await update(ref(db, `targets/${targetEmployeeKey}`), { 
            finalTarget: currentActiveTarget,
            lastResetMonth: currentMonth
        });

        if (employee) {
            push(ref(db, `notifications/${targetEmployeeKey}`), {
                message: `تم تعديل تارجت شهر ${currentMonth} إلى ${(Number(currentActiveTarget) || 0).toLocaleString()} ج.م`,
                sender: user.name,
                timestamp: Date.now(),
                isRead: false
            });
            if (employee.username && employee.username !== targetEmployeeKey) {
                push(ref(db, `notifications/${employee.username}`), {
                    message: `تم تعديل تارجت شهر ${currentMonth} إلى ${(Number(currentActiveTarget) || 0).toLocaleString()} ج.م`,
                    sender: user.name,
                    timestamp: Date.now(),
                    isRead: false
                });
            }
        }

        alert('تم تعديل التارجت للشهر الحالي بنجاح وسيظهر التعديل فوراً للموظف');
    };

    const handleSaveTarget = async () => {
        if (!targetEmployeeKey || !targetMarket || finalTarget <= 0) return alert("يرجى إكمال البيانات");
        const employee = usersList.find(u => u.key === targetEmployeeKey);
        if (!employee) return;

        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
        const achievedNow = computeAchieved(employee.name, now.getFullYear(), now.getMonth(), targetEmployeeKey);

        const targetData: UserTarget = {
            userId: targetEmployeeKey,
            employeeName: employee.name,
            market: targetMarket,
            suggestedAmount: suggestedTarget,
            growthPercent: growthPercent,
            finalTarget: finalTarget,
            achieved: achievedNow,
            lastResetMonth: currentMonth
        };

        await set(ref(db, `targets/${targetEmployeeKey}`), targetData);

        push(ref(db, `notifications/${targetEmployeeKey}`), {
            message: `تم اعتماد تارجت شهر ${currentMonth} بقيمة ${(Number(finalTarget) || 0).toLocaleString()} ج.م لفرع ${targetMarket}`,
            sender: user.name,
            timestamp: Date.now(),
            isRead: false
        });
        if (employee.username && employee.username !== targetEmployeeKey) {
            push(ref(db, `notifications/${employee.username}`), {
                message: `تم اعتماد تارجت شهر ${currentMonth} بقيمة ${(Number(finalTarget) || 0).toLocaleString()} ج.م لفرع ${targetMarket}`,
                sender: user.name,
                timestamp: Date.now(),
                isRead: false
            });
        }

        alert("تم اعتماد وإضافة التارجت للشهر الحالي بنجاح وتحديثه فوراً للموظف");
        setShowTargetModal(false);
    };

    const handleEditCurrentTarget = async (userId: string, currentVal: number) => {
        const newVal = prompt("أدخل التارجت الشهري الجديد:", currentVal.toString());
        if (newVal !== null && !isNaN(Number(newVal)) && Number(newVal) > 0) {
            const numVal = Number(newVal);
            const now = new Date();
            const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`;
            const currentMonthFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const targetObj = targetsList.find(t => t.userId === userId);

            // حفظ تارجت الأشهر السابقة في سجل الأرشيف لضمان عدم المساس بها عند تغيير تارجت الشهر الحالي
            if (targetObj) {
                for (const mKey of pastMonthsList) {
                    const [yStr, mStr] = mKey.split('-');
                    const y = parseInt(yStr, 10);
                    const mIdx = parseInt(mStr, 10) - 1;
                    const prevAchieved = computeAchieved(targetObj.employeeName, y, mIdx, userId);
                    
                    const existingHist = archiveData.find(a => (a.userId === userId || a.employeeName === targetObj.employeeName) && a.month === mKey);
                    if (!existingHist) {
                        await push(ref(db, `target_history/${userId}`), {
                            userId: userId,
                            employeeName: targetObj.employeeName,
                            month: mKey,
                            targetAmount: targetObj.finalTarget || 0,
                            achievedAmount: prevAchieved
                        });
                    }
                }
            }

            // تحديث التارجت للشهر الحالي فقط
            await update(ref(db, `targets/${userId}`), { 
                finalTarget: numVal,
                lastResetMonth: currentMonth
            });

            // حفظ نسخة الشهر الحالي في الأرشيف
            const currentAchieved = targetObj ? computeAchieved(targetObj.employeeName, now.getFullYear(), now.getMonth(), userId) : 0;
            const currentHist = archiveData.find(a => (a.userId === userId || a.employeeName === targetObj?.employeeName) && a.month === currentMonthFormatted);
            if (currentHist && currentHist.id) {
                await update(ref(db, `target_history/${userId}/${currentHist.id}`), {
                    targetAmount: numVal,
                    achievedAmount: currentAchieved
                });
            } else if (targetObj) {
                await push(ref(db, `target_history/${userId}`), {
                    userId: userId,
                    employeeName: targetObj.employeeName,
                    month: currentMonthFormatted,
                    targetAmount: numVal,
                    achievedAmount: currentAchieved
                });
            }

            const employee = usersList.find(u => u.key === userId) || (targetObj ? { name: targetObj.employeeName, username: userId } : null);
            if (employee) {
                push(ref(db, `notifications/${userId}`), {
                    message: `تم تعديل تارجت شهر ${currentMonth} إلى ${numVal.toLocaleString()} ج.م`,
                    sender: user.name,
                    timestamp: Date.now(),
                    isRead: false
                });
            }

            alert("تم تعديل التارجت للشهر الحالي بنجاح فقط دون المساس بالأشهر السابقة");
        }
    };

    const handleDeleteCurrentTarget = async (userId: string) => {
        if (confirm("هل أنت متأكد من حذف هذا التارجت؟")) {
            if (userId) {
                await remove(ref(db, `targets/${userId}`));
            }
            alert("تم الحذف بنجاح");
        }
    };

    const handleEditPastTarget = async (userId: string, employeeName: string, monthKey: string, historical: any, currentVal: number, achieved: number) => {
        const newVal = prompt("أدخل التارجت الجديد لهذا الشهر:", currentVal.toString());
        if (newVal !== null && !isNaN(Number(newVal)) && Number(newVal) > 0) {
            if (historical && historical.id) {
                await update(ref(db, `target_history/${userId}/${historical.id}`), { targetAmount: Number(newVal), isDeleted: null });
            } else {
                await push(ref(db, `target_history/${userId}`), {
                    userId: userId || 'unknown', employeeName: employeeName || 'unknown', month: monthKey, targetAmount: Number(newVal), achievedAmount: achieved
                });
            }
            alert("تم التعديل بنجاح");
        }
    };

    const handleDeletePastTarget = async (userId: string, employeeName: string, monthKey: string, historical: any) => {
        if (confirm("هل أنت متأكد من حذف التارجت لهذا الشهر؟")) {
            if (historical && historical.id) {
                await update(ref(db, `target_history/${userId}/${historical.id}`), { isDeleted: true });
            } else {
                await push(ref(db, `target_history/${userId}`), {
                    userId: userId || 'unknown', employeeName: employeeName || 'unknown', month: monthKey, targetAmount: 0, achievedAmount: 0, isDeleted: true
                });
            }
            alert("تم الحذف بنجاح");
        }
    };

    const loadArchive = async () => {
        const archiveRef = ref(db, 'target_history');
        const snap = await get(archiveRef);
        if (snap.exists()) {
            const data: TargetHistory[] = [];
            snap.forEach(userSnap => {
                userSnap.forEach(historySnap => {
                    data.push({ id: historySnap.key!, ...historySnap.val() });
                });
            });
            setArchiveData(data);
        }
        setShowArchiveModal(true);
    };

    const copyArchiveData = () => {
        const filtered = getFilteredArchive();
        const text = filtered.map(h => `${h.employeeName} | الشهر: ${h.month} | التارجت: ${h.targetAmount} | المحقق: ${h.achievedAmount}`).join('\n');
        navigator.clipboard.writeText(text);
        alert("تم نسخ البيانات المصفاة بنجاح");
    };

    const getFilteredArchive = () => {
        const monthsSet = new Set<string>();
        archiveData.forEach(h => {
            if (h.month) monthsSet.add(h.month);
        });
        sales.forEach(s => {
            const d = new Date(s.timestamp || s.date);
            if (!isNaN(d.getTime())) {
                const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                monthsSet.add(mKey);
            }
        });
        monthsSet.add("2026-06");

        const allRecords: TargetHistory[] = [...archiveData];

        monthsSet.forEach(mKey => {
            const [yStr, mStr] = mKey.split('-');
            const y = parseInt(yStr, 10);
            const mIdx = parseInt(mStr, 10) - 1;

            archiveEmployeesList.forEach(emp => {
                const achieved = computeAchieved(emp.name, y, mIdx, emp.id);
                const existingIdx = allRecords.findIndex(r => r.month === mKey && (r.employeeName?.trim().toLowerCase() === emp.name.trim().toLowerCase() || r.userId === emp.id));
                if (existingIdx === -1) {
                    if (achieved > 0 || explicitEmployees.map(e => e.toLowerCase()).includes(emp.name.toLowerCase())) {
                        const currentT = targetsList.find(t => t.employeeName?.trim().toLowerCase() === emp.name.trim().toLowerCase() || t.userId === emp.id);
                        allRecords.push({
                            id: `auto-${emp.id}-${mKey}`,
                            userId: emp.id,
                            employeeName: emp.name,
                            month: mKey,
                            targetAmount: currentT ? currentT.finalTarget : 0,
                            achievedAmount: achieved
                        });
                    }
                } else if (achieved > 0 && allRecords[existingIdx].achievedAmount === 0) {
                    allRecords[existingIdx].achievedAmount = achieved;
                }
            });
        });

        return allRecords.filter(h => {
            const matchesEmployee = archiveEmployee === 'all' || h.userId === archiveEmployee || h.employeeName?.trim().toLowerCase() === archiveEmployee.trim().toLowerCase();
            const matchesSearch = !archiveSearch || h.month.includes(archiveSearch) || h.employeeName?.toLowerCase().includes(archiveSearch.toLowerCase());
            return matchesEmployee && matchesSearch;
        });
    };

    const computeAchieved = (employeeName: string, year: number, month: number, userId?: string) => {
        const start = new Date(year, month, 1).getTime();
        const end = new Date(year, month + 1, 0, 23, 59, 59).getTime(); // last day of month
        return sales
            .filter(s => {
                const nameMatches = s.employeeName?.trim().toLowerCase() === employeeName?.trim().toLowerCase();
                const userMatches = userId && s.username && (s.username.replace(/[.#$/[\]]/g, "_") === userId || s.username === userId);
                return (nameMatches || userMatches) && s.timestamp >= start && s.timestamp <= end;
            })
            .reduce((sum, s) => sum + s.total, 0);
    };

    const pastMonthsList = useMemo(() => {
        const now = new Date();
        const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const monthsSet = new Set<string>();
        sales.forEach(s => {
            const date = new Date(s.timestamp);
            const mKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (mKey !== currentMonthKey) {
                 monthsSet.add(mKey);
            }
        });
        return Array.from(monthsSet).sort((a,b) => b.localeCompare(a));
    }, [sales]);

    const renderTargetsList = () => {
        const now = new Date();
        const targetsWithAchieved = targetsList.map(t => {
            const achieved = computeAchieved(t.employeeName, now.getFullYear(), now.getMonth(), t.userId);
            
            const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
            const employeeSales = sales.filter(s => {
                const nameMatches = s.employeeName?.trim().toLowerCase() === t.employeeName?.trim().toLowerCase();
                const userMatches = t.userId && s.username && (s.username.replace(/[.#$/[\]]/g, "_") === t.userId || s.username === t.userId);
                const sTime = s.timestamp || (s.date ? new Date(s.date).getTime() : 0);
                return (nameMatches || userMatches) && sTime >= start && sTime <= end;
            });
            const salesMarkets = Array.from(new Set(employeeSales.map(s => s.market))).filter(Boolean);
            const userObj = usersList.find(u => 
                (u.id && u.id === t.userId) || 
                (u.key && u.key === t.userId) || 
                (u.name && u.name.trim().toLowerCase() === t.employeeName?.trim().toLowerCase())
            );
            const assignedMarket = t.market || (userObj as any)?.market || (userObj as any)?.assignedBranch || '';
            const allMarketNames = new Set<string>();
            if (assignedMarket) {
                assignedMarket.split(/[،,]/).map((m: string) => m.trim()).filter(Boolean).forEach((m: string) => allMarketNames.add(m));
            }
            salesMarkets.forEach(m => allMarketNames.add(m.trim()));
            const activeMarkets = Array.from(allMarketNames).join('، ');

            return { ...t, achieved, activeMarkets };
        });

        // استبعاد أي خانة ليس بها اسم موظف أو لا تحتوي على تارجت أو بيانات محققة
        let finalTargets = targetsWithAchieved.filter(t => {
            const hasName = t.employeeName && typeof t.employeeName === 'string' && t.employeeName.trim().length > 0;
            const targetVal = Number(t.finalTarget) || 0;
            const achievedVal = Number(t.achieved) || 0;
            const suggestedVal = Number(t.suggestedAmount) || 0;
            return hasName && (targetVal > 0 || achievedVal > 0 || suggestedVal > 0);
        });

        if (targetPrintEmployee) {
            finalTargets = finalTargets.filter(t => t.userId === targetPrintEmployee || t.employeeName === targetPrintEmployee);
        }
        const totalTarget = finalTargets.reduce((sum, t) => sum + (Number(t.finalTarget) || 0), 0);
        const totalAchieved = finalTargets.reduce((sum, t) => sum + (Number(t.achieved) || 0), 0);
        const totalPerc = totalTarget > 0 ? ((totalAchieved / totalTarget) * 100).toFixed(1) : "0.0";

        return (
            <div className="space-y-2 w-full min-w-0 overflow-x-hidden">
                {finalTargets.map((t, idx) => {
                    const perc = t.finalTarget > 0 ? ((t.achieved / t.finalTarget) * 100).toFixed(1) : "0.0";
                    return (
                        <div 
                            key={t.userId ? `target-${t.userId}-${idx}` : `target-${t.employeeName || idx}-${idx}`} 
                            className="flex items-center justify-between gap-1.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-black/30 border border-white/5 w-full min-w-0 overflow-hidden"
                        >
                            {/* الاسم وأسفله الفروع بشكل واضح أسفل بعض دون اختفاء أي جزء */}
                            <div className="flex-1 min-w-0 text-right pr-0.5">
                                <div className="font-extrabold text-white text-xs sm:text-sm break-words whitespace-normal leading-snug">
                                    {t.employeeName}
                                </div>
                                <div className="mt-1 space-y-0.5 text-[10px] sm:text-xs text-blue-300 font-semibold break-words whitespace-normal">
                                    <span className="text-gray-400 font-bold block text-[9px]">الفروع:</span>
                                    {(() => {
                                        const rawMarkets = t.activeMarkets || t.market || '';
                                        const marketList = rawMarkets.split(/[،,]/).map((m: string) => m.trim()).filter(Boolean);
                                        if (marketList.length === 0) return <span className="text-gray-400 text-[10px]">-</span>;
                                        return marketList.map((m: string, mIdx: number) => (
                                            <div key={mIdx} className="leading-tight text-blue-200 flex items-start gap-1 break-words whitespace-normal">
                                                <span className="text-blue-400 shrink-0 text-xs leading-none">•</span>
                                                <span>{m}</span>
                                            </div>
                                        ));
                                    })()}
                                </div>
                            </div>

                            {/* بجانبه التارجت و المحقق بدون ج.م و النسبه في صف واحد */}
                            <div className="flex items-center gap-2 sm:gap-3 shrink-0 text-center">
                                <div className="flex flex-col items-center justify-center min-w-0">
                                    <span className="text-[9px] text-gray-400 font-bold block">التارجت</span>
                                    <span className="font-black text-yellow-400 text-xs sm:text-sm">
                                        {(Number(t?.finalTarget) || 0).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex flex-col items-center justify-center min-w-0">
                                    <span className="text-[9px] text-gray-400 font-bold block">المحقق</span>
                                    <span className="font-black text-green-400 text-xs sm:text-sm">
                                        {(Number(t?.achieved) || 0).toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex flex-col items-center justify-center min-w-[34px] sm:min-w-[42px]">
                                    <span className="text-[9px] text-gray-400 font-bold block">النسبة</span>
                                    <span className="font-black text-blue-400 text-xs sm:text-sm">
                                        {perc}%
                                    </span>
                                </div>
                                <div data-html2canvas-ignore="true" className="flex items-center gap-1 border-r border-white/10 pr-1.5 mr-0.5">
                                    <button onClick={() => handleEditCurrentTarget(t.userId, t.finalTarget)} className="p-1 text-blue-400 hover:bg-blue-500/20 rounded-lg transition" title="تعديل"><Edit size={14}/></button>
                                    <button onClick={() => handleDeleteCurrentTarget(t.userId)} className="p-1 text-red-400 hover:bg-red-500/20 rounded-lg transition" title="حذف"><Trash2 size={14}/></button>
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {finalTargets.length > 0 && (
                    <div className="mt-3 p-3 rounded-2xl bg-orange-600/20 border border-orange-500/30 w-full min-w-0">
                        <div className="flex justify-between items-center">
                            <div className="font-bold text-white text-xs sm:text-base">{targetPrintEmployee ? "الإجمالي المحقق" : "الإجمالي لجميع الحسابات"}</div>
                            <div className="flex items-center gap-2">
                                <div className="text-left flex flex-col pl-2 border-l border-white/20">
                                    <span className="text-[10px] opacity-70 text-white">متوسط النسبة</span>
                                    <span className="font-black text-orange-400 text-xs sm:text-sm">{totalPerc}%</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-2 flex justify-between items-center bg-black/40 p-2.5 rounded-xl">
                            <div className="flex flex-col">
                                <span className="text-[9px] opacity-70 text-white uppercase font-black">إجمالي التارجت</span>
                                <span className="font-black text-yellow-400 text-xs sm:text-sm">{(Number(totalTarget) || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-[9px] opacity-70 text-white uppercase font-black">إجمالي المحقق</span>
                                <span className="font-black text-green-400 text-xs sm:text-sm">{(Number(totalAchieved) || 0).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                )}
                
                {finalTargets.length === 0 && <div className="text-center py-10 opacity-50 text-white">لا يوجد تارجت مسجل</div>}
            </div>
        );
    };

    const findExactEmployeeNames = () => {
        const allNames = new Set<string>();
        sales.forEach(s => { if (s.employeeName) allNames.add(s.employeeName); });
        usersList.forEach(u => { if (u.name) allNames.add(u.name); });
        
        const targets = {
            omnia: 'Omnia',
            toqa: 'Toqa',
            mena: 'Mena Ahmed'
        };
        
        allNames.forEach(name => {
            const lower = name.toLowerCase();
            if (lower.includes('omnia') || lower.includes('أمنية') || lower.includes('امنية')) {
                targets.omnia = name;
            }
            if (lower.includes('toqa') || lower.includes('تقى') || lower.includes('تقي')) {
                targets.toqa = name;
            }
            if (lower.includes('mena') || lower.includes('مينا')) {
                targets.mena = name;
            }
        });
        return targets;
    };

    const getEmployeeEnglishName = (sale: SaleRecord) => {
        const u = (sale.username || (sale as any).userName || '').trim();
        if (u && !/[\u0600-\u06FF]/.test(u)) {
            return u.charAt(0).toUpperCase() + u.slice(1);
        }

        const matched = usersList.find(usr => 
            (usr.name && usr.name.trim() === sale.employeeName?.trim()) ||
            (usr.username && usr.username.trim() === u)
        );
        if (matched?.username && !/[\u0600-\u06FF]/.test(matched.username)) {
            const mun = matched.username.trim();
            return mun.charAt(0).toUpperCase() + mun.slice(1);
        }
        if (matched?.name && !/[\u0600-\u06FF]/.test(matched.name)) {
            return matched.name.trim();
        }

        if (sale.employeeName && !/[\u0600-\u06FF]/.test(sale.employeeName)) {
            return sale.employeeName.trim();
        }

        const lower = (sale.employeeName || '').toLowerCase();
        if (lower.includes('أمنية') || lower.includes('امنية') || lower.includes('omnia')) return 'Omnia';
        if (lower.includes('تقى') || lower.includes('تقي') || lower.includes('toqa')) return 'Toqa';
        if (lower.includes('مينا') || lower.includes('mena')) return 'Mena';
        if (lower.includes('خالد') || lower.includes('khaled')) return 'Khaled';
        if (lower.includes('أمير') || lower.includes('امير') || lower.includes('amir')) return 'Amir';

        return u || sale.employeeName || 'Employee';
    };

    const getPastMonthTargetsData = (mKey: string) => {
        const [yStr, mStr] = mKey.split('-');
        const year = parseInt(yStr, 10);
        const month = parseInt(mStr, 10) - 1; // Month index (0-11)
        
        const exactNames = findExactEmployeeNames();
        const targetNames = [exactNames.omnia, exactNames.toqa, exactNames.mena].filter(Boolean);

        const candidates = new Map<string, { userId: string; employeeName: string; market: string }>();

        targetsList.forEach(t => {
            if (t.employeeName && typeof t.employeeName === 'string' && t.employeeName.trim().length > 0) {
                const name = t.employeeName.trim();
                candidates.set(name, {
                    userId: t.userId || name,
                    employeeName: name,
                    market: t.market || ''
                });
            }
        });

        archiveData.forEach(h => {
            if (h.month === mKey && !(h as any).isDeleted && h.employeeName && typeof h.employeeName === 'string' && h.employeeName.trim().length > 0) {
                const name = h.employeeName.trim();
                let market = '';
                const existing = candidates.get(name);
                if (existing && existing.market) {
                    market = existing.market;
                } else {
                    const foundTarget = targetsList.find(t => t.employeeName?.trim() === name);
                    if (foundTarget && foundTarget.market) {
                        market = foundTarget.market;
                    } else {
                        const foundSale = sales.find(s => s.employeeName?.trim() === name);
                        market = foundSale ? foundSale.market : 'غير محدد';
                    }
                }
                candidates.set(name, {
                    userId: h.userId || name,
                    employeeName: name,
                    market: market || 'غير محدد'
                });
            }
        });

        // تضمين أي موظف تم تسجيل مبيعات له في هذا الشهر المحدد
        const start = new Date(year, month, 1).getTime();
        const end = new Date(year, month + 1, 0, 23, 59, 59).getTime();
        sales.forEach(s => {
            const t = s.timestamp || new Date(s.date).getTime();
            if (t >= start && t <= end && s.employeeName && typeof s.employeeName === 'string' && s.employeeName.trim().length > 0) {
                const name = s.employeeName.trim();
                if (!candidates.has(name)) {
                    candidates.set(name, {
                        userId: s.username || name,
                        employeeName: name,
                        market: s.market || 'غير محدد'
                    });
                }
            }
        });

        if (mKey === "2026-06") {
            targetNames.forEach(empName => {
                if (empName && typeof empName === 'string' && empName.trim().length > 0 && !candidates.has(empName.trim())) {
                    const name = empName.trim();
                    const u = usersList.find(usr => usr.name === name);
                    const t = targetsList.find(tg => tg.employeeName === name);
                    let market = t ? t.market : '';
                    if (!market) {
                        const foundSale = sales.find(s => s.employeeName === name);
                        market = foundSale ? foundSale.market : 'غير محدد';
                    }
                    candidates.set(name, {
                        userId: u?.key || name,
                        employeeName: name,
                        market: market || 'غير محدد'
                    });
                }
            });
        }

        const resultList = Array.from(candidates.values()).map(c => {
            if (!c.employeeName || typeof c.employeeName !== 'string' || !c.employeeName.trim()) {
                return null;
            }

            const historical = archiveData.find(a => (a.userId === c.userId || a.employeeName?.trim() === c.employeeName.trim()) && a.month === mKey);
            
            let targetAmount = 0;
            if (historical) {
                if ((historical as any).isDeleted) return null;
                targetAmount = Number(historical.targetAmount) || 0;
            } else {
                const t = targetsList.find(x => x.employeeName?.trim() === c.employeeName.trim() || x.userId === c.userId);
                targetAmount = t ? (Number(t.finalTarget) || 0) : 0;
            }

            let achievedAmount = computeAchieved(c.employeeName, year, month, c.userId);
            const employeeSales = sales.filter(s => {
                const nameMatches = s.employeeName?.trim().toLowerCase() === c.employeeName?.trim().toLowerCase();
                const userMatches = c.userId && s.username && (s.username.replace(/[.#$/\[\]]/g, "_") === c.userId || s.username === c.userId);
                const t = s.timestamp || new Date(s.date).getTime();
                return (nameMatches || userMatches) && t >= start && t <= end;
            });
            const activeMarkets = Array.from(new Set(employeeSales.map(s => s.market).filter(Boolean))).sort().join('، ');
            if (mKey === "2026-06" && targetNames.includes(c.employeeName)) {
                achievedAmount = computeAchieved(c.employeeName, 2026, 5, c.userId); // June
            }

            if (targetAmount <= 0 && achievedAmount <= 0) return null;

            return {
                userId: c.userId,
                employeeName: c.employeeName,
                market: c.market,
                targetAmount,
                achievedAmount,
                activeMarkets
            };
        }).filter(Boolean) as { userId: string; employeeName: string; market: string; targetAmount: number; achievedAmount: number; activeMarkets?: string; }[];

        return resultList.filter(item => item && item.employeeName && item.employeeName.trim().length > 0 && (Number(item.targetAmount) > 0 || Number(item.achievedAmount) > 0));
    };

    const getDropdownEmployees = () => {
        if (selectedTargetMonth === 'current') {
            const now = new Date();
            const curY = now.getFullYear();
            const curM = now.getMonth();
            const map = new Map<string, string>();

            targetsList.forEach(t => {
                if (t.employeeName && typeof t.employeeName === 'string' && t.employeeName.trim().length > 0) {
                    const name = t.employeeName.trim();
                    const val = t.userId || name;
                    map.set(val, name);
                }
            });

            usersList.forEach(u => {
                if (u.name && typeof u.name === 'string' && u.name.trim().length > 0) {
                    const name = u.name.trim();
                    const val = u.key || name;
                    const ach = computeAchieved(name, curY, curM, u.key);
                    if (ach > 0) {
                        map.set(val, name);
                    }
                }
            });

            return Array.from(map.entries()).map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        } else {
            const pastData = getPastMonthTargetsData(selectedTargetMonth);
            const [yStr, mStr] = selectedTargetMonth.split('-');
            const y = parseInt(yStr, 10);
            const mIdx = parseInt(mStr, 10) - 1;
            const map = new Map<string, string>();

            pastData.forEach(p => {
                if (p.employeeName && typeof p.employeeName === 'string' && p.employeeName.trim().length > 0) {
                    const name = p.employeeName.trim();
                    const val = p.userId || name;
                    map.set(val, name);
                }
            });

            const start = new Date(y, mIdx, 1).getTime();
            const end = new Date(y, mIdx + 1, 0, 23, 59, 59).getTime();
            sales.forEach(s => {
                const t = s.timestamp || new Date(s.date).getTime();
                if (t >= start && t <= end && s.employeeName && typeof s.employeeName === 'string' && s.employeeName.trim().length > 0) {
                    const name = s.employeeName.trim();
                    const val = s.username || name;
                    map.set(val, name);
                }
            });

            return Array.from(map.entries()).map(([key, name]) => ({ key, name })).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        }
    };

    const renderPastMonthTargetsList = (mKey: string) => {
        let dataList = getPastMonthTargetsData(mKey);
        if (targetPrintEmployee) {
            dataList = dataList.filter(t => 
                t.userId === targetPrintEmployee || 
                t.employeeName === targetPrintEmployee || 
                (t.employeeName && targetPrintEmployee && t.employeeName.trim().toLowerCase() === targetPrintEmployee.trim().toLowerCase())
            );
        }

        const totalTarget = dataList.reduce((sum, item) => sum + (Number(item.targetAmount) || 0), 0);
        const totalAchieved = dataList.reduce((sum, item) => sum + (Number(item.achievedAmount) || 0), 0);
        const totalPerc = totalTarget > 0 ? ((totalAchieved / totalTarget) * 100).toFixed(1) : "0.0";

        return (
            <div className="space-y-3 w-full min-w-0 overflow-x-hidden">
                <div className="p-3 bg-orange-600/10 border border-orange-500/30 rounded-2xl flex items-center justify-between">
                    <div>
                        <span className="text-[10px] opacity-70 text-white uppercase font-black block">شهر الأرشيف المختار</span>
                        <span className="font-black text-base text-white">{mKey}</span>
                    </div>
                </div>
                <div className="space-y-2 w-full min-w-0">
                    {dataList.map((item, idx) => {
                        const perc = item.targetAmount > 0 ? ((item.achievedAmount / item.targetAmount) * 100).toFixed(1) : "0.0";
                        return (
                            <div 
                                key={`past-target-${item.userId || item.employeeName}-${mKey}-${idx}`} 
                                className="flex items-center justify-between gap-1.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-black/30 border border-white/5 w-full min-w-0 overflow-hidden"
                            >
                                {/* الاسم وأسفله الفروع بشكل واضح أسفل بعض دون اختفاء أي جزء */}
                                <div className="flex-1 min-w-0 text-right pr-0.5">
                                    <div className="font-extrabold text-white text-xs sm:text-sm break-words whitespace-normal leading-snug">
                                        {item.employeeName}
                                    </div>
                                    <div className="mt-1 space-y-0.5 text-[10px] sm:text-xs text-blue-300 font-semibold break-words whitespace-normal">
                                        <span className="text-gray-400 font-bold block text-[9px]">الفروع:</span>
                                        {(() => {
                                            const rawMarkets = item.activeMarkets || item.market || '';
                                            const marketList = rawMarkets.split(/[،,]/).map((m: string) => m.trim()).filter(Boolean);
                                            if (marketList.length === 0) return <span className="text-gray-400 text-[10px]">-</span>;
                                            return marketList.map((m: string, mIdx: number) => (
                                                <div key={mIdx} className="leading-tight text-blue-200 flex items-start gap-1 break-words whitespace-normal">
                                                    <span className="text-blue-400 shrink-0 text-xs leading-none">•</span>
                                                    <span>{m}</span>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </div>

                                {/* بجانبه التارجت والمحقق بدون ج.م والنسبة في صف واحد */}
                                <div className="flex items-center gap-2 sm:gap-4 shrink-0 text-center">
                                    {/* التارجت بدون ج.م */}
                                    <div className="flex flex-col items-center justify-center min-w-0">
                                        <span className="text-[9px] text-gray-400 font-bold block">التارجت</span>
                                        <span className="font-black text-yellow-400 text-xs sm:text-sm">
                                            {(Number(item.targetAmount) || 0).toLocaleString()}
                                        </span>
                                    </div>

                                    {/* المحقق بدون ج.م */}
                                    <div className="flex flex-col items-center justify-center min-w-0">
                                        <span className="text-[9px] text-gray-400 font-bold block">المحقق</span>
                                        <span className="font-black text-green-400 text-xs sm:text-sm">
                                            {(Number(item.achievedAmount) || 0).toLocaleString()}
                                        </span>
                                    </div>

                                    {/* النسبة */}
                                    <div className="flex flex-col items-center justify-center min-w-[34px] sm:min-w-[42px]">
                                        <span className="text-[9px] text-gray-400 font-bold block">النسبة</span>
                                        <span className="font-black text-blue-400 text-xs sm:text-sm">
                                            {perc}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    {dataList.length === 0 && <div className="text-center py-10 opacity-50 text-white">لا توجد بيانات لهذا الشهر</div>}
                </div>
                {dataList.length > 0 && (
                    <div className="mt-3 p-3 rounded-2xl bg-orange-600/20 border border-orange-500/30 w-full min-w-0">
                        <div className="flex justify-between items-center">
                            <div className="font-bold text-white text-xs sm:text-base">{targetPrintEmployee ? "الإجمالي المحقق" : "الإجمالي لجميع الحسابات"}</div>
                            <div className="flex items-center gap-2">
                                <div className="text-left flex flex-col pl-2 border-l border-white/20">
                                    <span className="text-[10px] opacity-70 text-white">نسبة المحقق</span>
                                    <span className="font-black text-orange-400 text-xs sm:text-sm">{totalPerc}%</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-2 flex justify-between items-center bg-black/40 p-2.5 rounded-xl">
                            <div className="flex flex-col">
                                <span className="text-[9px] opacity-70 text-white uppercase font-black">إجمالي التارجت</span>
                                <span className="font-black text-yellow-400 text-xs sm:text-sm">{(Number(totalTarget) || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-[9px] opacity-70 text-white uppercase font-black">إجمالي المحقق</span>
                                <span className="font-black text-green-400 text-xs sm:text-sm">{(Number(totalAchieved) || 0).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const [isExportingTargetPDF, setIsExportingTargetPDF] = useState(false);

    const targetItemsForExport = useMemo(() => {
        if (!showCurrentTargetsModal && !showTargetModal && !showPastTargetsModal && !isExportingTargetPDF && !isExportingTargetImage) {
            return [];
        }
        if (selectedTargetMonth === 'current') {
            const now = new Date();
            const targetsWithAchieved = targetsList.map(t => {
                const achieved = computeAchieved(t.employeeName, now.getFullYear(), now.getMonth(), t.userId);
                
                const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime();
                const employeeSales = sales.filter(s => {
                    const nameMatches = s.employeeName?.trim().toLowerCase() === t.employeeName?.trim().toLowerCase();
                    const userMatches = t.userId && s.username && (s.username.replace(/[.#$/[\]]/g, "_") === t.userId || s.username === t.userId);
                    const sTime = s.timestamp || (s.date ? new Date(s.date).getTime() : 0);
                    return (nameMatches || userMatches) && sTime >= start && sTime <= end;
                });
                const salesMarkets = Array.from(new Set(employeeSales.map(s => s.market))).filter(Boolean);
                const userObj = usersList.find(u => 
                    (u.id && u.id === t.userId) || 
                    (u.key && u.key === t.userId) || 
                    (u.name && u.name.trim().toLowerCase() === t.employeeName?.trim().toLowerCase())
                );
                const assignedMarket = t.market || (userObj as any)?.market || (userObj as any)?.assignedBranch || '';
                const allMarketNames = new Set<string>();
                if (assignedMarket) {
                    assignedMarket.split(/[،,]/).map((m: string) => m.trim()).filter(Boolean).forEach((m: string) => allMarketNames.add(m));
                }
                salesMarkets.forEach(m => allMarketNames.add(m.trim()));
                const activeMarkets = Array.from(allMarketNames).join('، ');

                return {
                    userId: t.userId,
                    employeeName: t.employeeName,
                    targetAmount: Number(t.finalTarget) || 0,
                    achievedAmount: Number(achieved) || 0,
                    activeMarkets,
                    market: t.market
                };
            });

            let finalTargets = targetsWithAchieved.filter(t => {
                const hasName = t.employeeName && typeof t.employeeName === 'string' && t.employeeName.trim().length > 0;
                return hasName && (t.targetAmount > 0 || t.achievedAmount > 0);
            });

            if (targetPrintEmployee) {
                finalTargets = finalTargets.filter(t => t.userId === targetPrintEmployee || t.employeeName === targetPrintEmployee);
            }
            return finalTargets;
        } else {
            let dataList = getPastMonthTargetsData(selectedTargetMonth);
            if (targetPrintEmployee) {
                dataList = dataList.filter(t => 
                    t.userId === targetPrintEmployee || 
                    t.employeeName === targetPrintEmployee || 
                    (t.employeeName && targetPrintEmployee && t.employeeName.trim().toLowerCase() === targetPrintEmployee.trim().toLowerCase())
                );
            }
            return dataList.map(item => ({
                userId: item.userId,
                employeeName: item.employeeName,
                targetAmount: Number(item.targetAmount) || 0,
                achievedAmount: Number(item.achievedAmount) || 0,
                activeMarkets: item.activeMarkets || item.market || '',
                market: item.market
            }));
        }
    }, [showCurrentTargetsModal, showTargetModal, showPastTargetsModal, isExportingTargetPDF, isExportingTargetImage, selectedTargetMonth, targetsList, sales, usersList, targetPrintEmployee, archiveData]);

    const pagesOfTargetResults = useMemo(() => {
        if (!targetItemsForExport || targetItemsForExport.length === 0) return [];
        const chunkSize = 10;
        const pages: (typeof targetItemsForExport)[] = [];
        for (let i = 0; i < targetItemsForExport.length; i += chunkSize) {
            pages.push(targetItemsForExport.slice(i, i + chunkSize));
        }
        return pages;
    }, [targetItemsForExport]);

    const handleDownloadTargetPDF = async () => {
        if (!targetItemsForExport || targetItemsForExport.length === 0) {
            alert("لا توجد بيانات تارجت لتحميلها");
            return;
        }

        setIsExportingTargetPDF(true);
        try {
            const container = targetPdfPrintContainerRef.current;
            if (container) {
                container.style.display = 'block';
                container.style.position = 'fixed';
                container.style.top = '0px';
                container.style.left = '0px';
                container.style.zIndex = '99999';
                container.style.width = '1400px';

                await new Promise(r => setTimeout(r, 200));

                const pageElements = container.querySelectorAll('.target-pdf-page');
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'mm',
                    format: 'a4'
                });
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfPageHeight = pdf.internal.pageSize.getHeight();

                if (pageElements && pageElements.length > 0) {
                    for (let i = 0; i < pageElements.length; i++) {
                        const pageEl = pageElements[i] as HTMLElement;
                        const canvas = await html2canvas(pageEl, {
                            scale: 2,
                            useCORS: true,
                            backgroundColor: '#ffffff',
                            logging: false,
                            width: pageEl.offsetWidth || 1400,
                            height: pageEl.offsetHeight
                        });

                        const imgData = canvas.toDataURL('image/jpeg', 0.98);
                        const pageCanvasHeightInPdf = (canvas.height * pdfWidth) / canvas.width;

                        if (i > 0) pdf.addPage('a4', 'l');
                        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(pdfPageHeight, pageCanvasHeightInPdf));
                    }
                }

                const monthStr = selectedTargetMonth === 'current' 
                    ? `تارجت_الشهر_الحالي_${new Date().toISOString().slice(0, 7)}` 
                    : `ارشيف_تارجت_${selectedTargetMonth}`;
                const empName = targetPrintEmployee ? `_${targetPrintEmployee}` : '';
                const fileName = `${monthStr}${empName}.pdf`;
                pdf.save(fileName);
            } else {
                // Fallback to element capture if print container is not mounted
                let element = document.getElementById('current-targets-print-area') || document.getElementById('hidden-print-area');
                if (!element) return;
                const canvas = await html2canvas(element, {
                    backgroundColor: '#111827',
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    windowWidth: 1200
                });
                const imgData = canvas.toDataURL('image/jpeg', 0.98);
                const pdf = new jsPDF({
                    orientation: 'landscape',
                    unit: 'mm',
                    format: 'a4'
                });
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pageHeight = pdf.internal.pageSize.getHeight();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

                let heightLeft = pdfHeight;
                let position = 0;

                if (pdfHeight > pageHeight) {
                    while (heightLeft > 0) {
                        pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
                        heightLeft -= pageHeight;
                        position -= pageHeight;
                        if (heightLeft > 0) {
                            pdf.addPage('a4', 'l');
                        }
                    }
                } else {
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
                }

                const monthStr = selectedTargetMonth === 'current' 
                    ? `تارجت_الشهر_الحالي_${new Date().toISOString().slice(0, 7)}` 
                    : `ارشيف_تارجت_${selectedTargetMonth}`;
                const empName = targetPrintEmployee ? `_${targetPrintEmployee}` : '';
                const fileName = `${monthStr}${empName}.pdf`;
                pdf.save(fileName);
            }
        } catch (err) {
            console.error("PDF export error", err);
            alert("حدث خطأ أثناء تحميل ملف التارجت PDF");
        } finally {
            if (targetPdfPrintContainerRef.current) {
                targetPdfPrintContainerRef.current.style.display = 'none';
            }
            setIsExportingTargetPDF(false);
        }
    };

    const handleDownloadImage = async (isLowQuality = false) => {
        if (!targetItemsForExport || targetItemsForExport.length === 0) {
            alert("لا توجد بيانات تارجت لتحميلها كصورة");
            return;
        }

        const element = targetImageExportContainerRef.current || document.getElementById('target-image-full-render');
        if (!element) {
            alert("تعذر العثور على منطقة تصدير الصورة");
            return;
        }

        setIsExportingTargetImage(true);
        try {
            await new Promise(r => setTimeout(r, 120));

            const canvas = await html2canvas(element, {
                backgroundColor: '#0f172a',
                scale: 2.5, // دقة عالية جداً وواضحة (Clear & High Res)
                useCORS: true,
                logging: false,
                allowTaint: true,
                scrollX: 0,
                scrollY: 0,
                windowWidth: 840,
                windowHeight: element.scrollHeight + 150,
                onclone: (clonedDoc) => {
                    const clonedEl = clonedDoc.getElementById('target-image-full-render');
                    if (clonedEl) {
                        clonedEl.style.position = 'static';
                        clonedEl.style.left = '0px';
                        clonedEl.style.top = '0px';
                        clonedEl.style.width = '780px';
                        clonedEl.style.height = 'auto';
                        clonedEl.style.overflow = 'visible';
                        clonedEl.style.display = 'block';
                    }
                }
            });

            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    const monthStr = selectedTargetMonth === 'current' 
                        ? `تارجت_الشهر_الحالي_${new Date().toISOString().slice(0, 7)}` 
                        : `ارشيف_تارجت_${selectedTargetMonth}`;
                    const empName = targetPrintEmployee ? `_${targetPrintEmployee}` : '';
                    link.download = `${monthStr}${empName}.png`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 200);
                }
            }, 'image/png', 1.0);
        } catch (err) {
            console.error("Failed to capture target image", err);
            alert("حدث خطأ أثناء تحميل صورة التارجت");
        } finally {
            setIsExportingTargetImage(false);
        }
    };

    const handleDownloadPastMonthImage = async (mKey: string, asShare = false) => {
        const element = document.getElementById('past-targets-print-area-' + mKey) || document.getElementById('current-targets-print-area');
        if (!element) return;
        try {
            const canvas = await html2canvas(element, {
                backgroundColor: '#111827',
                scale: 8000 / element.offsetWidth,
            });
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            
            if (asShare && navigator.share) {
                const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 1.0));
                if (blob) {
                    const file = new File([blob], 'targets_' + mKey + '.png', { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: 'تارجت ' + mKey });
                        return;
                    }
                }
            }
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `targets-${mKey}.png`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                }
            }, 'image/png', 1.0);
        } catch (err) {
            console.error("Failed to capture image", err);
            alert("حدث خطأ أثناء تحميل الصورة");
        }
    };

    const handleExportFilteredExcel = () => {
        const salesToExport = selectedSalesIds.length > 0 
            ? filteredSales.filter(s => selectedSalesIds.includes(s.id))
            : filteredSales;

        if (salesToExport.length === 0) {
            alert("لا توجد مبيعات للتصدير");
            return;
        }

        let grandTotal = 0;
        const exportData = salesToExport.map((s, idx) => {
            grandTotal += (Number(s.total) || 0);
            const dateStr = s.date || (s.timestamp ? new Date(s.timestamp).toLocaleDateString('ar-EG') : '');
            const dayStr = s.timestamp ? new Date(s.timestamp).toLocaleDateString('ar-EG', { weekday: 'long' }) : '';
            
            const itemsSummary = (s.items || [])
                .map(item => `${item.name} (${item.qty} × ${item.price} ج.م)`)
                .join(' - ');

            return {
                "م": idx + 1,
                "اسم الموظف": s.employeeName || s.username || "غير محدد",
                "اليوم": dayStr,
                "التاريخ": dateStr,
                "اسم الماركت / الفرع": s.market || resolveMarketForSale(s),
                "الأصناف المباعة": itemsSummary || 'بدون تفاصيل',
                "إجمالي مبيعات العملية": Number(s.total) || 0
            };
        });

        // سطر الإجمالي العام
        exportData.push({
            "م": "" as any,
            "اسم الموظف": "الإجمالي العام",
            "اليوم": "",
            "التاريخ": "",
            "اسم الماركت / الفرع": `عدد العمليات: ${salesToExport.length}`,
            "الأصناف المباعة": "",
            "إجمالي مبيعات العملية": grandTotal
        });

        let dateLabel = "جميع_المبيعات";
        if (filterDate && filterEndDate) {
            dateLabel = `من_${filterDate}_إلى_${filterEndDate}`;
        } else if (filterDate) {
            dateLabel = `تاريخ_${filterDate}`;
        } else if (filterEndDate) {
            dateLabel = `حتى_تاريخ_${filterEndDate}`;
        }

        const fileName = `سجل_المبيعات_${dateLabel}_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}`;
        exportToExcel([{ name: "سجل المبيعات", data: exportData }], fileName);
    };

    const handleExportCurrent = () => {
        handleExportFilteredExcel();
    };

    const handleExportPeriod = () => {
        if (!exportStart || !exportEnd) return alert("اختر الفترة الزمنية");
        
        const start = exportStart <= exportEnd ? exportStart : exportEnd;
        const end = exportStart <= exportEnd ? exportEnd : exportStart;

        const periodSales = sales.filter(s => {
            const sDate = getSaleISODate(s);
            const matchesDate = sDate ? (sDate >= start && sDate <= end) : false;
            const matchesMarket = !exportMarket || s.market === exportMarket;
            const matchesEmployee = !exportEmployee || s.employeeName === exportEmployee || s.username === exportEmployee;
            return matchesDate && matchesMarket && matchesEmployee;
        });
        
        if (periodSales.length === 0) return alert("لا توجد مبيعات في هذه الفترة");

        let grandTotalValue = 0;
        const exportData = periodSales.map((s, idx) => {
            grandTotalValue += (Number(s.total) || 0);
            const itemsSummary = (s.items || [])
                .map(item => `${item.name} (${item.qty} × ${item.price} ج.م)`)
                .join(' - ');

            return {
                "م": idx + 1,
                "اسم الموظف": s.employeeName || s.username || "System",
                "اليوم": s.timestamp ? new Date(s.timestamp).toLocaleDateString('ar-EG', { weekday: 'long' }) : '',
                "التاريخ": s.date || (s.timestamp ? new Date(s.timestamp).toLocaleDateString('ar-EG') : ''),
                "اسم الماركت / الفرع": s.market || resolveMarketForSale(s),
                "الأصناف المباعة": itemsSummary || 'بدون تفاصيل',
                "إجمالي المبيعات": Number(s.total) || 0
            };
        });

        exportData.push({
            "م": "" as any,
            "اسم الموظف": "الإجمالي العام",
            "اليوم": "",
            "التاريخ": "",
            "اسم الماركت / الفرع": `عدد العمليات: ${periodSales.length}`,
            "الأصناف المباعة": "",
            "إجمالي المبيعات": grandTotalValue
        });

        exportToExcel([{ name: "تقرير المبيعات", data: exportData }], `تقرير_مبيعات_من_${start}_إلى_${end}`);
        setShowExportModal(false);
    };

    const handleExportProductSales = () => {
        const empLabel = reportEmployee !== 'all' ? reportEmployee : 'كل الموظفين';
        const marketLabel = reportMarket !== 'all' ? reportMarket : 'كل الماركتات';
        const dataRows = (Object.entries(reportResults.itemsGrouped) as [string, { price: number; qty: number; total: number }][]).map(([name, stats]) => ({
            "اسم الصنف": name,
            "الموظف": empLabel,
            "الماركت": marketLabel,
            "الفترة": `من ${reportStart || 'البداية'} إلى ${reportEnd || 'الآن'}`,
            "سعر القطعة": stats.price,
            "الكمية المباعة": stats.qty,
            "الإجمالي": stats.total
        }));
        
        dataRows.push({
            "اسم الصنف": "الإجمالي العام",
            "الموظف": empLabel,
            "الماركت": marketLabel,
            "الفترة": "",
            "سعر القطعة": 0,
            "الكمية المباعة": reportResults.totalQty,
            "الإجمالي": reportResults.totalValue
        });

        exportToCSV(dataRows, `Product_Sales_Report_${reportStart || 'all'}_to_${reportEnd || 'all'}`);
    };

    const handleUpdateSale = async () => {
        if (!editingSale || !editingSale.id) return;
        const newTotal = editingSale.items.reduce((acc, item) => acc + (item.price * item.qty), 0);
        await update(ref(db, `sales/${editingSale.id}`), {
            items: editingSale.items,
            total: newTotal
        });
        alert("تم تحديث البيعة بنجاح");
        setEditingSale(null);
    };

    const updateEditingItem = (index: number, field: keyof ProductItem, value: any) => {
        if (!editingSale) return;
        const newItems = [...editingSale.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setEditingSale({ ...editingSale, items: newItems });
    };

    const getStarOfMonth = () => {
        const sourceSales = allCompanySales.length > 0 ? allCompanySales : sales;
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime(); // fixing to end of month
        let currentMonthSales = sourceSales.filter(s => {
            const t = typeof s.timestamp === 'number' && !isNaN(s.timestamp) && s.timestamp > 0
                ? s.timestamp
                : (s.date ? new Date(s.date).getTime() : 0);
            return t >= start && t <= end;
        });

        // Fallback by ISO date string if timestamp is missing or out of sync
        if (currentMonthSales.length === 0) {
            const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            currentMonthSales = sourceSales.filter(s => {
                const iso = getSaleISODate(s);
                return iso.startsWith(currentYearMonth);
            });
        }

        // Fallback to latest available month with sales if current month has no sales yet
        if (currentMonthSales.length === 0 && sourceSales.length > 0) {
            const timestamps = sourceSales.map(s => {
                const t = typeof s.timestamp === 'number' && !isNaN(s.timestamp) && s.timestamp > 0
                    ? s.timestamp
                    : (s.date ? new Date(s.date).getTime() : 0);
                return t;
            }).filter(t => t > 0);
            if (timestamps.length > 0) {
                const latestTime = Math.max(...timestamps);
                const d = new Date(latestTime);
                const lStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime();
                const lEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
                currentMonthSales = sourceSales.filter(s => {
                    const t = typeof s.timestamp === 'number' && !isNaN(s.timestamp) && s.timestamp > 0
                        ? s.timestamp
                        : (s.date ? new Date(s.date).getTime() : 0);
                    return t >= lStart && t <= lEnd;
                });
            }
        }

        const totals: Record<string, number> = {};
        currentMonthSales.forEach(s => {
            const empName = (s.employeeName || s.username || '').trim();
            if (empName) {
                totals[empName] = (totals[empName] || 0) + (Number(s.total) || 0);
            }
        });
        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
        
        let result: any = null;
        if (sorted.length > 0) {
            result = { 
                first: { name: sorted[0][0], total: sorted[0][1] },
                second: sorted.length > 1 ? { name: sorted[1][0], total: sorted[1][1] } : null
            };
        }
        return result;
    };

    const stars = useMemo(() => getStarOfMonth(), [allCompanySales, sales]);

    // Faqd helper functions
    const normalizeArabicText = (s: string) => {
        return (s || '')
            .trim()
            .toLowerCase()
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي')
            .replace(/[\u064B-\u065F]/g, '');
    };

    const getArabicDayName = (dateStr: string) => {
        try {
            if (!dateStr) return '';
            const [y, m, d] = dateStr.split(/[-/]/).map(Number);
            const date = new Date(y, m - 1, d);
            const weekdays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
            return weekdays[date.getDay()] || date.toLocaleDateString('ar-EG', { weekday: 'long' });
        } catch {
            return '';
        }
    };

    const getDatesInRange = (startDate: string, endDate: string): string[] => {
        if (!startDate || !endDate) return [];
        const start = startDate <= endDate ? startDate : endDate;
        const end = startDate <= endDate ? endDate : startDate;
        
        const dates: string[] = [];
        const [sy, sm, sd] = start.split('-').map(Number);
        const [ey, em, ed] = end.split('-').map(Number);
        
        const curr = new Date(sy, sm - 1, sd);
        const stop = new Date(ey, em - 1, ed);
        
        let safety = 0;
        while (curr <= stop && safety < 370) {
            const y = curr.getFullYear();
            const m = String(curr.getMonth() + 1).padStart(2, '0');
            const d = String(curr.getDate()).padStart(2, '0');
            dates.push(`${y}-${m}-${d}`);
            curr.setDate(curr.getDate() + 1);
            safety++;
        }
        return dates;
    };

    const getEmployeeLeaveStatus = (empName: string, dateStr: string, dayName: string): string => {
        try {
            const norm = normalizeArabicText(empName);
            const userObj = usersList.find(u => 
                (u.name && normalizeArabicText(u.name) === norm) || 
                (u.username && normalizeArabicText(u.username) === norm) || 
                u.key === empName || 
                u.id === empName
            );
            const userId = userObj?.key || userObj?.id || empName;

            // 1. فحص سجل الإجازات المسجلة (سنوي، عارضة، غياب بأذن، إلخ)
            const leaveRec = leaveHistory.find(l => {
                const nameMatch = l.employeeName && normalizeArabicText(l.employeeName) === norm;
                const userMatch = l.userId && (l.userId === userId || l.userId === userObj?.key);
                if (!nameMatch && !userMatch) return false;

                const lDays = Math.max(1, Math.ceil(Number(l.days) || 1));
                const lDateStr = (l.date || '').split('T')[0];
                if (lDateStr === dateStr) return true;
                if (lDays > 1 && lDateStr) {
                    const [ly, lm, ld] = lDateStr.split(/[-/]/).map(Number);
                    const [cy, cm, cd] = dateStr.split(/[-/]/).map(Number);
                    if (!isNaN(ly) && !isNaN(cy)) {
                        const lTime = new Date(ly, lm - 1, ld).getTime();
                        const cTime = new Date(cy, cm - 1, cd).getTime();
                        const diffDays = Math.round((cTime - lTime) / (1000 * 60 * 60 * 24));
                        return diffDays >= 0 && diffDays < lDays;
                    }
                }
                return false;
            });

            if (leaveRec) {
                const t = leaveRec.type;
                if (t === 'annual' || t === 'summer') return "إجازة سنوي";
                if (t === 'casual') return "إجازة عارضة";
                if (t === 'unpaid' || t === 'penalty') return "غياب بإذن";
                if (t === 'sick') return "إجازة مرضي";
                if (t === 'exams') return "إجازة امتحانات";
                if (t === 'official') return "إجازة رسمية";
                if (leaveRec.customLabel) return leaveRec.customLabel;
                return "إجازة";
            }

            // 2. فحص رصيد الإجازات والأيام الأسبوعية
            const balance = leaveBalances[userId] || 
                (userObj?.key ? leaveBalances[userObj.key] : null) || 
                Object.values(leaveBalances).find((b: any) => 
                    (b?.employeeName && normalizeArabicText(b.employeeName) === norm) ||
                    (b?.userId && (b.userId === userId || b.userId === userObj?.key))
                );
            const weeklyDays: string[] = balance?.weeklyDays || [];
            const normDay = normalizeArabicText(dayName);
            if (weeklyDays.some(w => normalizeArabicText(w) === normDay)) {
                return "إجازة أسبوعية";
            }

            return "لا";
        } catch {
            return "لا";
        }
    };

    const computeFaqdData = () => {
        if (!faqdStartDate || !faqdEndDate) {
            return [];
        }

        const start = faqdStartDate <= faqdEndDate ? faqdStartDate : faqdEndDate;
        const end = faqdStartDate <= faqdEndDate ? faqdEndDate : faqdStartDate;

        let targetEmployees: string[] = [];
        if (faqdSelectedEmployee && faqdSelectedEmployee.trim() !== '') {
            targetEmployees = [faqdSelectedEmployee.trim()];
        } else {
            // All accounts with recorded sales
            targetEmployees = [...employeesWithSales];
        }

        if (targetEmployees.length === 0) {
            return [];
        }

        const dateList = getDatesInRange(start, end);
        if (dateList.length === 0) {
            return [];
        }

        // فهرسة المبيعات مرة واحدة O(N) لتسريع حساب الفقد فوراً
        const salesByDateAndEmp = new Map<string, Map<string, number>>();
        for (let i = 0; i < sales.length; i++) {
            const s = sales[i];
            const sDate = getSaleISODate(s);
            if (!sDate || sDate < start || sDate > end) continue;
            let dateMap = salesByDateAndEmp.get(sDate);
            if (!dateMap) {
                dateMap = new Map<string, number>();
                salesByDateAndEmp.set(sDate, dateMap);
            }
            const sEmp = (s.employeeName || '').trim().toLowerCase();
            const sUser = (s.username || '').trim().toLowerCase();
            if (sEmp) dateMap.set(sEmp, (dateMap.get(sEmp) || 0) + 1);
            if (sUser && sUser !== sEmp) dateMap.set(sUser, (dateMap.get(sUser) || 0) + 1);
        }

        const results: Array<{
            employeeName: string;
            dayName: string;
            date: string;
            salesCount: number;
            salesCountDisplay: string;
            hasSales: boolean;
            statusLabel: string;
        }> = [];

        targetEmployees.forEach(empName => {
            const normEmp = empName.trim().toLowerCase();
            const normAr = normalizeArabicText(empName);
            const userObj = usersList.find(u => 
                (u.name && normalizeArabicText(u.name) === normAr) || 
                (u.username && normalizeArabicText(u.username) === normAr)
            );
            const altEmp = userObj?.username ? userObj.username.trim().toLowerCase() : '';

            dateList.forEach(dStr => {
                const dayName = getArabicDayName(dStr);
                const dateMap = salesByDateAndEmp.get(dStr);

                let salesCount = 0;
                if (dateMap) {
                    salesCount += dateMap.get(normEmp) || 0;
                    if (altEmp && altEmp !== normEmp) {
                        salesCount += dateMap.get(altEmp) || 0;
                    }
                }

                const hasSales = salesCount > 0;
                const statusLabel = hasSales ? "نعم" : getEmployeeLeaveStatus(empName, dStr, dayName);
                const salesCountDisplay = salesCount > 1 ? salesCount.toString() : '';

                results.push({
                    employeeName: empName,
                    dayName,
                    date: dStr,
                    salesCount,
                    salesCountDisplay,
                    hasSales,
                    statusLabel
                });
            });
        });

        return results;
    };

    // حساب نتائج تقرير الفقد لحظياً عند فتح شاشة الفقد فقط لتسريع تصفح السجل
    const faqdResults = useMemo(() => {
        if (!showFaqdModal && !isExportingFaqdPDF) return [];
        return computeFaqdData();
    }, [showFaqdModal, isExportingFaqdPDF, faqdSelectedEmployee, faqdStartDate, faqdEndDate, sales, employeesWithSales, leaveHistory, leaveBalances, usersList]);

    const handleExportFaqdExcel = () => {
        const currentResults = faqdResults;
        if (!currentResults || currentResults.length === 0) {
            return;
        }

        const excelData = currentResults.map(r => ({
            "اسم الموظف": r.employeeName,
            "اليوم": r.dayName,
            "التاريخ": r.date,
            "عدد المبيعات": r.salesCountDisplay || "",
            "هل مسجل له مبيعات ام لا": r.statusLabel || (r.hasSales ? "نعم" : "لا")
        }));

        const empLabel = faqdSelectedEmployee ? faqdSelectedEmployee.replace(/\s+/g, '_') : 'كل_الأسماء';
        const fileName = `تقرير_الفقد_${empLabel}_من_${faqdStartDate}_إلى_${faqdEndDate}`;
        exportToExcel([{ name: "تقرير الفقد", data: excelData }], fileName);
    };

    const handleExportFaqdPDF = async () => {
        const currentResults = faqdResults;
        if (!currentResults || currentResults.length === 0) {
            return;
        }

        setIsExportingFaqdPDF(true);
        try {
            const container = faqdPrintContainerRef.current;
            if (!container) return;

            container.style.display = 'block';
            container.style.position = 'fixed';
            container.style.top = '0px';
            container.style.left = '0px';
            container.style.zIndex = '99999';
            container.style.width = '1050px';

            await new Promise(r => setTimeout(r, 200));

            const pageElements = container.querySelectorAll('.faqd-pdf-page');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfPageHeight = pdf.internal.pageSize.getHeight();

            if (pageElements && pageElements.length > 0) {
                for (let i = 0; i < pageElements.length; i++) {
                    const pageEl = pageElements[i] as HTMLElement;
                    const canvas = await html2canvas(pageEl, {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        logging: false,
                        width: pageEl.offsetWidth || 1050,
                        height: pageEl.offsetHeight
                    });

                    const imgData = canvas.toDataURL('image/jpeg', 0.98);
                    const pageCanvasHeightInPdf = (canvas.height * pdfWidth) / canvas.width;

                    if (i > 0) pdf.addPage();
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(pdfPageHeight, pageCanvasHeightInPdf));
                }
            }

            const empLabel = faqdSelectedEmployee ? faqdSelectedEmployee.replace(/\s+/g, '_') : 'كل_الأسماء';
            const fileName = `تقرير_الفقد_${empLabel}_من_${faqdStartDate}_إلى_${faqdEndDate}.pdf`;
            pdf.save(fileName);
        } catch (err) {
            console.error("PDF export error", err);
            alert("حدث خطأ أثناء تصدير ملف PDF");
        } finally {
            if (faqdPrintContainerRef.current) {
                faqdPrintContainerRef.current.style.display = 'none';
            }
            setIsExportingFaqdPDF(false);
        }
    };

    const pagesOfFaqdResults = useMemo(() => {
        if (!faqdResults || faqdResults.length === 0) return [];
        const chunkSize = 25;
        const pages: (typeof faqdResults)[] = [];
        for (let i = 0; i < faqdResults.length; i += chunkSize) {
            pages.push(faqdResults.slice(i, i + chunkSize));
        }
        return pages;
    }, [faqdResults]);

    // منطق تقرير ومعدل الأداء (شاشة الأداء)
    const monthNamesAr = [
        'يناير (1)', 'فبراير (2)', 'مارس (3)', 'أبريل (4)', 'مايو (5)', 'يونيو (6)', 
        'يوليو (7)', 'أغسطس (8)', 'سبتمبر (9)', 'أكتوبر (10)', 'نوفمبر (11)', 'ديسمبر (12)'
    ];

    const currentYear = new Date().getFullYear();
    const selectedPerfYear = perfYearMode === 'current' ? currentYear : currentYear - 1;

    // حساب أداء موظف لشهر محدد
    const getEmployeeMonthPerformance = (empName: string, year: number, monthIdx: number) => {
        const start = new Date(year, monthIdx, 1).getTime();
        const end = new Date(year, monthIdx + 1, 0, 23, 59, 59, 999).getTime();

        const monthSales = sales.filter(s => {
            const match = s.employeeName && s.employeeName.trim().toLowerCase() === empName.trim().toLowerCase();
            const t = s.timestamp || (s.date ? new Date(s.date).getTime() : 0);
            return match && t >= start && t <= end;
        });

        const achieved = monthSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);

        const monthStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
        let target = 0;
        const hist = archiveData.find(a => 
            a.employeeName && a.employeeName.trim().toLowerCase() === empName.trim().toLowerCase() && 
            a.month === monthStr
        );
        if (hist) {
            target = Number(hist.targetAmount) || 0;
        } else {
            const t = targetsList.find(tg => tg.employeeName && tg.employeeName.trim().toLowerCase() === empName.trim().toLowerCase());
            target = t ? Number(t.finalTarget || t.targetAmount || 0) : 0;
        }

        const rate = target > 0 ? (achieved / target) * 100 : (achieved > 0 ? 100 : 0);
        return { achieved, target, rate };
    };

    // الاستعلام عن رصيد الإجازات والجزاءات للموظف خلال الفترة المستعلم عنها
    const getEmployeeLeavesAndPenalties = (empName: string, year: number, endMonthIdx?: number) => {
        const norm = normalizeArabicText(empName);
        const userObj = usersList.find(u => 
            (u.name && normalizeArabicText(u.name) === norm) ||
            (u.username && normalizeArabicText(u.username) === norm)
        );
        const userId = userObj?.key || userObj?.id || empName;

        const balance = leaveBalances[userId] || 
            (userObj?.key ? leaveBalances[userObj.key] : null) || 
            Object.values(leaveBalances).find((b: any) => 
                (b?.employeeName && normalizeArabicText(b.employeeName) === norm) ||
                (b?.userId && (b.userId === userId || b.userId === userObj?.key))
            );

        const annualRemaining = Number(balance?.annual ?? 21);
        const casualRemaining = Number(balance?.casual ?? 7);
        const examsBalance = Number(balance?.exams ?? 0);
        const penaltiesBalance = Number(balance?.penalty ?? 0);
        const unpaidBalance = Number(balance?.unpaid ?? 0);

        const startTimestamp = new Date(year, 0, 1, 0, 0, 0, 0).getTime();
        const endTimestamp = endMonthIdx !== undefined 
            ? new Date(year, endMonthIdx + 1, 0, 23, 59, 59, 999).getTime()
            : new Date(year, 11, 31, 23, 59, 59, 999).getTime();

        const empHistory = leaveHistory.filter(l => {
            const matchName = l.employeeName && normalizeArabicText(l.employeeName) === norm;
            const matchUser = l.userId && (l.userId === userId || l.userId === userObj?.key);
            if (!matchName && !matchUser) return false;
            
            let recTime = 0;
            if (l.timestamp) {
                recTime = Number(l.timestamp);
            } else if (l.date) {
                recTime = new Date(l.date).getTime();
            }
            if (recTime > 0) {
                return recTime >= startTimestamp && recTime <= endTimestamp;
            }
            let recYear = year;
            if (l.date) recYear = new Date(l.date).getFullYear();
            return recYear === year;
        });

        let annualUsed = 0;
        let casualUsed = 0;
        let summerUsed = 0;
        let examsUsed = 0;
        let sickUsed = 0;
        let penaltiesCount = 0;
        let unpaidUsed = 0;
        let officialUsed = 0;

        empHistory.forEach(l => {
            const days = Number(l.days) || 1;
            if (l.type === 'annual' || (l.deductedFromAnnual && l.deductedFromAnnual > 0)) {
                annualUsed += l.deductedFromAnnual || days;
            } else if (l.type === 'casual' || (l.deductedFromCasual && l.deductedFromCasual > 0)) {
                casualUsed += l.deductedFromCasual || days;
            } else if (l.type === 'summer') {
                summerUsed += days;
            } else if (l.type === 'exams') {
                examsUsed += days;
            } else if (l.type === 'sick') {
                sickUsed += days;
            } else if (l.type === 'penalty') {
                penaltiesCount += days;
            } else if (l.type === 'unpaid' || (l.deductedFromUnpaid && l.deductedFromUnpaid > 0) || l.title?.includes('إذن') || l.title?.includes('أذن') || l.title?.includes('اذن')) {
                unpaidUsed += l.deductedFromUnpaid || days;
            } else if (l.type === 'official') {
                officialUsed += days;
            }
        });

        if (penaltiesCount === 0 && penaltiesBalance > 0) {
            penaltiesCount = penaltiesBalance;
        }
        if (examsUsed === 0 && examsBalance > 0) {
            examsUsed = examsBalance;
        }

        return {
            annualUsed,
            annualRemaining,
            casualUsed,
            casualRemaining,
            summerUsed,
            examsUsed,
            sickUsed,
            penaltiesCount,
            unpaidUsed,
            officialUsed
        };
    };

    // حساب تقييم شامل لموظف مع مراعاة الفترة المستعلام عنها وتجاهل الأشهر التي لم يسجل بها مبيعات
    const computeEmployeeFullPerformance = (empName: string, year: number, endMonth: number) => {
        const monthlyBreakdown: { 
            month: string; 
            monthIdx: number; 
            achieved: number; 
            target: number; 
            rate: number; 
            hasSales: boolean;
        }[] = [];
        let totalAchieved = 0;
        let totalTarget = 0;
        let evaluatedMonthsCount = 0;

        for (let m = 0; m <= endMonth; m++) {
            const data = getEmployeeMonthPerformance(empName, year, m);
            const hasSales = (Number(data.achieved) || 0) > 0;
            
            monthlyBreakdown.push({
                month: monthNamesAr[m],
                monthIdx: m,
                ...data,
                hasSales
            });

            // في حالة احتساب الأداء يكون للفترة التي يتم الاستعلام عنها فقط ويتم تجاهل الأشهر التي لم يسجل بها مبيعات
            if (hasSales) {
                evaluatedMonthsCount++;
                totalAchieved += data.achieved;
                totalTarget += data.target;
            }
        }

        const overallSalesRate = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : (totalAchieved > 0 ? 100 : 0);
        const leaves = getEmployeeLeavesAndPenalties(empName, year, endMonth);

        // تقييم احترافي دقيق ومعتمد للأداء:
        // 1. تقييم المبيعات (بحد أقصى 70 نقطة من 100) بناء على نسبة تحقيق التارجت للأشهر النشطة المقيمة
        const salesScore = Math.min(70, Math.max(0, (Math.min(100, overallSalesRate) / 100) * 70));

        // 2. تقييم الانضباط بناءً على منهجية احتساب نسبة الانضباط الدقيقة:
        // إجمالي أيام السنة = 365 يوماً | العطلات الأسبوعية (الجمعة) = 52 | إجمالي أيام العمل الفعلية = 365 - 52 = 313 يوماً عمل
        // 1. إجمالي أيام عدم التواجد (مجموع كل الأيام: سنوي + عارض + غياب بإذن + مرضي + مصيف + امتحانات + جزاءات)
        const totalAbsenceDays = (leaves.annualUsed || 0) + 
                                 (leaves.casualUsed || 0) + 
                                 (leaves.unpaidUsed || 0) + 
                                 (leaves.sickUsed || 0) + 
                                 (leaves.summerUsed || 0) + 
                                 (leaves.examsUsed || 0) + 
                                 (leaves.penaltiesCount || 0);

        // 2. نسبة الغياب والانقطاع بقسمة إجمالي أيام الغياب على 313 يوماً عمل وضربها في 100
        const workingDaysTotal = 313;
        const absenceRate = (totalAbsenceDays / workingDaysTotal) * 100;

        // 3. نسبة الانضباط النهائية = (100 ناقص نسبة الغياب والانقطاع)
        const disciplineRate = Math.max(0, Math.min(100, Math.round((100 - absenceRate) * 10) / 10));

        // درجة الانضباط (بحد أقصى 30 نقطة من التقييم العام الشامل)
        const disciplineScore = Math.max(0, Math.min(30, Math.round((disciplineRate / 100) * 30 * 10) / 10));

        // 3. التقييم العام الشامل المجمع (من 100%)
        const finalScore = Math.min(100, Math.max(0, Math.round((salesScore + disciplineScore) * 10) / 10));

        // تصنيف الأداء الرسمي المعتمد
        let ratingGrade = 'أداء متميز واستثنائي (ممتاز)';
        let ratingColor = 'text-emerald-400';
        let ratingBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
        if (finalScore >= 90) {
            ratingGrade = 'أداء متميز واستثنائي (ممتاز)';
            ratingColor = 'text-emerald-400';
            ratingBg = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
        } else if (finalScore >= 80) {
            ratingGrade = 'أداء جيد جداً ومحترف';
            ratingColor = 'text-blue-400';
            ratingBg = 'bg-blue-500/20 text-blue-300 border-blue-500/40';
        } else if (finalScore >= 65) {
            ratingGrade = 'أداء جيد ومستقر';
            ratingColor = 'text-amber-400';
            ratingBg = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
        } else if (finalScore >= 50) {
            ratingGrade = 'أداء مقبول (يحتاج متابعة)';
            ratingColor = 'text-orange-400';
            ratingBg = 'bg-orange-500/20 text-orange-300 border-orange-500/40';
        } else {
            ratingGrade = 'أداء ضعيف (يحتاج تطوير عاجل)';
            ratingColor = 'text-red-400';
            ratingBg = 'bg-red-500/20 text-red-300 border-red-500/40';
        }

        return {
            empName,
            monthlyBreakdown,
            evaluatedMonthsCount,
            totalMonthsQueried: endMonth + 1,
            totalAchieved,
            totalTarget,
            overallSalesRate: Math.round(overallSalesRate * 10) / 10,
            salesScore: Math.round(salesScore * 10) / 10,
            disciplineScore,
            disciplineRate,
            totalAbsenceDays,
            absenceRate: Math.round(absenceRate * 10) / 10,
            leaves,
            finalScore,
            ratingGrade,
            ratingColor,
            ratingBg
        };
    };

    // تقرير الأداء المجهز للعرض (يحسب فقط عند فتح شاشة الأداء لتسريع التصفح)
    const performanceReportData = useMemo(() => {
        if (!showPerformanceModal) {
            return {
                isAll: true,
                employeesList: [],
                companyTotalAchieved: 0,
                companyTotalTarget: 0,
                companyOverallSalesRate: 0,
                avgFinalScore: 0,
                companyMonthly: []
            };
        }
        if (perfEmployee === 'all') {
            const list = employeesWithSales.map(emp => computeEmployeeFullPerformance(emp, selectedPerfYear, perfEndMonth));
            const companyTotalAchieved = list.reduce((a, b) => a + b.totalAchieved, 0);
            const companyTotalTarget = list.reduce((a, b) => a + b.totalTarget, 0);
            const companyOverallSalesRate = companyTotalTarget > 0 ? Math.round((companyTotalAchieved / companyTotalTarget) * 1000) / 10 : 0;
            const avgFinalScore = list.length > 0 ? Math.round((list.reduce((a, b) => a + b.finalScore, 0) / list.length) * 10) / 10 : 0;

            const companyMonthly = Array.from({ length: perfEndMonth + 1 }, (_, mIdx) => {
                let mAchieved = 0;
                let mTarget = 0;
                list.forEach(item => {
                    const foundMonth = item.monthlyBreakdown.find(m => m.monthIdx === mIdx);
                    if (foundMonth && foundMonth.hasSales) {
                        mAchieved += foundMonth.achieved || 0;
                        mTarget += foundMonth.target || 0;
                    }
                });
                const hasSales = mAchieved > 0;
                const mRate = mTarget > 0 ? Math.round((mAchieved / mTarget) * 1000) / 10 : (mAchieved > 0 ? 100 : 0);
                return {
                    month: monthNamesAr[mIdx],
                    monthIdx: mIdx,
                    achieved: mAchieved,
                    target: mTarget,
                    rate: mRate,
                    hasSales
                };
            });

            return {
                isAll: true,
                employeesList: list,
                companyTotalAchieved,
                companyTotalTarget,
                companyOverallSalesRate,
                avgFinalScore,
                companyMonthly
            };
        } else {
            const single = computeEmployeeFullPerformance(perfEmployee, selectedPerfYear, perfEndMonth);
            return {
                isAll: false,
                single
            };
        }
    }, [showPerformanceModal, perfEmployee, selectedPerfYear, perfEndMonth, sales, archiveData, targetsList, leaveBalances, leaveHistory, employeesWithSales, usersList]);

    // تصدير الأداء إكسيل
    const handleExportPerformanceExcel = () => {
        const monthLabel = monthNamesAr[perfEndMonth] || '';
        if (performanceReportData.isAll) {
            const rows = (performanceReportData.employeesList || []).map(emp => ({
                "اسم الموظف": emp.empName,
                "إجمالي المبيعات (ج.م)": emp.totalAchieved,
                "إجمالي التارجت (ج.م)": emp.totalTarget,
                "نسبة تحقيق التارجت %": `${emp.overallSalesRate}%`,
                "الأشهر المقيمة": `${emp.evaluatedMonthsCount} من ${emp.totalMonthsQueried}`,
                "رصيد السنوي المتبقي": emp.leaves.annualRemaining,
                "السنوي المستهلك": emp.leaves.annualUsed,
                "العارضة المتبقي": emp.leaves.casualRemaining,
                "العارضة المستهلك": emp.leaves.casualUsed,
                "إجازات الامتحانات": emp.leaves.examsUsed,
                "الجزاءات": emp.leaves.penaltiesCount,
                "التقييم العام النهائي (من 100%)": `${emp.finalScore}%`,
                "التقدير": emp.ratingGrade
            }));
            exportToExcel([{ sheetName: "تقرير أداء الموظفين", data: rows }], `تقرير_الاداء_الشامل_${selectedPerfYear}_حتى_${monthLabel}`);
        } else {
            const single = performanceReportData.single;
            if (!single) return;
            const rows = single.monthlyBreakdown.map(m => ({
                "الشهر": m.month,
                "المبيعات المحققة": m.achieved,
                "تارجت الشهر": m.target,
                "نسبة التحقيق %": m.hasSales ? `${Math.round(m.rate * 10) / 10}%` : 'لم تسجل مبيعات (مستثنى)',
                "الحالة": m.hasSales ? 'مدرج في التقييم' : 'مستثنى'
            }));
            rows.push({
                "الشهر": "الإجمالي والتقييم العام للمبيعات",
                "المبيعات المحققة": single.totalAchieved,
                "تارجت الشهر": single.totalTarget,
                "نسبة التحقيق %": `${single.overallSalesRate}%`,
                "الحالة": `تقييم المبيعات: ${single.salesScore}/70`
            });
            rows.push({
                "الشهر": "التقييم العام النهائي (كام من مائة)",
                "المبيعات المحققة": 0,
                "تارجت الشهر": 0,
                "نسبة التحقيق %": `${single.finalScore}%`,
                "الحالة": `${single.ratingGrade} (انضباط: ${single.disciplineScore}/30)`
            });
            exportToExcel([{ sheetName: `أداء_${single.empName}`, data: rows }], `تقرير_اداء_${single.empName.replace(/\s+/g, '_')}_${selectedPerfYear}_حتى_${monthLabel}`);
        }
    };

    // تصدير الأداء PDF / طباعة في ورقة واحدة متكاملة ومنسقة بدقة
    const handlePrintPerformancePDF = () => {
        const win = window.open('', '_blank');
        if (!win) {
            window.print();
            return;
        }

        const isSingle = !performanceReportData.isAll && performanceReportData.single;
        const single = performanceReportData.single;
        const monthLabel = monthNamesAr[perfEndMonth] || '';
        const todayStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });

        let contentHtml = '';

        if (isSingle && single) {
            // كروت الأشهر ملونة وبجانب بعض
            const monthsCardsHtml = single.monthlyBreakdown.map(m => {
                let cardClass = 'month-card';
                let badgeClass = 'rate-badge';
                let rateText = `${Math.round(m.rate * 10) / 10}%`;

                if (!m.hasSales) {
                    cardClass += ' no-sales';
                    badgeClass += ' gray';
                    rateText = 'لم تسجل مبيعات';
                } else if (m.rate >= 100) {
                    cardClass += ' success';
                    badgeClass += ' green';
                } else if (m.rate >= 80) {
                    cardClass += ' good';
                    badgeClass += ' blue';
                } else {
                    cardClass += ' warning';
                    badgeClass += ' amber';
                }

                return `
                    <div class="${cardClass}">
                        <div class="m-header">
                            <span>${m.month}</span>
                            <span class="${badgeClass}">${rateText}</span>
                        </div>
                        <div class="m-achieved">${(m.achieved || 0).toLocaleString()} <span style="font-size:8.5px;">ج.م</span></div>
                        <div class="m-target">${m.hasSales ? `تارجت: ${(m.target || 0).toLocaleString()} ج.م` : 'مستثنى من الاحتساب'}</div>
                    </div>
                `;
            }).join('');

            contentHtml = `
                <!-- 1. مبيعات الأشهر منفصلة ملونة وبجانب بعض -->
                <div class="section-title">
                    <span>مبيعات الأشهر منفصلة لعام ${selectedPerfYear} (الأشهر النشطة فقط تحتسب في التقييم):</span>
                </div>
                <div class="months-grid">
                    ${monthsCardsHtml}
                </div>

                <!-- 2. استعلام رصيد الإجازات والغياب والجزاءات للموظف في مربعات واضحة بجانب بعض -->
                <div class="section-title">
                    <span>استعلام رصيد الإجازات والغياب والجزاءات للموظف (من سجلات الإجازات):</span>
                </div>
                <div class="leaves-grid" style="grid-template-columns: repeat(${single.leaves.summerUsed > 0 ? 4 : 3}, 1fr);">
                    <div class="leave-box annual">
                        <div class="leave-title" style="color:#15803d;">الإجازات (سنوي وعارض)</div>
                        <div class="leave-main" style="color:#166534;">المستهلك: ${single.leaves.annualUsed + single.leaves.casualUsed} يوم</div>
                        <div class="leave-sub">المتبقي: ${single.leaves.annualRemaining + single.leaves.casualRemaining} يوم</div>
                    </div>
                    ${single.leaves.summerUsed > 0 ? `
                    <div class="leave-box summer" style="background:#f0fdfa; border-color:#5eead4;">
                        <div class="leave-title" style="color:#0f766e;">إجازات المصيف</div>
                        <div class="leave-main" style="color:#115e59;">${single.leaves.summerUsed} يوم</div>
                        <div class="leave-sub">أيام المصيف</div>
                    </div>
                    ` : ''}
                    <div class="leave-box exams">
                        <div class="leave-title" style="color:#7e22ce;">إجازات الامتحانات</div>
                        <div class="leave-main" style="color:#6b21a8;">المستهلك: ${single.leaves.examsUsed} يوم</div>
                        <div class="leave-sub">معتمدة رسمياً</div>
                    </div>
                    <div class="leave-box penalties">
                        <div class="leave-title" style="color:#b91c1c;">الجزاءات والغياب</div>
                        <div class="leave-main" style="color:${single.leaves.penaltiesCount > 0 ? '#b91c1c' : '#1e293b'};">${single.leaves.penaltiesCount} جزاء</div>
                        <div class="leave-sub">غياب بإذن: ${single.leaves.unpaidUsed} يوم</div>
                    </div>
                </div>

                <!-- 3. التقييمات المنفصلة: تقييم المبيعات منفرد + تقييم الانضباط منفرد -->
                <div class="eval-row">
                    <div class="eval-box sales">
                        <div>
                            <div class="eval-title" style="color:#1d4ed8;">تقييم الأداء في المبيعات (منفرد)</div>
                            <div class="eval-desc">
                                إجمالي المبيعات: <strong>${single.totalAchieved.toLocaleString()} ج.م</strong> | التارجت: <strong>${single.totalTarget.toLocaleString()} ج.م</strong>
                            </div>
                            <div class="eval-desc" style="margin-top:2px; color:#2563eb;">
                                الأشهر المقيمة: <strong>${single.evaluatedMonthsCount}</strong> من أصل ${single.totalMonthsQueried} شهر (تم استبعاد أشهر بدون مبيعات).
                            </div>
                        </div>
                        <div style="text-align:left;">
                            <div class="eval-score-num" style="color:#1d4ed8;">${single.overallSalesRate}%</div>
                            <div class="eval-score-label">الدرجة: ${single.salesScore} / 70</div>
                        </div>
                    </div>

                    <div class="eval-box discipline">
                        <div>
                            <div class="eval-title" style="color:#6b21a8;">تقييم الانضباط والغياب والجزاءات (منفرد)</div>
                            <div class="eval-desc">
                                الجزاءات المسجلة: <strong>${single.leaves.penaltiesCount}</strong> | أيام الغياب بإذن: <strong>${single.leaves.unpaidUsed}</strong> يوم
                            </div>
                            <div class="eval-desc" style="margin-top:2px; color:#7e22ce;">
                                معيار الانضباط والالتزام السنوي (313 يوم عمل).
                            </div>
                        </div>
                        <div style="text-align:left;">
                            <div class="eval-score-num" style="color:#6b21a8;">${single.disciplineRate}%</div>
                            <div class="eval-score-label">الدرجة: ${single.disciplineScore} / 30</div>
                        </div>
                    </div>
                </div>

                <!-- 4. التقييم العام الشامل منفرد وبارز -->
                <div class="final-score-card">
                    <div class="final-left">
                        <div class="final-title">التقييم العام الشامل لمعدل الأداء والانضباط (كام من مائة)</div>
                        <div class="final-desc">
                            تقييم احترافي معتمد يجمع بين نسبة تحقيق تارجت المبيعات للأشهر النشطة (70 نقطة) ونسبة الانضباط والالتزام وعدم الجزاءات والاستعلام عن رصيد الإجازات (30 نقطة).
                        </div>
                        <div class="final-grade-badge">
                            ${single.ratingGrade}
                        </div>
                    </div>
                    <div style="text-align:center;">
                        <div class="final-big-num">${single.finalScore}%</div>
                        <div class="final-num-label">الدرجة النهائية من 100</div>
                    </div>
                </div>
            `;
        } else {
            // عرض مجمع لجميع الموظفين في صفحة واحدة منسقة
            const rowsHtml = (performanceReportData.employeesList || []).map(emp => `
                <tr>
                    <td style="font-weight:bold; text-align:right;">${emp.empName}</td>
                    <td>${emp.totalAchieved.toLocaleString()} ج.م</td>
                    <td>${emp.totalTarget.toLocaleString()} ج.م</td>
                    <td><span class="rate-badge ${emp.overallSalesRate >= 100 ? 'green' : emp.overallSalesRate >= 80 ? 'blue' : 'amber'}">${emp.overallSalesRate}%</span></td>
                    <td>${emp.evaluatedMonthsCount} / ${emp.totalMonthsQueried}</td>
                    <td>سنوي: ${emp.leaves.annualUsed} | عارضة: ${emp.leaves.casualUsed}</td>
                    <td style="color:${emp.leaves.penaltiesCount > 0 ? '#dc2626' : '#64748b'}; font-weight:bold;">${emp.leaves.penaltiesCount}</td>
                    <td style="font-weight:900; font-size:12px; color:#059669;">${emp.finalScore}%</td>
                </tr>
            `).join('');

            contentHtml = `
                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px; margin-bottom:8px;">
                    <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:6px; border-radius:6px; text-align:center;">
                        <div style="font-size:9.5px; color:#1d4ed8; font-weight:700;">إجمالي مبيعات الشركة</div>
                        <div style="font-size:13px; font-weight:900;">${(performanceReportData.companyTotalAchieved || 0).toLocaleString()} ج.م</div>
                    </div>
                    <div style="background:#faf5ff; border:1px solid #e9d5ff; padding:6px; border-radius:6px; text-align:center;">
                        <div style="font-size:9.5px; color:#6b21a8; font-weight:700;">إجمالي التارجت</div>
                        <div style="font-size:13px; font-weight:900;">${(performanceReportData.companyTotalTarget || 0).toLocaleString()} ج.م</div>
                    </div>
                    <div style="background:#f0fdf4; border:1px solid #bbf7d0; padding:6px; border-radius:6px; text-align:center;">
                        <div style="font-size:9.5px; color:#15803d; font-weight:700;">نسبة تحقيق التارجت</div>
                        <div style="font-size:13px; font-weight:900; color:#15803d;">${performanceReportData.companyOverallSalesRate}%</div>
                    </div>
                    <div style="background:#ecfdf5; border:1.5px solid #10b981; padding:6px; border-radius:6px; text-align:center;">
                        <div style="font-size:9.5px; color:#047857; font-weight:700;">متوسط التقييم العام</div>
                        <div style="font-size:13px; font-weight:950; color:#047857;">${performanceReportData.avgFinalScore}%</div>
                    </div>
                </div>

                <table style="width:100%; border-collapse:collapse; margin-bottom:8px; font-size:10px;">
                    <thead>
                        <tr style="background:#f1f5f9; color:#334155;">
                            <th style="padding:4px; text-align:right;">اسم الموظف</th>
                            <th style="padding:4px;">المبيعات</th>
                            <th style="padding:4px;">التارجت</th>
                            <th style="padding:4px;">التحقيق %</th>
                            <th style="padding:4px;">الأشهر المقيمة</th>
                            <th style="padding:4px;">الإجازات</th>
                            <th style="padding:4px;">الجزاءات</th>
                            <th style="padding:4px;">التقييم العام</th>
                        </tr>
                    </thead>
                    <tbody style="text-align:center;">
                        ${rowsHtml}
                    </tbody>
                </table>
            `;
        }

        win.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="utf-8"/>
                <title>تقرير تقييم ومعدل الأداء - ${perfEmployee === 'all' ? 'جميع الموظفين' : perfEmployee}</title>
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 6mm 8mm;
                    }
                    @media print {
                        body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                        .no-print { display: none !important; }
                        .page-container { page-break-inside: avoid; }
                    }
                    * { box-sizing: border-box; margin: 0; padding: 0; }
                    body {
                        font-family: system-ui, -apple-system, 'Segoe UI', Tahoma, Arial, sans-serif;
                        direction: rtl;
                        background: #ffffff;
                        color: #0f172a;
                        line-height: 1.25;
                        font-size: 11px;
                        padding: 4px;
                    }
                    .header-box {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        border-bottom: 2px solid #0f172a;
                        padding-bottom: 6px;
                        margin-bottom: 8px;
                    }
                    .company-title {
                        font-size: 15px;
                        font-weight: 900;
                        color: #0f172a;
                    }
                    .report-sub {
                        font-size: 11px;
                        font-weight: 700;
                        color: #059669;
                    }
                    .meta-badges {
                        display: flex;
                        gap: 6px;
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        padding: 4px 8px;
                        border-radius: 6px;
                        font-size: 10px;
                    }
                    .meta-item strong { color: #0f172a; }

                    .section-title {
                        font-size: 10.5px;
                        font-weight: 800;
                        color: #1e293b;
                        margin-bottom: 4px;
                    }

                    /* 1. مبيعات الأشهر ملونة وبجانب بعض */
                    .months-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 5px;
                        margin-bottom: 8px;
                    }
                    .month-card {
                        border: 1px solid #cbd5e1;
                        border-radius: 6px;
                        padding: 5px 6px;
                        background: #f8fafc;
                    }
                    .month-card.success { background: #f0fdf4; border-color: #86efac; }
                    .month-card.good { background: #eff6ff; border-color: #93c5fd; }
                    .month-card.warning { background: #fffbeb; border-color: #fde047; }
                    .month-card.no-sales { background: #f1f5f9; border-color: #cbd5e1; opacity: 0.75; }

                    .m-header {
                        display: flex;
                        justify-content: space-between;
                        font-size: 10px;
                        font-weight: 700;
                        margin-bottom: 2px;
                    }
                    .m-achieved {
                        font-size: 12px;
                        font-weight: 900;
                        color: #0f172a;
                    }
                    .m-target {
                        font-size: 9px;
                        color: #64748b;
                    }
                    .rate-badge {
                        font-size: 9px;
                        font-weight: 800;
                        padding: 1px 4px;
                        border-radius: 4px;
                        display: inline-block;
                    }
                    .rate-badge.green { background: #dcfce7; color: #15803d; }
                    .rate-badge.blue { background: #dbeafe; color: #1d4ed8; }
                    .rate-badge.amber { background: #fef3c7; color: #b45309; }
                    .rate-badge.gray { background: #e2e8f0; color: #475569; }

                    /* 2. استعلام رصيد الإجازات والغياب والجزاءات للموظف */
                    .leaves-grid {
                        display: grid;
                        grid-template-columns: repeat(4, 1fr);
                        gap: 5px;
                        margin-bottom: 8px;
                    }
                    .leave-box {
                        border: 1.5px solid #cbd5e1;
                        border-radius: 6px;
                        padding: 5px 6px;
                        text-align: center;
                    }
                    .leave-box.annual { background: #f0fdf4; border-color: #86efac; }
                    .leave-box.casual { background: #fffbeb; border-color: #fde047; }
                    .leave-box.exams { background: #faf5ff; border-color: #d8b4fe; }
                    .leave-box.penalties { background: #fef2f2; border-color: #fca5a5; }
                    .leave-title { font-size: 10px; font-weight: 800; margin-bottom: 2px; }
                    .leave-main { font-size: 11.5px; font-weight: 900; }
                    .leave-sub { font-size: 9px; color: #475569; }

                    /* 3. التقييمات المنفصلة */
                    .eval-row {
                        display: grid;
                        grid-template-columns: 1fr 1fr;
                        gap: 6px;
                        margin-bottom: 8px;
                    }
                    .eval-box {
                        border: 1.5px solid #cbd5e1;
                        border-radius: 6px;
                        padding: 6px 8px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .eval-box.sales { background: #eff6ff; border-color: #93c5fd; }
                    .eval-box.discipline { background: #faf5ff; border-color: #d8b4fe; }
                    .eval-title { font-size: 10.5px; font-weight: 800; margin-bottom: 2px; }
                    .eval-desc { font-size: 9px; color: #475569; }
                    .eval-score-num { font-size: 18px; font-weight: 900; }
                    .eval-score-label { font-size: 8.5px; font-weight: 700; color: #64748b; }

                    /* التقييم العام الشامل منفرد وبارز */
                    .final-score-card {
                        background: #ecfdf5;
                        border: 2px solid #10b981;
                        border-radius: 8px;
                        padding: 7px 10px;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        margin-bottom: 8px;
                    }
                    .final-left { text-align: right; }
                    .final-title { font-size: 11.5px; font-weight: 900; color: #065f46; }
                    .final-desc { font-size: 9px; color: #047857; max-width: 440px; margin-top: 1px; }
                    .final-grade-badge {
                        display: inline-block;
                        margin-top: 3px;
                        background: #10b981;
                        color: #fff;
                        padding: 2px 7px;
                        border-radius: 999px;
                        font-size: 9.5px;
                        font-weight: 800;
                    }
                    .final-big-num { font-size: 26px; font-weight: 950; color: #047857; line-height: 1; }
                    .final-num-label { font-size: 9px; font-weight: 700; color: #059669; text-align: center; }

                    .signatures {
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 8px;
                        border-top: 1px dashed #cbd5e1;
                        padding-top: 6px;
                        font-size: 9.5px;
                        color: #334155;
                        text-align: center;
                    }
                    .sign-title { font-weight: 700; margin-bottom: 14px; }
                    .sign-line { border-bottom: 1px dotted #94a3b8; width: 75%; margin: 0 auto; }
                    table, th, td { border: 1px solid #cbd5e1; }
                </style>
            </head>
            <body>
                <div class="header-box">
                    <div>
                        <div class="company-title">شركة سوفت روز للتجارة الحديثة</div>
                        <div class="report-sub">تقرير تقييم ومعدل الأداء والمبيعات المعتمد</div>
                    </div>
                    <div class="meta-badges">
                        <div class="meta-item">الموظف: <strong>${perfEmployee === 'all' ? 'جميع الموظفين' : perfEmployee}</strong></div>
                        <div class="meta-item">الفترة: <strong>من 1/1/${selectedPerfYear} حتى نهاية شهر ${monthLabel}</strong></div>
                        <div class="meta-item">تاريخ الإصدار: <strong>${todayStr}</strong></div>
                    </div>
                </div>

                ${contentHtml}

                <div class="signatures">
                    <div>
                        <div class="sign-title">توقيع الموظف</div>
                        <div class="sign-line"></div>
                    </div>
                    <div>
                        <div class="sign-title">إدارة المبيعات</div>
                        <div class="sign-line"></div>
                    </div>
                    <div>
                        <div class="sign-title">الموارد البشرية والاعتماد</div>
                        <div class="sign-line"></div>
                    </div>
                </div>
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => {
            win.print();
            win.close();
        }, 350);
    };

    // تصدير الشاشة كاملة كصورة عالية الدقة بجميع الحواف والتفاصيل مع دعم اختيار الجودة
    const handleExportPerformanceImage = async (quality: 'ultra' | 'normal' = 'ultra') => {
        const captureArea = document.getElementById('performance-modal-capture-area');
        const scrollArea = document.getElementById('performance-scroll-area');
        if (!captureArea) return;

        setPerfImageQualityLoading(quality);
        setIsExportingPerfImage(true);
        try {
            const origScrollOverflow = scrollArea?.style.overflow || '';
            const origScrollMaxH = scrollArea?.style.maxHeight || '';
            const origCaptureMaxH = captureArea.style.maxHeight || '';
            const origCaptureOverflow = captureArea.style.overflow || '';

            if (scrollArea) {
                scrollArea.style.overflow = 'visible';
                scrollArea.style.maxHeight = 'none';
            }
            captureArea.style.maxHeight = 'none';
            captureArea.style.overflow = 'visible';

            // مهلة قصيرة لإعادة ضبط أبعاد الشاشة
            await new Promise(r => setTimeout(r, 120));

            // scale: 3 لأعلى جودة ممكنة، أو 1.5 لجودة مناسبة للهاتف
            const chosenScale = quality === 'ultra' ? 3 : 1.5;

            const canvas = await html2canvas(captureArea, {
                backgroundColor: '#111827',
                scale: chosenScale,
                useCORS: true,
                logging: false,
                windowWidth: 1200,
                ignoreElements: (element) => element.getAttribute('data-html2canvas-ignore') === 'true',
                onclone: (clonedDoc) => {
                    const el = clonedDoc.getElementById('performance-modal-capture-area');
                    if (el) {
                        el.style.letterSpacing = 'normal';
                        const allElems = el.querySelectorAll('*');
                        allElems.forEach((node: any) => {
                            if (node && node.style) {
                                node.style.letterSpacing = 'normal';
                            }
                        });
                    }
                }
            });

            if (scrollArea) {
                scrollArea.style.overflow = origScrollOverflow;
                scrollArea.style.maxHeight = origScrollMaxH;
            }
            captureArea.style.maxHeight = origCaptureMaxH;
            captureArea.style.overflow = origCaptureOverflow;

            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    const empClean = perfEmployee === 'all' ? 'جميع_الموظفين' : perfEmployee.replace(/\s+/g, '_');
                    const monthClean = monthNamesAr[perfEndMonth]?.split(' ')[0] || '';
                    const qualityTag = quality === 'ultra' ? 'عالي_الجودة_HD' : 'جودة_للهاتف';
                    link.download = `تقرير_معدل_الاداء_${empClean}_${selectedPerfYear}_حتى_${monthClean}_${qualityTag}.png`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 250);
                    setShowPerfImageQualityModal(false);
                }
            }, 'image/png', quality === 'ultra' ? 1.0 : 0.85);
        } catch (err) {
            console.error("Error exporting performance image:", err);
            alert("حدث خطأ أثناء استخراج الصورة، يرجى المحاولة مرة أخرى");
        } finally {
            setIsExportingPerfImage(false);
            setPerfImageQualityLoading(null);
        }
    };


    const isAnySalesModalOpen = Boolean(
        editingSale ||
        showTargetModal ||
        showArchiveModal ||
        showProductSalesModal ||
        showProductSalesDataModal ||
        showExportModal ||
        showCurrentTargetsModal ||
        showPastTargetsModal ||
        showFaqdModal ||
        showPerformanceModal
    );

    return (
        <>
        <div className={isAnySalesModalOpen ? 'hidden' : 'space-y-6'}>
            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 relative z-40">
                <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2 text-white shrink-0"><FileSpreadsheet /> سجل المبيعات</h2>
                {user.role === 'admin' && (
                    <div className="grid grid-cols-3 gap-1.5 sm:flex sm:items-center sm:gap-2 w-full sm:w-auto">
                        <button 
                            onClick={handleExportFilteredExcel}
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white px-1.5 sm:px-4 py-2 sm:py-2.5 rounded-xl flex items-center justify-center gap-1 font-bold shadow-lg transition active:scale-95 text-[11px] sm:text-sm cursor-pointer whitespace-nowrap min-w-0"
                            title="تصدير النتائج المعروضة إلى إكسيل"
                        >
                            <FileSpreadsheet size={15} className="shrink-0" /> 
                            <span>إكسيل</span>
                        </button>

                        {/* زر فقد */}
                        <div className="relative w-full sm:w-auto" ref={faqdDropdownRef}>
                            <button 
                                onClick={() => {
                                    setShowFaqdDropdown(!showFaqdDropdown);
                                    setShowTargetDropdown(false);
                                }} 
                                className="w-full bg-amber-600 hover:bg-amber-500 text-white px-1.5 sm:px-4 py-2 sm:py-2.5 rounded-xl flex items-center justify-center gap-1 font-bold shadow-lg transition active:scale-95 text-[11px] sm:text-sm whitespace-nowrap min-w-0 cursor-pointer"
                                title="تقرير الفقد"
                            >
                                <Activity size={15} className="shrink-0" /> 
                                <span>فقد</span> 
                                <ChevronDown size={13} className={`transition-transform duration-200 shrink-0 ${showFaqdDropdown ? 'rotate-180' : ''}`}/>
                            </button>
                            {showFaqdDropdown && (
                                <div className="absolute right-0 sm:left-auto mt-2 w-44 bg-gray-900 border border-white/20 rounded-2xl shadow-2xl z-[100] py-1.5 overflow-hidden" style={{ backgroundColor: '#0f172a' }}>
                                    <button 
                                        onClick={() => { 
                                            setShowFaqdDropdown(false); 
                                            setFaqdExportTarget('pdf');
                                            setShowFaqdModal(true); 
                                        }}
                                        className="w-full text-right px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-rose-600/30 flex items-center gap-2 transition cursor-pointer"
                                    >
                                        <FileDown size={16} className="text-rose-400 shrink-0"/> 
                                        <span>تصدير PDF</span>
                                    </button>
                                    <button 
                                        onClick={() => { 
                                            setShowFaqdDropdown(false); 
                                            setFaqdExportTarget('excel');
                                            setShowFaqdModal(true); 
                                        }}
                                        className="w-full text-right px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-emerald-600/30 flex items-center gap-2 transition cursor-pointer border-t border-white/5"
                                    >
                                        <FileSpreadsheet size={16} className="text-emerald-400 shrink-0"/> 
                                        <span>تصدير إكسيل</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* زر خاص بالتارجت */}
                        <div className="relative w-full sm:w-auto" ref={targetDropdownRef}>
                            <button 
                                onClick={() => {
                                    setShowTargetDropdown(!showTargetDropdown);
                                    setShowFaqdDropdown(false);
                                }} 
                                className="w-full bg-purple-600 hover:bg-purple-700 text-white px-1.5 sm:px-4 py-2 sm:py-2.5 rounded-xl flex items-center justify-center gap-1 font-bold shadow-lg transition active:scale-95 text-[11px] sm:text-sm whitespace-nowrap min-w-0 cursor-pointer"
                            >
                                <Target size={15} className="shrink-0" /> 
                                <span className="truncate">التارجت</span> 
                                <ChevronDown size={13} className={`transition-transform duration-200 shrink-0 ${showTargetDropdown ? 'rotate-180' : ''}`}/>
                            </button>
                            {showTargetDropdown && (
                                <div className="absolute left-0 mt-2 w-48 bg-gray-900 border border-white/20 rounded-2xl shadow-2xl z-[100] py-2 overflow-hidden" style={{ backgroundColor: '#0f172a' }}>
                                    <button 
                                        onClick={() => { setShowTargetDropdown(false); setShowProductSalesModal(true); }}
                                        className="w-full text-right px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-600/30 flex items-center gap-2 transition"
                                    >
                                        <Package size={16} className="text-blue-400"/> مبيعات صنف
                                    </button>
                                    <button 
                                        onClick={() => { setShowTargetDropdown(false); setShowPerformanceModal(true); }}
                                        className="w-full text-right px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-600/30 flex items-center gap-2 transition cursor-pointer"
                                    >
                                        <TrendingUp size={16} className="text-emerald-400"/> الأداء
                                    </button>
                                    <button 
                                        onClick={() => { setShowTargetDropdown(false); setShowTargetModal(true); }}
                                        className="w-full text-right px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-600/30 flex items-center gap-2 transition"
                                    >
                                        <Target size={16} className="text-purple-400"/> إدارة التارجت
                                    </button>
                                    <button 
                                        onClick={() => { setShowTargetDropdown(false); setShowCurrentTargetsModal(true); }}
                                        className="w-full text-right px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600/30 flex items-center gap-2 transition"
                                    >
                                        <Trophy size={16} className="text-orange-400"/> تارجت الشهر
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
            
            {user.role === 'admin' && selectedSalesIds.length > 0 && (
                <div className="flex flex-col md:flex-row gap-3 animate-in fade-in slide-in-from-top-2">
                    <button onClick={() => setShowExportModal(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition active:scale-95"><Filter size={18}/> تصدير فترة معينة ({selectedSalesIds.length})</button>
                    <button onClick={handleExportCurrent} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition active:scale-95"><Download size={18}/> تصدير السجل الحالي ({selectedSalesIds.length})</button>
                </div>
            )}

            {!isAnySalesModalOpen && stars && stars.first && (
                <div className="star-of-month-gray bg-gray-800 p-6 rounded-3xl border border-white/20 shadow-2xl relative overflow-hidden" style={{ backgroundColor: '#374151' }}>
                    <div className="text-center mb-6">
                        <Trophy className="text-yellow-400 mx-auto mb-2" size={40} />
                        <h3 className="text-xl font-black text-white uppercase tracking-widest">نجوم الشهر الحالي</h3>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2 sm:gap-6 w-full max-w-2xl mx-auto">
                        {/* المركز الأول */}
                        <div className="flex flex-col items-center bg-gray-900 p-2.5 sm:p-4 rounded-2xl border border-yellow-400/50 min-w-0 text-center" style={{ backgroundColor: '#1f2937' }}>
                            <div className="text-yellow-400 text-xs sm:text-sm font-black mb-1">المركز الأول</div>
                            <div className="text-sm sm:text-2xl font-black text-white truncate max-w-full">{stars.first.name}</div>
                            <div className="text-[10px] sm:text-sm font-bold text-white mt-1 sm:mt-2">مبيعات: <span className="text-green-300 font-black">{(Number(stars.first.total) || 0).toLocaleString()} ج.م</span></div>
                        </div>

                        {/* المركز الثاني */}
                        {stars.second ? (
                            <div className="flex flex-col items-center bg-gray-900 p-2.5 sm:p-4 rounded-2xl border border-gray-400/50 min-w-0 text-center" style={{ backgroundColor: '#111827' }}>
                                <div className="text-gray-300 text-xs sm:text-sm font-black mb-1">المركز الثاني</div>
                                <div className="text-xs sm:text-xl font-black text-white truncate max-w-full">{stars.second.name}</div>
                                <div className="text-[10px] sm:text-sm font-bold text-white mt-1 sm:mt-2">مبيعات: <span className="text-green-300 font-black">{(Number(stars.second.total) || 0).toLocaleString()} ج.م</span></div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center bg-gray-900 p-2.5 sm:p-4 rounded-2xl border border-white/10 min-w-0 text-center text-xs font-bold text-gray-400" style={{ backgroundColor: '#111827' }}>
                                المركز الثاني شاغر
                            </div>
                        )}
                    </div>
                </div>
            )}

            
            <div className="bg-gray-800/80 p-3 sm:p-4 rounded-2xl border border-white/10 shadow-lg space-y-2 w-full min-w-0 overflow-hidden">
                <div className={`grid grid-cols-1 ${user.role === 'admin' ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'} gap-2 sm:gap-3 w-full min-w-0`}>
                    {/* خانة من يوم وإلى يوم في سطر واحد تماماً مع مراعاة عدم وجود مسطرة تحريك يمين أو يسار */}
                    <div className={`${user.role === 'admin' ? 'lg:col-span-2' : 'col-span-1 sm:col-span-2'} grid grid-cols-2 gap-2 w-full min-w-0`}>
                        <div className="flex flex-col gap-1 min-w-0">
                            <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1 truncate">
                                <Calendar size={13} className="text-blue-400 shrink-0" />
                                <span>من يوم:</span>
                            </label>
                            <input 
                                type="date" 
                                className="p-2 sm:p-2.5 rounded-xl bg-gray-700 text-white border border-white/20 text-xs font-bold outline-none focus:border-blue-500 w-full min-w-0" 
                                value={filterDate} 
                                onChange={e => setFilterDate(e.target.value)} 
                                title="تحديد تاريخ البداية (من يوم)"
                            />
                        </div>
                        <div className="flex flex-col gap-1 min-w-0">
                            <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1 truncate">
                                <Calendar size={13} className="text-blue-400 shrink-0" />
                                <span>إلى يوم:</span>
                            </label>
                            <input 
                                type="date" 
                                className="p-2 sm:p-2.5 rounded-xl bg-gray-700 text-white border border-white/20 text-xs font-bold outline-none focus:border-blue-500 w-full min-w-0" 
                                value={filterEndDate} 
                                onChange={e => setFilterEndDate(e.target.value)} 
                                title="تحديد تاريخ النهاية (إلى يوم)"
                            />
                        </div>
                    </div>
                    {user.role === 'admin' ? (
                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1">
                                <UserIcon size={13} className="text-purple-400 shrink-0" />
                                <span>الموظف:</span>
                            </label>
                            <select 
                                className="p-2 sm:p-2.5 rounded-xl bg-gray-700 text-white border border-white/10 text-xs font-bold outline-none focus:border-blue-500 w-full"
                                value={filterEmployee} 
                                onChange={e => setFilterEmployee(e.target.value)}
                            >
                                <option value="">كل الموظفين</option>
                                {employeesWithSales.map(name => (
                                    <option key={name} value={name}>{name}</option>
                                ))}
                            </select>
                        </div>
                    ) : null}
                    {user.role === 'admin' ? (
                        <div className="flex flex-col gap-1">
                            <label className="text-[11px] font-bold text-gray-300 flex items-center gap-1">
                                <ShoppingBag size={13} className="text-emerald-400 shrink-0" />
                                <span>الماركت / الفرع:</span>
                            </label>
                            <select 
                                className="p-2 sm:p-2.5 rounded-xl bg-gray-700 text-white border border-white/20 text-xs font-bold outline-none focus:border-blue-500 w-full" 
                                value={filterMarket} 
                                onChange={e => setFilterMarket(e.target.value)}
                            >
                                <option value="">كل الماركتات</option>
                                {allAvailableFilterMarkets.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>
                    ) : null}
                </div>

                {(filterDate || filterEndDate || filterEmployee || filterMarket) && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-blue-300 bg-blue-950/40 border border-blue-500/20 px-3 py-2 rounded-xl mt-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-white">النتيجة:</span>
                            <span className="font-semibold">{filteredSales.length} عملية بيع</span>
                            {(filterDate || filterEndDate) && (
                                <span className="text-blue-200 bg-blue-900/60 px-2 py-0.5 rounded-lg text-[11px] font-mono">
                                    {filterDate && filterEndDate 
                                        ? `الفترة: من ${filterDate} إلى ${filterEndDate}`
                                        : filterDate 
                                            ? `يوم: ${filterDate}`
                                            : `حتى يوم: ${filterEndDate}`
                                    }
                                </span>
                            )}
                            {filterEmployee && (
                                <span className="text-purple-200 bg-purple-900/50 px-2 py-0.5 rounded-lg text-[11px]">
                                    الموظف: {filterEmployee}
                                </span>
                            )}
                            {filterMarket && (
                                <span className="text-emerald-200 bg-emerald-900/50 px-2 py-0.5 rounded-lg text-[11px]">
                                    الفرع: {filterMarket}
                                </span>
                            )}
                        </div>
                        <button 
                            type="button"
                            onClick={() => {
                                setFilterDate('');
                                setFilterEndDate('');
                                setFilterEmployee('');
                                setFilterMarket('');
                            }}
                            className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1 transition cursor-pointer text-xs"
                        >
                            <X size={14} /> مسح الفلتر
                        </button>
                    </div>
                )}
            </div>
            
            {user.role === 'admin' && (
                <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-800 p-4 rounded-2xl border border-white/10 shadow-lg">
                    <div className="flex items-center gap-2">
                        <input type="checkbox" id="selectAll" className="w-5 h-5 accent-blue-500 rounded cursor-pointer" 
                               checked={filteredSales.length > 0 && selectedSalesIds.length === filteredSales.length}
                               onChange={e => {
                                   if (e.target.checked) setSelectedSalesIds(filteredSales.map(s => s.id));
                                   else setSelectedSalesIds([]);
                               }} />
                        <label htmlFor="selectAll" className="text-white font-bold cursor-pointer">تحديد الكل ({filteredSales.length})</label>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button 
                            onClick={handleExportFilteredExcel}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 sm:px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition text-xs shadow-xl active:scale-95 cursor-pointer whitespace-nowrap"
                            title="تصدير النتائج المعروضة إلى ملف إكسيل"
                        >
                            <FileSpreadsheet size={15} className="shrink-0" /> 
                            <span>إكسيل</span>
                        </button>
                        {selectedSalesIds.length > 0 && (
                            <>
                                <button onClick={() => handleShareSales(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-3 sm:px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition text-xs shadow-xl active:scale-95 cursor-pointer"><FileDown size={14}/> تصدير PDF</button>
                                <button onClick={() => handleShareSales(false)} className="bg-green-600 hover:bg-green-500 text-white px-3 sm:px-4 py-2 rounded-xl font-bold flex items-center gap-1.5 transition text-xs shadow-xl active:scale-95 cursor-pointer"><Download size={14}/> تحميل للهاتف</button>
                            </>
                        )}
                    </div>
                </div>
            )}
            <div className="space-y-4">
                {filteredSales.slice(0, visibleCount).map(sale => {
                    const isHighlighted = highlightSaleId === sale.id;
                    return (
                    <div 
                        key={sale.id} 
                        id={`sale-${sale.id}`}
                        className={`p-5 rounded-3xl transition-all duration-300 shadow-2xl ${
                            isHighlighted 
                                ? 'border-2 border-blue-500 bg-blue-950/40 ring-4 ring-blue-500/40 shadow-blue-500/30 hover:border-white hover:shadow-[0_0_25px_rgba(255,255,255,0.5)]' 
                                : 'border border-white/10 bg-gray-800 hover:border-white hover:shadow-[0_0_20px_rgba(255,255,255,0.4),0_0_35px_rgba(59,130,246,0.25)]'
                        }`}
                    >
                        {/* Mobile Header (block sm:hidden): اسم الفرع بسطر واسفله الاسم الانجليزي واليوم والتاريخ والساعة */}
                        <div className="block sm:hidden">
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {user.role === 'admin' && (
                                        <input type="checkbox" className="w-4 h-4 accent-blue-500 rounded cursor-pointer shrink-0"
                                               checked={selectedSalesIds.includes(sale.id)} 
                                               onChange={e => {
                                                   if (e.target.checked) setSelectedSalesIds(prev => [...prev, sale.id]);
                                                   else setSelectedSalesIds(prev => prev.filter(id => id !== sale.id));
                                               }} />
                                    )}
                                    <div className="font-bold text-base text-blue-400 truncate">{sale.market || resolveMarketForSale(sale)}</div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => handleReaction(sale.id, 'like')} className={`p-1.5 rounded-lg ${(Array.isArray(sale.likes) ? sale.likes : (sale.likes ? Object.values(sale.likes) : [])).includes(user.username || user.name) ? 'bg-blue-600/30 text-blue-400' : 'bg-white/10 text-white/60'} hover:bg-blue-600/50 transition`}>
                                        <ThumbsUp size={14} /> <span className="text-[10px]">{(Array.isArray(sale.likes) ? sale.likes : (sale.likes ? Object.values(sale.likes) : [])).length}</span>
                                    </button>
                                    <button onClick={() => handleReaction(sale.id, 'dislike')} className={`p-1.5 rounded-lg ${(Array.isArray(sale.dislikes) ? sale.dislikes : (sale.dislikes ? Object.values(sale.dislikes) : [])).includes(user.username || user.name) ? 'bg-red-600/30 text-red-400' : 'bg-white/10 text-white/60'} hover:bg-red-600/50 transition`}>
                                        <ThumbsDown size={14} /> <span className="text-[10px]">{(Array.isArray(sale.dislikes) ? sale.dislikes : (sale.dislikes ? Object.values(sale.dislikes) : [])).length}</span>
                                    </button>
                                    <button onClick={() => setShowCommentInput(prev => ({ ...prev, [sale.id]: !prev[sale.id] }))} className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition flex items-center gap-1">
                                        <MessageSquare size={14} /> <span className="text-[10px]">{(Array.isArray(sale.comments) ? sale.comments : (sale.comments ? Object.values(sale.comments) : [])).length}</span>
                                    </button>
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-white mb-3">
                                <span className="flex items-center gap-1 text-blue-300 font-bold">
                                    <UserIcon size={12} className="text-blue-400 shrink-0" />
                                    <span>{getEmployeeEnglishName(sale)}</span>
                                </span>
                                <span className="text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded border border-amber-500/20">
                                    {sale.timestamp ? new Date(sale.timestamp).toLocaleDateString('ar-EG', { weekday: 'long' }) : ''}
                                </span>
                                <span className="flex items-center gap-1 font-mono text-gray-300">
                                    <Calendar size={11} className="text-gray-400 shrink-0" />
                                    <span>{sale.date}</span>
                                </span>
                                {sale.timestamp && (
                                    <span className="flex items-center gap-1 text-cyan-300 font-mono bg-cyan-500/15 px-1.5 py-0.5 rounded border border-cyan-500/30">
                                        <Clock size={11} className="text-cyan-400 shrink-0" />
                                        <span>{new Date(sale.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Desktop Header (hidden sm:flex) */}
                        <div className="hidden sm:flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-3">
                                    {user.role === 'admin' && (
                                        <input type="checkbox" className="w-5 h-5 accent-blue-500 rounded cursor-pointer"
                                               checked={selectedSalesIds.includes(sale.id)} 
                                               onChange={e => {
                                                   if (e.target.checked) setSelectedSalesIds(prev => [...prev, sale.id]);
                                                   else setSelectedSalesIds(prev => prev.filter(id => id !== sale.id));
                                               }} />
                                    )}
                                    <div className="font-bold text-xl text-blue-400">{sale.market || resolveMarketForSale(sale)}</div>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] opacity-75 font-bold mt-1 text-white">
                                    <span className="flex items-center gap-1"><Calendar size={12}/> {sale.timestamp ? new Date(sale.timestamp).toLocaleDateString('ar-EG', { weekday: 'long' }) : ''} - {sale.date}</span>
                                    {sale.timestamp && (
                                        <span className="flex items-center gap-1 text-cyan-300 font-bold bg-cyan-500/15 px-1.5 py-0.5 rounded-lg border border-cyan-500/30 shadow-sm" title="الساعة التي تم تسجيل المبيعات بها">
                                            <Clock size={11} className="text-cyan-400 shrink-0" />
                                            <span>{new Date(sale.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                        </span>
                                    )}
                                    <span className="flex items-center gap-1"><UserIcon size={12}/> {sale.employeeName}</span>
                                    <span className="bg-white/10 px-2 py-0.5 rounded text-[9px] uppercase">{(sale as any).username || "System"}</span>
                                </div>
                            </div>
                            
                            <div className="flex gap-2">
                                <button onClick={() => handleReaction(sale.id, 'like')} className={`p-1.5 rounded-lg ${(Array.isArray(sale.likes) ? sale.likes : (sale.likes ? Object.values(sale.likes) : [])).includes(user.username || user.name) ? 'bg-blue-600/30 text-blue-400' : 'bg-white/10 text-white/60'} hover:bg-blue-600/50 transition`}>
                                    <ThumbsUp size={16} /> <span className="text-[10px]">{(Array.isArray(sale.likes) ? sale.likes : (sale.likes ? Object.values(sale.likes) : [])).length}</span>
                                </button>
                                <button onClick={() => handleReaction(sale.id, 'dislike')} className={`p-1.5 rounded-lg ${(Array.isArray(sale.dislikes) ? sale.dislikes : (sale.dislikes ? Object.values(sale.dislikes) : [])).includes(user.username || user.name) ? 'bg-red-600/30 text-red-400' : 'bg-white/10 text-white/60'} hover:bg-red-600/50 transition`}>
                                    <ThumbsDown size={16} /> <span className="text-[10px]">{(Array.isArray(sale.dislikes) ? sale.dislikes : (sale.dislikes ? Object.values(sale.dislikes) : [])).length}</span>
                                </button>
                                <button onClick={() => setShowCommentInput(prev => ({ ...prev, [sale.id]: !prev[sale.id] }))} className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:bg-white/20 transition flex items-center gap-1">
                                    <MessageSquare size={16} /> <span className="text-[10px]">{(Array.isArray(sale.comments) ? sale.comments : (sale.comments ? Object.values(sale.comments) : [])).length}</span>
                                </button>
                            </div>

                        </div>
                        <div className="overflow-hidden rounded-2xl bg-black/20 border border-white/5">
                            <table className="w-full text-[11px] text-center">
                                <thead className="bg-white/5 text-white/50">
                                    <tr><th className="py-2 px-3 text-right text-white">الصنف</th><th className="py-2 text-white">السعر</th><th className="py-2 text-white">الكمية</th><th className="py-2 px-3 text-white">المجموع</th></tr>
                                </thead>
                                <tbody>
                                    {(sale.items || []).map((item, idx) => (
                                        <tr key={`item-${sale.id || 'sale'}-${idx}`} className="border-t border-white/5 text-white"><td className="py-2 px-3 text-right font-bold">{item.name}</td><td className="py-2">{item.price}</td><td className="py-2 font-black">{item.qty}</td><td className="py-2 px-3 text-green-400 font-black">{((Number(item.qty) || 0) * (Number(item.price) || 0)).toLocaleString()}</td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center text-white">
                            <div className="flex flex-col">
                                <span className="text-xs font-bold opacity-60 uppercase tracking-tighter">إجمالي المبيعات:</span>
                                <span className="text-xl font-black text-blue-400">{(Number(sale.total) || 0).toLocaleString()} ج.م</span>
                            </div>
                            {user.role === 'admin' && (
                                <div className="flex gap-2">
                                    <button onClick={() => setEditingSale(sale)} className="bg-indigo-600/20 text-indigo-400 p-2.5 rounded-xl border border-indigo-500/30 hover:bg-indigo-600 hover:text-white transition shadow-lg flex items-center gap-2 text-xs font-bold">
                                        <Edit size={16}/> تعديل
                                    </button>
                                    <button onClick={() => { if(confirm("هل أنت متأكد من حذف هذه العملية؟")) remove(ref(db, `sales/${sale.id!}`)); }} className="bg-red-600/20 text-red-500 p-2.5 rounded-xl border border-red-500/30 hover:bg-red-600 hover:text-white transition shadow-lg flex items-center gap-2 text-xs font-bold">
                                        <Trash2 size={16}/> حذف
                                    </button>
                                </div>
                            )}
                        </div>
                        
                        {(showCommentInput[sale.id] || ((Array.isArray(sale.comments) ? sale.comments : (sale.comments ? Object.values(sale.comments) : [])).length > 0)) && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                                <div className="space-y-3 mb-4">
                                    {(Array.isArray(sale.comments) ? sale.comments : (sale.comments ? Object.values(sale.comments) : [])).map((comment, cIdx) => {
                                        const cKey = comment.id || `comment-${sale.id}-${cIdx}`;
                                        const isEditingThis = editingCommentId[sale.id] === cKey;

                                        return (
                                            <div key={cKey} className="bg-white/5 rounded-xl p-3 flex flex-col gap-2 border border-white/5 hover:border-white/10 transition">
                                                <div className="flex justify-between items-start">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-bold text-blue-300 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                                                            {comment.senderName}
                                                        </span>
                                                        <span className="text-[9px] opacity-50 text-gray-300">
                                                            {comment.timestamp ? new Date(comment.timestamp).toLocaleString('ar-EG') : ''}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button 
                                                            title="إعجاب" 
                                                            onClick={() => handleLikeComment(sale.id, comment.id || `${cIdx}`)} 
                                                            className={`p-1.5 rounded-lg ${comment.isLiked ? 'text-red-500 bg-red-500/10' : 'text-white/40 hover:text-white/80 hover:bg-white/10'} transition`}
                                                        >
                                                            <Heart size={14} fill={comment.isLiked ? 'currentColor' : 'none'} />
                                                        </button>
                                                        <button 
                                                            title="تعديل التعليق" 
                                                            onClick={() => {
                                                                setEditingCommentId(prev => ({ ...prev, [sale.id]: isEditingThis ? null : cKey }));
                                                                setEditingCommentText(prev => ({ ...prev, [cKey]: comment.text }));
                                                            }} 
                                                            className={`p-1.5 rounded-lg transition ${isEditingThis ? 'text-indigo-400 bg-indigo-500/20' : 'text-white/40 hover:text-indigo-400 hover:bg-indigo-500/10'}`}
                                                        >
                                                            <Edit size={14} />
                                                        </button>
                                                        <button 
                                                            title="حذف التعليق" 
                                                            onClick={() => handleDeleteComment(sale.id, comment.id || `${cIdx}`)} 
                                                            className="p-1.5 rounded-lg text-white/40 hover:text-red-400 hover:bg-red-500/10 transition"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {isEditingThis ? (
                                                    <div className="mt-1 space-y-2">
                                                        <textarea 
                                                            value={editingCommentText[cKey] ?? comment.text}
                                                            onChange={e => setEditingCommentText(prev => ({ ...prev, [cKey]: e.target.value.substring(0, 1000) }))}
                                                            className="w-full bg-black/40 border border-indigo-500/40 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-indigo-400 min-h-[50px] max-h-[100px]"
                                                            maxLength={1000}
                                                        />
                                                        <div className="flex justify-end gap-2">
                                                            <button 
                                                                onClick={() => setEditingCommentId(prev => ({ ...prev, [sale.id]: null }))}
                                                                className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition"
                                                            >
                                                                إلغاء
                                                            </button>
                                                            <button 
                                                                onClick={() => handleSaveEditedComment(sale.id, comment.id || `${cIdx}`)}
                                                                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/30"
                                                            >
                                                                <Save size={13} /> حفظ التعديل
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-white/90 whitespace-pre-wrap">{comment.text}</p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {showCommentInput[sale.id] && (
                                    <div className="space-y-2 bg-black/25 p-3 rounded-2xl border border-white/5">
                                        {/* اختيار التعليق باسم (المسؤول): يظهر لـ admin فقط ويكون التسجيل باسم صاحب الحساب لغير الأدمن */}
                                        {user.role === 'admin' ? (
                                            <div className="flex items-center justify-between gap-2 pb-1 border-b border-white/5">
                                                <label className="text-[11px] font-bold text-blue-300 flex items-center gap-1.5">
                                                    <UserIcon size={14} className="text-blue-400" />
                                                    <span>التعليق باسم (المسؤول):</span>
                                                </label>
                                                <select 
                                                    value={commentSender[sale.id] || (user.username === 'admin' ? 'Mr. Amir' : (adminCommenters[0]?.name || 'Mr. Amir'))}
                                                    onChange={e => setCommentSender(prev => ({ ...prev, [sale.id]: e.target.value }))}
                                                    className="bg-gray-800 border border-blue-500/30 text-blue-200 text-xs rounded-xl px-3 py-1.5 font-bold focus:outline-none focus:border-blue-400 cursor-pointer shadow-inner"
                                                >
                                                    {adminCommenters.map(adm => (
                                                        <option key={adm.id} value={adm.name} className="bg-gray-900 text-white font-bold">
                                                            {adm.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 pb-1 border-b border-white/5 text-[11px] font-bold text-gray-300">
                                                <UserIcon size={14} className="text-blue-400" />
                                                <span>التعليق باسم: <strong className="text-white">{user.name || user.username || 'صاحب الحساب'}</strong></span>
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <textarea 
                                                value={commentText[sale.id] || ''}
                                                onChange={e => setCommentText(prev => ({ ...prev, [sale.id]: e.target.value.substring(0, 1000) }))}
                                                placeholder="أضف تعليقاً..."
                                                className="w-full bg-black/30 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-blue-500 min-h-[40px] max-h-[80px]"
                                                maxLength={1000}
                                            />
                                            <button onClick={() => handleAddComment(sale.id)} disabled={!commentText[sale.id]?.trim()} className="bg-blue-600 text-white p-2.5 rounded-xl flex items-center justify-center disabled:opacity-50 hover:bg-blue-700 transition">
                                                <Send size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    );
                })}
            </div>
        </div>

            {/* مودال تعديل البيعة */}
            {editingSale && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/20 w-full max-w-2xl rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-white flex items-center gap-2"><Edit className="text-indigo-500"/> تعديل تفاصيل المبيعات</h3>
                            <button onClick={() => setEditingSale(null)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                            {editingSale.items.map((item, idx) => (
                                <div key={idx} className="bg-black/20 p-4 rounded-2xl border border-white/5 space-y-3">
                                    <select 
                                        className="w-full bg-gray-800 text-white p-3 rounded-xl border border-white/10 text-xs font-bold"
                                        value={item.name || ''}
                                        onChange={e => updateEditingItem(idx, 'name', e.target.value)}
                                    >
                                        <option value="">-- اختر الصنف (منتجات سوفت روز) --</option>
                                        {allProductNames.map(pName => (
                                            <option key={pName} value={pName}>{pName}</option>
                                        ))}
                                    </select>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">السعر</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-gray-800 text-white p-3 rounded-xl border border-white/10 text-center font-black"
                                                value={item.price || ''}
                                                onChange={e => updateEditingItem(idx, 'price', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">الكمية</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-gray-800 text-white p-3 rounded-xl border border-white/10 text-center font-black"
                                                value={item.qty || ''}
                                                onChange={e => updateEditingItem(idx, 'qty', parseFloat(e.target.value) || 0)}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-left text-xs font-bold text-green-400">
                                        المجموع: {((Number(item.price) || 0) * (Number(item.qty) || 0)).toLocaleString()} ج.م
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="mt-6 border-t border-white/10 pt-4 flex justify-between items-center">
                            <div className="text-white">
                                <div className="text-[10px] font-black opacity-40 uppercase">إجمالي البيعة الجديد</div>
                                <div className="text-2xl font-black text-blue-400">
                                    {(editingSale.items.reduce((acc, i) => acc + ((Number(i.price) || 0) * (Number(i.qty) || 0)), 0)).toLocaleString()} ج.م
                                </div>
                            </div>
                            <button onClick={handleUpdateSale} className="bg-indigo-600 text-white font-bold py-3 px-8 rounded-2xl shadow-xl active:scale-[0.98] transition flex items-center gap-2">
                                <Save size={18}/> حفظ التعديلات
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* مودال إدارة التارجت */}
            {showTargetModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/20 w-full max-w-lg rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-white flex items-center gap-2"><Target className="text-purple-500"/> إدارة التارجت الذكي</h3>
                            <div className="flex items-center gap-3">
                                <button onClick={handleDownloadImage} className="text-blue-400 hover:text-blue-300 flex items-center gap-1 text-sm bg-blue-500/10 px-3 py-1.5 rounded-lg transition" title="تحميل صورة"><Printer size={16}/> تحميل التقرير</button>
                                <button onClick={() => setShowTargetModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">اختر الفرع</label>
                                <select className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold" value={targetMarket} onChange={e => setTargetMarket(e.target.value)}>
                                    <option value="">-- اختر الفرع --</option>
                                    {allAvailableFilterMarkets.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">الموظف</label>
                                <select className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold" value={targetEmployeeKey} onChange={e => setTargetEmployeeKey(e.target.value)}>
                                    <option value="">-- اختر الموظف --</option>
                                    {usersList.filter(u => !u.isArchived).map(u => <option key={u.key} value={u.key}>{u.name}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">التارجت المقترح (محقق الشهر)</label>
                                    <input type="number" className="w-full p-4 rounded-2xl bg-gray-800 text-white border border-white/20 font-black text-lg" value={suggestedTarget} onChange={e => setSuggestedTarget(parseFloat(e.target.value) || 0)} />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">نسبة النمو %</label>
                                    <input type="number" className="w-full p-4 rounded-2xl bg-gray-800 text-white border border-white/20 font-black text-lg" value={growthPercent} onChange={e => setGrowthPercent(parseFloat(e.target.value) || 0)} />
                                </div>
                            </div>
                            
                            {targetEmployeeKey && (
                                <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-2xl">
                                    <label className="block text-[10px] font-black opacity-60 uppercase mb-2 text-blue-400">تعديل التارجت (التارجت الحالي المسجل)</label>
                                    <div className="flex gap-2">
                                        <input 
                                            type="number" 
                                            className="flex-1 p-3 rounded-xl bg-gray-800 text-white border border-white/20 font-black text-lg" 
                                            value={currentActiveTarget} 
                                            onChange={e => setCurrentActiveTarget(parseFloat(e.target.value) || 0)} 
                                        />
                                        <button onClick={handleUpdateActiveTarget} className="bg-blue-600 hover:bg-blue-700 px-4 rounded-xl text-white font-bold transition whitespace-nowrap text-sm">
                                            حفظ التعديل
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="bg-purple-600/10 border border-purple-500/30 p-4 rounded-2xl">
                                <label className="block text-[10px] font-black opacity-60 uppercase mb-1 text-purple-400">التارجت النهائي المعتمد (جديد)</label>
                                <div className="text-3xl font-black text-white">{(Number(finalTarget) || 0).toLocaleString()} <span className="text-sm">ج.م</span></div>
                            </div>
                            <button onClick={handleSaveTarget} className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2 mt-2">
                                <Save size={20}/> اعتماد وإضافة التارجت الجديد
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showArchiveModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/20 w-full max-w-2xl rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh] my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-white flex items-center gap-2"><History className="text-blue-500"/> أرشيف التارجت</h3>
                            <button onClick={() => setShowArchiveModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="flex gap-2 mb-4">
                            <div className="flex-1 relative">
                                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" size={16}/>
                                <input type="text" placeholder="بحث بالشهر أو الاسم..." className="w-full pr-10 p-3 rounded-xl bg-gray-800 text-white border border-white/10 text-base" value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)} />
                            </div>
                            <select className="p-3 rounded-xl bg-[#808080] text-white border border-white/10 text-base font-bold" value={archiveEmployee} onChange={e => setArchiveEmployee(e.target.value)}>
                                <option value="all">كل الموظفين</option>
                                {archiveEmployeesList.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                            <button onClick={copyArchiveData} className="bg-blue-600 p-3 rounded-xl text-white hover:bg-blue-500 transition" title="نسخ البيانات">
                                <Copy size={18}/>
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3">
                            {(() => {
                                const filtered = getFilteredArchive();
                                const grouped = filtered.reduce((acc, h) => {
                                    if (!acc[h.month]) acc[h.month] = [];
                                    acc[h.month].push(h);
                                    return acc;
                                }, {} as Record<string, TargetHistory[]>);

                                // Ensure June ("2026-06") has Omnia, Toqa, Mena Ahmed's actual sales
                                const exactNames = findExactEmployeeNames();
                                const targetNames = [exactNames.omnia, exactNames.toqa, exactNames.mena];
                                
                                if (!grouped["2026-06"] && targetNames.length > 0) {
                                    grouped["2026-06"] = [];
                                }
                                
                                if (grouped["2026-06"]) {
                                    targetNames.forEach(empName => {
                                        const u = usersList.find(usr => usr.name === empName);
                                        const JuneAchieved = computeAchieved(empName, 2026, 5, u?.key); // Month index 5 is June
                                        const existingIdx = grouped["2026-06"].findIndex(h => h.employeeName === empName);
                                        if (existingIdx !== -1) {
                                            grouped["2026-06"][existingIdx].achievedAmount = JuneAchieved;
                                        } else {
                                            const t = targetsList.find(tg => tg.employeeName === empName);
                                            grouped["2026-06"].push({
                                                id: `temp-${empName}`,
                                                userId: u?.key || empName,
                                                employeeName: empName,
                                                month: "2026-06",
                                                targetAmount: t ? t.finalTarget : 0,
                                                achievedAmount: JuneAchieved
                                            });
                                        }
                                    });
                                }

                                const getMonthDateRange = (monthStr: string) => {
                                    if (!monthStr || !monthStr.includes('-')) return '';
                                    const [year, month] = monthStr.split('-');
                                    const m = parseInt(month, 10);
                                    const y = parseInt(year, 10);
                                    if (isNaN(m) || isNaN(y)) return monthStr;
                                    const lastDay = new Date(y, m, 0).getDate();
                                    return `من 1/${m}/${y} إلى ${lastDay}/${m}/${y}`;
                                };

                                const toggleArchiveMonth = (month: string) => {
                                    setExpandedArchiveMonths(prev => ({...prev, [month]: !prev[month]}));
                                };

                                return Object.entries(grouped)
                                    .sort((a, b) => b[0].localeCompare(a[0])) // Sort by month descending
                                    .map(([month, histories]) => {
                                        const isExpanded = expandedArchiveMonths[month] !== false; // Default to true (expanded) for new months
                                        const totalTarget = histories.reduce((sum, h) => sum + h.targetAmount, 0);
                                        const totalAchieved = histories.reduce((sum, h) => sum + h.achievedAmount, 0);
                                        const totalRemaining = Math.max(0, totalTarget - totalAchieved);
                                        const totalPerc = totalTarget > 0 ? Math.min(100, Math.round((totalAchieved / totalTarget) * 100)) : 0;

                                        return (
                                            <div key={month} className="p-4 rounded-2xl border border-white/10 bg-black/40 flex flex-col gap-3">
                                                <div 
                                                    className="flex justify-between items-center cursor-pointer"
                                                    onClick={() => toggleArchiveMonth(month)}
                                                >
                                                    <div className="flex-1">
                                                        <div className="font-bold text-lg text-white">شهر {month}</div>
                                                        <div className="text-xs opacity-60 text-white mt-1 mb-2">{getMonthDateRange(month)}</div>
                                                        <div className="flex flex-wrap gap-2 text-xs">
                                                            <span className="bg-yellow-500/20 text-yellow-300 px-2 py-1 rounded">إجمالي التارجت: {(Number(totalTarget) || 0).toLocaleString()}</span>
                                                            <span className="bg-green-500/20 text-green-300 px-2 py-1 rounded">المحقق: {(Number(totalAchieved) || 0).toLocaleString()}</span>
                                                            <span className="bg-red-500/20 text-red-300 px-2 py-1 rounded">المتبقي: {(Number(totalRemaining) || 0).toLocaleString()}</span>
                                                            <span className="bg-blue-500/20 text-blue-300 px-2 py-1 rounded">النسبة: {totalPerc}%</span>
                                                        </div>
                                                    </div>
                                                    <button className="text-white/60 hover:text-white transition bg-white/5 p-2 rounded-xl">
                                                        {isExpanded ? <ChevronUp size={20}/> : <ChevronDown size={20}/>}
                                                    </button>
                                                </div>

                                                {isExpanded && (
                                                    <div className="space-y-2 mt-2 pt-3 border-t border-white/10">
                                                        {histories.map((h, hIdx) => {
                                                            const perc = h.targetAmount > 0 ? Math.min(100, Math.round((h.achievedAmount / h.targetAmount) * 100)) : 0;
                                                            return (
                                                            <div key={h.id ? `hist-${h.id}-${hIdx}` : `hist-${month}-${h.employeeName || hIdx}-${hIdx}`} className="p-3 rounded-xl border border-white/5 bg-gray-800/50 flex justify-between items-center hover:bg-gray-800 transition">
                                                                <div className="font-bold text-sm text-blue-400 flex items-center gap-2">
                                                                    {h.employeeName}
                                                                    <span className="text-xs bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded">{perc}%</span>
                                                                </div>
                                                                <div className="text-left">
                                                                    <div className="text-[10px] font-bold opacity-40 uppercase mb-1">التارجت: {(Number(h.targetAmount) || 0).toLocaleString()}</div>
                                                                    <div className={`text-sm font-black ${h.achievedAmount >= h.targetAmount ? 'text-green-400' : 'text-orange-400'}`}>
                                                                        المحقق: {(Number(h.achievedAmount) || 0).toLocaleString()}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                });
                            })()}
                        </div>
                    </div>
                </div>
            )}

            {showProductSalesModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/20 w-full max-w-2xl rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh] my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-white flex items-center gap-2"><Package className="text-blue-500"/> تقرير مبيعات الأصناف</h3>
                            <button onClick={() => setShowProductSalesModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:gap-4 mb-3 sm:mb-4">
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">الأصناف</label>
                                <select className="w-full p-2.5 sm:p-3 rounded-xl bg-[#808080] text-white border border-white/10 text-xs font-bold outline-none truncate cursor-pointer" value={reportItem} onChange={e => setReportItem(e.target.value)}>
                                    <option value="all">كل الأصناف</option>
                                    {Object.entries(groupedItems).map(([cat, items]) => {
                                        if (items.length === 0) return null;
                                        const label = categoryLabels[cat] || cat;
                                        return (
                                            <optgroup key={cat} label={label}>
                                                {items.map(name => <option key={name} value={name}>{name}</option>)}
                                            </optgroup>
                                        );
                                    })}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">الماركت</label>
                                <select className="w-full p-2.5 sm:p-3 rounded-xl bg-[#808080] text-white border border-white/10 text-xs font-bold outline-none truncate cursor-pointer" value={reportMarket} onChange={e => setReportMarket(e.target.value)}>
                                    <option value="all">كل الماركتات المسجلة</option>
                                    {marketsWithSales.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* خانة الموظف: تظهر أسفل الأصناف والماركت وتتيح الاستعلام مع أو بدون اختيار موظف */}
                        <div className="mb-2">
                            <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">الموظف (اختياري)</label>
                            <select 
                                className="w-full p-2.5 sm:p-3 rounded-xl bg-[#808080] text-white border border-white/10 text-xs font-bold outline-none truncate cursor-pointer" 
                                value={reportEmployee} 
                                onChange={e => setReportEmployee(e.target.value)}
                            >
                                <option value="all">كل الموظفين (اختياري)</option>
                                {employeesWithSales.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                        </div>

                        <button onClick={() => setShowProductSalesDataModal(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-lg mt-4 cursor-pointer">اظهر البيانات</button>
                    </div>
                </div>
            )}
            
            {showProductSalesDataModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/20 w-full max-w-2xl rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh] my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-white flex items-center gap-2"><Package className="text-blue-500"/> بيانات مبيعات الأصناف</h3>
                            <button onClick={() => setShowProductSalesDataModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="flex gap-2 mb-3">
                                <input type="date" className="w-full p-2.5 rounded-lg bg-gray-800 text-white border border-white/10 text-base" value={reportStart} onChange={e => setReportStart(e.target.value)} />
                                <input type="date" className="w-full p-2.5 rounded-lg bg-gray-800 text-white border border-white/10 text-base" value={reportEnd} onChange={e => setReportEnd(e.target.value)} />
                        </div>
                        {(reportMarket !== 'all' || reportEmployee !== 'all' || reportItem !== 'all') && (
                            <div className="flex flex-wrap items-center gap-2 mb-4">
                                {reportMarket !== 'all' && (
                                    <span className="bg-blue-500/20 text-blue-300 text-xs px-2.5 py-1 rounded-xl border border-blue-500/30 font-bold">
                                        الفرع: {reportMarket}
                                    </span>
                                )}
                                {reportEmployee !== 'all' && (
                                    <span className="bg-purple-500/20 text-purple-300 text-xs px-2.5 py-1 rounded-xl border border-purple-500/30 font-bold">
                                        الموظف: {reportEmployee}
                                    </span>
                                )}
                                {reportItem !== 'all' && (
                                    <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-1 rounded-xl border border-emerald-500/30 font-bold">
                                        الصنف: {reportItem}
                                    </span>
                                )}
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            
                            <div className="bg-blue-600/10 border border-blue-500/30 p-4 rounded-2xl flex items-center gap-3">
                                <ShoppingBag className="text-blue-400" size={24}/>
                                <div>
                                    <div className="text-[10px] font-black opacity-40 uppercase text-white">الكمية المباعة</div>
                                    <div className="text-xl font-black text-white">{(Number(reportResults?.totalQty) || 0).toLocaleString()} <span className="text-[10px] opacity-60">قطعة</span></div>
                                </div>
                            </div>
                            <div className="bg-green-600/10 border border-green-500/30 p-4 rounded-2xl flex items-center gap-3">
                                <Calculator className="text-green-400" size={24}/>
                                <div>
                                    <div className="text-[10px] font-black opacity-40 uppercase text-white">القيمة الإجمالية</div>
                                    <div className="text-xl font-black text-white">{(Number(reportResults?.totalValue) || 0).toLocaleString()} <span className="text-[10px] opacity-60">ج.م</span></div>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/5 rounded-2xl bg-black/20 p-2">
                             <table className="w-full text-[10px] text-center">
                                <thead className="bg-white/5 text-white/50">
                                    <tr>
                                        <th className="py-2 px-2 text-right text-white">اسم الصنف</th>
                                        <th className="py-2 text-white">سعر القطعة</th>
                                        <th className="py-2 text-white">الكمية</th>
                                        <th className="py-2 px-2 text-white">الإجمالي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(Object.entries(reportResults?.itemsGrouped || {}) as [string, { price: number; qty: number; total: number }][]).map(([name, stats], idx) => (
                                        <tr key={idx} className="border-t border-white/5 text-white">
                                            <td className="py-2 px-2 text-right font-bold truncate max-w-[150px]">{name}</td>
                                            <td className="py-2">{(Number(stats?.price) || 0).toLocaleString()}</td>
                                            <td className="py-2 font-black">{(Number(stats?.qty) || 0).toLocaleString()}</td>
                                            <td className="py-2 px-2 text-green-400 font-black">{(Number(stats?.total) || 0).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    {Object.keys(reportResults?.itemsGrouped || {}).length > 0 && (
                                        <tr className="border-t-2 border-white/20 bg-white/5 font-black text-white">
                                            <td className="py-3 px-2 text-right uppercase tracking-widest" colSpan={3}>الإجمالي العام</td>
                                            <td className="py-3 px-2 text-green-400 text-sm">{(Number(reportResults?.totalValue) || 0).toLocaleString()}</td>
                                        </tr>
                                    )}
                                </tbody>
                             </table>
                        </div>

                        {reportItem === 'all' && Object.keys(reportResults?.itemsGrouped || {}).length > 0 && (
                            <button 
                                onClick={handleExportProductSales}
                                className="w-full bg-green-600 text-white font-bold py-4 rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2 mt-4"
                            >
                                <FileSpreadsheet size={20}/> تصدير ملف إكسيل
                            </button>
                        )}
                    </div>
                </div>
            )}

            {showExportModal && (
              <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                <div className="bg-gray-900 border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl my-auto">
                  <div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg text-white">تصدير مبيعات فترة زمنية</h3><button onClick={() => setShowExportModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button></div>
                  <div className="space-y-4">
                    <div><label className="block text-xs font-bold mb-1 opacity-60 text-white">تاريخ البداية</label><input type="date" className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10" value={exportStart} onChange={e => setExportStart(e.target.value)} /></div>
                    <div><label className="block text-xs font-bold mb-1 opacity-60 text-white">تاريخ النهاية</label><input type="date" className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10" value={exportEnd} onChange={e => setExportEnd(e.target.value)} /></div>
                    <div><label className="block text-xs font-bold mb-1 opacity-60 text-white">الماركت (اختياري)</label><select className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10" value={exportMarket} onChange={e => setExportMarket(e.target.value)}><option value="">كل الماركتات</option>{allAvailableFilterMarkets.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div><label className="block text-xs font-bold mb-1 opacity-60 text-white">الموظف (اختياري)</label><select className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10" value={exportEmployee} onChange={e => setExportEmployee(e.target.value)}><option value="">كل الموظفين</option>{Array.from(new Set(sales.map(s => s.employeeName || s.username || "System"))).filter(Boolean).map(name => <option key={name} value={name}>{name}</option>)}</select></div>
                    <button onClick={handleExportPeriod} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-xl transition active:scale-95">بدء التحميل (Excel)</button>
                  
                        </div>
                    </div>
                </div>
            )}
            {showCurrentTargetsModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/10 w-full max-w-2xl rounded-3xl p-3.5 sm:p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
                        <div className="flex justify-between items-center mb-3 sm:mb-6 shrink-0">
                            <h3 className="font-bold text-base sm:text-xl text-orange-400 flex items-center gap-2 truncate">
                                <Target size={20} className="shrink-0"/> 
                                <span className="truncate">
                                    {selectedTargetMonth === 'current' ? 'تارجت الشهر الحالي' : `أرشيف التارجت لشهر ${selectedTargetMonth}`}
                                </span>
                            </h3>
                            <button onClick={() => { setShowCurrentTargetsModal(false); setSelectedTargetMonth('current'); }} className="text-white/50 hover:text-white p-1 rounded-lg shrink-0"><X size={20}/></button>
                        </div>
                        
                        <div className="space-y-2 mb-3 shrink-0">
                            {/* سطر واحد لاختيار: التارجت السابق + الشهر الحالي + تحديد اسم */}
                            <div className="grid grid-cols-3 gap-1.5 sm:gap-2 items-end">
                                <div className="min-w-0">
                                    <label className="block text-[9px] sm:text-[10px] font-black opacity-50 uppercase mb-0.5 sm:mb-1 text-white truncate">التارجت السابق</label>
                                    <select 
                                        className="w-full p-2 sm:p-2.5 rounded-xl bg-gray-800 text-white border border-white/10 text-[10px] sm:text-xs font-bold outline-none truncate cursor-pointer"
                                        value={selectedTargetMonth === 'current' ? '' : selectedTargetMonth}
                                        onChange={(e) => {
                                            if (e.target.value) {
                                                setSelectedTargetMonth(e.target.value);
                                            }
                                        }}
                                    >
                                        <option value="" disabled>الأرشيف</option>
                                        {pastMonthsList.map(mKey => (
                                            <option key={mKey} value={mKey}>{mKey}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="min-w-0">
                                    <label className="block text-[9px] sm:text-[10px] font-black opacity-0 uppercase mb-0.5 sm:mb-1 select-none">الشهر</label>
                                    <button 
                                        onClick={() => setSelectedTargetMonth('current')}
                                        className={`w-full py-2 sm:py-2.5 px-1 sm:px-3 rounded-xl font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1 transition h-[35px] sm:h-[40px] truncate cursor-pointer ${
                                            selectedTargetMonth === 'current' 
                                                ? 'bg-orange-600 text-white' 
                                                : 'bg-gray-700 hover:bg-gray-600 text-white'
                                        }`}
                                    >
                                        <Target size={13} className="shrink-0" />
                                        <span className="truncate">الشهر الحالي</span>
                                    </button>
                                </div>

                                <div className="min-w-0">
                                    <label className="block text-[9px] sm:text-[10px] font-black opacity-50 uppercase mb-0.5 sm:mb-1 text-white truncate">تحديد اسم</label>
                                    <select 
                                        className="w-full p-2 sm:p-2.5 rounded-xl bg-gray-800 text-white border border-white/10 text-[10px] sm:text-xs font-bold outline-none truncate cursor-pointer"
                                        value={targetPrintEmployee} 
                                        onChange={e => setTargetPrintEmployee(e.target.value)}
                                    >
                                        <option value="">الكل</option>
                                        {getDropdownEmployees().map(emp => (
                                            <option key={emp.key} value={emp.key}>{emp.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* أزرار التحميل */}
                            <div className="flex items-center gap-2 pt-1">
                                <button 
                                    onClick={handleDownloadTargetPDF}
                                    disabled={isExportingTargetPDF}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow active:scale-95 cursor-pointer disabled:opacity-50"
                                    title="تحميل التارجت بصيغة PDF بالعرض"
                                >
                                    <FileDown size={14}/>
                                    <span>{isExportingTargetPDF ? 'جاري التحميل...' : 'تحميل'}</span>
                                </button>
                                <button 
                                    onClick={() => handleDownloadImage(false)}
                                    disabled={isExportingTargetImage}
                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white px-3 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition shadow active:scale-95 cursor-pointer disabled:opacity-50"
                                    title="تحميل التارجت بالكامل كصورة طولية واضحة"
                                >
                                    <ImageIcon size={14}/>
                                    <span>{isExportingTargetImage ? 'جاري التحميل...' : 'تحميل كا صورة'}</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar pr-1">
                            <div id="current-targets-print-area" className="space-y-2 bg-gray-900 pb-2 w-full min-w-0 overflow-x-hidden">
                                {selectedTargetMonth === 'current' 
                                    ? renderTargetsList() 
                                    : renderPastMonthTargetsList(selectedTargetMonth)
                                }
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showPastTargetsModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/10 w-full max-w-3xl rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-gray-300 flex items-center gap-2">
                                <History size={24}/> التارجت للشهور السابقة
                            </h3>
                            <button onClick={() => setShowPastTargetsModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-6">
                            {pastMonthsList.map(mKey => {
                                const [yStr, mStr] = mKey.split('-');
                                const year = parseInt(yStr);
                                const month = parseInt(mStr) - 1;
                                
                                const monthTargets = targetsList.filter(t => t.employeeName && typeof t.employeeName === 'string' && t.employeeName.trim().length > 0).map((t, tIdx) => {
                                    const achieved = computeAchieved(t.employeeName, year, month, t.userId);
                                    let pastTarget = t.finalTarget;
                                    // Try to fetch historical target if available
                                    const historical = archiveData.find(a => a.userId === t.userId && a.month === mKey);
                                    if (historical) {
                                        if ((historical as any).isDeleted) return null;
                                        pastTarget = historical.targetAmount;
                                    }
                                    
                                    if (achieved === 0 && pastTarget === 0) return null;
                                    const perc = pastTarget > 0 ? ((achieved / pastTarget) * 100).toFixed(1) : 0;

                                    return (
                                        <div 
                                            key={`month-target-${t.userId || t.employeeName}-${mKey}-${tIdx}`} 
                                            className="flex items-center justify-between gap-1.5 sm:gap-3 p-2.5 sm:p-3 rounded-xl bg-black/25 border border-white/5 w-full min-w-0 overflow-hidden"
                                        >
                                            {/* الاسم وأسفله الفروع */}
                                            <div className="flex-1 min-w-0 text-right pr-0.5">
                                                <div className="font-bold text-white text-xs sm:text-sm truncate" title={t.employeeName}>{t.employeeName}</div>
                                                <div className="text-[10px] sm:text-xs text-blue-300 font-medium truncate mt-0.5" title={t.market}>الفروع: {t.market || '-'}</div>
                                            </div>

                                            {/* بجانبه التارجت و المحقق بدون ج.م و النسبه في صف واحد */}
                                            <div className="flex items-center gap-2 sm:gap-4 shrink-0 text-center">
                                                <div className="flex flex-col items-center justify-center min-w-0">
                                                    <span className="text-[9px] text-gray-400 font-bold block">التارجت</span>
                                                    <span className="font-black text-yellow-400 text-xs sm:text-sm">{(Number(pastTarget) || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex flex-col items-center justify-center min-w-0">
                                                    <span className="text-[9px] text-gray-400 font-bold block">المحقق</span>
                                                    <span className="font-black text-green-400 text-xs sm:text-sm">{(Number(achieved) || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex flex-col items-center justify-center min-w-[34px] sm:min-w-[42px]">
                                                    <span className="text-[9px] text-gray-400 font-bold block">النسبة</span>
                                                    <span className="font-black text-blue-400 text-xs sm:text-sm">{perc}%</span>
                                                </div>
                                                <div className="flex items-center gap-1 border-r border-white/10 pr-1 mr-0.5">
                                                    <button onClick={() => handleEditPastTarget(t.userId, t.employeeName, mKey, historical, pastTarget, achieved)} className="p-1 text-blue-400 hover:bg-blue-500/20 rounded-lg transition" title="تعديل"><Edit size={14}/></button>
                                                    <button onClick={() => handleDeletePastTarget(t.userId, t.employeeName, mKey, historical)} className="p-1 text-red-400 hover:bg-red-500/20 rounded-lg transition" title="حذف"><Trash2 size={14}/></button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                }).filter(Boolean);

                                if (monthTargets.length === 0) return null;

                                return (
                                    <div key={mKey} id={`past-month-${mKey}`} className="bg-gray-800 p-4 rounded-2xl border border-white/5">
                                        <div className="mb-3 border-b border-white/10 pb-2 flex items-center justify-between">
                                            <h4 className="font-bold text-indigo-400">شهر: {mKey}</h4>
                                            <button 
                                                onClick={() => handleDownloadPastMonthImage(mKey)}
                                                className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                                                title="تحميل كصورة"
                                            >
                                                <Printer size={14}/> تحميل كصورة
                                            </button>
                                        </div>
                                        <div className="space-y-2">
                                            {monthTargets}
                                        </div>
                                    </div>
                                );
                            })}
                            {pastMonthsList.length === 0 && <div className="text-center py-10 opacity-50 text-white">لا توجد شهور سابقة مسجلة</div>}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Hidden Print Area for Selected Sales (Phase 1) */}
            {(selectedSalesIds.length > 0 || showCurrentTargetsModal || showTargetModal) && (
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                <div id="selected-sales-print-area" className="w-[1000px] p-8 bg-gray-900 space-y-4 rounded-3xl" style={{ direction: 'rtl' }}>
                    <div className="text-center mb-6 border-b border-white/10 pb-4">
                        <h2 className="text-3xl font-black text-white">تقرير مبيعات محددة</h2>
                        <p className="text-gray-400 mt-2 text-lg">{new Date().toLocaleDateString('ar-EG')}</p>
                    </div>
                    <div className="space-y-4">
                        {sales.filter(s => selectedSalesIds.includes(s.id)).map((sale, sIdx) => (
                            <div key={`print-sale-${sale.id}-${sIdx}`} className="p-5 rounded-3xl border border-white/20 bg-gray-800 shadow-2xl">
                                <div>
                                    <div className="font-bold text-2xl text-blue-400 mb-2">{sale.market || resolveMarketForSale(sale)}</div>
                                    <div className="flex flex-wrap items-center gap-4 text-sm opacity-80 font-bold mt-1 text-white mb-4">
                                        <span className="flex items-center gap-1"><Calendar size={16}/> {sale.timestamp ? new Date(sale.timestamp).toLocaleDateString('ar-EG', { weekday: 'long' }) : ''} - {sale.date}</span>
                                        {sale.timestamp && (
                                            <span className="flex items-center gap-1 text-cyan-300 font-bold"><Clock size={16}/> {new Date(sale.timestamp).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
                                        )}
                                        <span className="flex items-center gap-1"><UserIcon size={16}/> {sale.employeeName}</span>
                                    </div>
                                </div>
                                <div className="overflow-hidden rounded-2xl bg-black/40 border border-white/10">
                                    <table className="w-full text-base text-center">
                                        <thead className="bg-white/10 text-white/70">
                                            <tr><th className="py-3 px-4 text-right text-white">الصنف</th><th className="py-3 text-white">السعر</th><th className="py-3 text-white">الكمية</th><th className="py-3 px-4 text-white">المجموع</th></tr>
                                        </thead>
                                        <tbody>
                                            {(sale.items || []).map((item, idx) => (
                                                <tr key={`print-item-${sale.id}-${idx}`} className="border-t border-white/5">
                                                    <td className="py-3 px-4 text-right text-gray-200">{item.name}</td>
                                                    <td className="py-3 text-gray-400">{item.price}</td>
                                                    <td className="py-3 font-bold text-white bg-white/5">{item.qty}</td>
                                                    <td className="py-3 px-4 font-bold text-blue-300">{((Number(item.qty) || 0) * (Number(item.price) || 0)).toLocaleString()} <span className="text-xs">ج.م</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot className="bg-blue-600/20 border-t border-blue-500/30">
                                            <tr><td colSpan={3} className="py-4 px-4 text-left font-black text-white text-lg">الإجمالي:</td><td className="py-4 px-4 font-black text-blue-400 text-xl">{(Number(sale.total) || 0).toLocaleString()} <span className="text-sm">ج.م</span></td></tr>
                                        </tfoot>
                                    </table>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                
                <div id="selected-target-print-area" className="w-[1000px] p-8 bg-gray-900 rounded-3xl" style={{ direction: 'rtl' }}>
                    <div className="text-center mb-6 border-b border-white/10 pb-4">
                        <h2 className="text-3xl font-black text-white">تقرير التارجت للموظف</h2>
                    </div>
                    <div className="space-y-4">
                        {targetsList.filter(t => t.userId === selectedTargetEmployeeToShare).map((t, tIdx) => {
                            const now = new Date();
                            const achieved = computeAchieved(t.employeeName, now.getFullYear(), now.getMonth(), t.userId);
                            const ratio = t.finalTarget > 0 ? (achieved / t.finalTarget) * 100 : 0;
                            const remaining = Math.max(0, t.finalTarget - achieved);
                            return (
                            <div key={`print-target-${t.userId || t.employeeName}-${tIdx}`} className="p-6 bg-gray-800 rounded-2xl border border-white/20">
                                <div className="flex items-center gap-4 mb-4">
                                    <div className="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                                        {(t.employeeName || '?').charAt(0)}
                                    </div>
                                    <div>
                                        <div className="text-2xl font-bold text-white">{t.employeeName}</div>
                                        <div className="text-lg text-blue-400">{t.market}</div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-black/40 p-4 rounded-xl border border-white/5">
                                        <div className="text-gray-400 text-sm mb-1">التارجت المطلوب</div>
                                        <div className="text-3xl font-black text-white">{(Number(t?.finalTarget) || 0).toLocaleString()} <span className="text-sm text-gray-500">ج.م</span></div>
                                    </div>
                                    <div className="bg-blue-900/30 p-4 rounded-xl border border-blue-500/20">
                                        <div className="text-blue-300 text-sm mb-1">المُحقق</div>
                                        <div className="text-3xl font-black text-blue-400">{(Number(achieved) || 0).toLocaleString()} <span className="text-sm text-blue-500/50">ج.م</span></div>
                                    </div>
                                </div>
                                <div className="mt-6">
                                    <div className="flex justify-between text-sm font-bold text-white mb-2">
                                        <span>نسبة الإنجاز</span>
                                        <span className={ratio >= 100 ? 'text-green-400' : 'text-blue-400'}>{ratio.toFixed(1)}%</span>
                                    </div>
                                    <div className="w-full h-4 bg-gray-900 rounded-full overflow-hidden border border-white/5">
                                        <div className={`h-full transition-all duration-1000 ${ratio >= 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(ratio, 100)}%` }} />
                                    </div>
                                </div>
                            </div>
                        )})}
                    </div>
                </div>
            </div>
            )}

            {/* Dedicated High-Quality Portrait Target Image Print Container (ب الطول، واضحة، و بالكامل) */}
            {(showCurrentTargetsModal || showPastTargetsModal || showTargetModal) && (
            <div 
                ref={targetImageExportContainerRef}
                id="target-image-full-render"
                style={{ 
                    position: 'fixed', 
                    left: '-99999px', 
                    top: '0px', 
                    width: '780px', 
                    backgroundColor: '#0f172a', 
                    color: '#ffffff', 
                    padding: '24px 28px 36px 28px',
                    direction: 'rtl',
                    fontFamily: 'inherit',
                    zIndex: -99999,
                    overflow: 'visible'
                }}
            >
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '20px', paddingBottom: '16px', borderBottom: '2px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '26px' }}>🎯</span>
                        <h2 style={{ fontSize: '24px', fontWeight: 900, color: '#60a5fa', margin: 0 }}>شركة سوفت روز للتجارة الحديثة</h2>
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#f8fafc', margin: '4px 0 10px 0' }}>
                        {selectedTargetMonth === 'current' ? 'تقرير تارجت ومبيعات الشهر الحالي' : `تقرير أرشيف التارجت والمبيعات - شهر ${selectedTargetMonth}`}
                    </h3>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '14px', fontSize: '12px', color: '#94a3b8' }}>
                        <span style={{ backgroundColor: 'rgba(255,255,255,0.06)', padding: '4px 12px', borderRadius: '8px', fontWeight: 'bold' }}>
                            الفلتر: {targetPrintEmployee ? (getDropdownEmployees().find(e => e.key === targetPrintEmployee)?.name || targetPrintEmployee) : 'جميع الموظفين'}
                        </span>
                        <span style={{ backgroundColor: 'rgba(255,255,255,0.06)', padding: '4px 12px', borderRadius: '8px', fontWeight: 'bold' }}>
                            تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                </div>

                {/* Items list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {targetItemsForExport.map((item, idx) => {
                        const targetAmt = Number(item.targetAmount) || 0;
                        const achAmt = Number(item.achievedAmount) || 0;
                        const perc = targetAmt > 0 ? ((achAmt / targetAmt) * 100).toFixed(1) : "0.0";
                        const diff = achAmt - targetAmt;
                        const numPerc = Number(perc);
                        const percColor = numPerc >= 100 ? '#4ade80' : numPerc >= 70 ? '#38bdf8' : '#f87171';

                        return (
                            <div 
                                key={`target-img-row-${idx}`}
                                style={{
                                    backgroundColor: '#1e293b',
                                    borderRadius: '16px',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    padding: '14px 18px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontSize: '16px', fontWeight: 900, color: '#ffffff' }}>
                                        {item.employeeName}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>نسبة التحقيق:</span>
                                        <span style={{ 
                                            fontSize: '15px', 
                                            fontWeight: 900, 
                                            color: percColor,
                                            backgroundColor: 'rgba(0,0,0,0.3)',
                                            padding: '3px 12px',
                                            borderRadius: '8px'
                                        }}>
                                            {perc}%
                                        </span>
                                    </div>
                                </div>

                                <div style={{ fontSize: '12px', color: '#93c5fd', backgroundColor: 'rgba(0,0,0,0.25)', padding: '6px 12px', borderRadius: '10px', display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <span style={{ color: '#64748b', fontWeight: 'bold' }}>الفروع:</span>
                                    <span>{item.activeMarkets || item.market || 'غير محدد'}</span>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                    <div style={{ backgroundColor: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: '10px', textAlign: 'center' }}>
                                        <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '2px' }}>التارجت المطلوب</span>
                                        <span style={{ fontSize: '15px', fontWeight: 900, color: '#facc15' }}>{targetAmt.toLocaleString()}</span>
                                    </div>
                                    <div style={{ backgroundColor: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: '10px', textAlign: 'center' }}>
                                        <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '2px' }}>المحقق الفعلي</span>
                                        <span style={{ fontSize: '15px', fontWeight: 900, color: '#4ade80' }}>{achAmt.toLocaleString()}</span>
                                    </div>
                                    <div style={{ backgroundColor: 'rgba(0,0,0,0.35)', padding: '8px 10px', borderRadius: '10px', textAlign: 'center' }}>
                                        <span style={{ display: 'block', fontSize: '10px', color: '#94a3b8', fontWeight: 'bold', marginBottom: '2px' }}>{diff >= 0 ? 'الزيادة عن التارجت' : 'المتبقي'}</span>
                                        <span style={{ fontSize: '15px', fontWeight: 900, color: diff >= 0 ? '#4ade80' : '#f87171' }}>{Math.abs(diff).toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {targetItemsForExport.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: '14px' }}>
                            لا توجد بيانات تارجت مسجلة لهذا الشهر
                        </div>
                    )}
                </div>

                {/* Total / Summary Box at the very bottom (كامل وواضح بدون أي اقتصاص) */}
                {targetItemsForExport.length > 0 && (
                    <div style={{
                        marginTop: '22px',
                        marginBottom: '16px',
                        backgroundColor: 'rgba(234, 88, 12, 0.2)',
                        border: '2px solid rgba(249, 115, 22, 0.5)',
                        borderRadius: '20px',
                        padding: '18px 20px',
                        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <span style={{ fontSize: '17px', fontWeight: 900, color: '#ffffff' }}>
                                {targetPrintEmployee ? "الإجمالي المحقق للحساب المختار" : "الإجمالي العام لجميع الحسابات"}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(0,0,0,0.35)', padding: '6px 14px', borderRadius: '12px' }}>
                                <span style={{ fontSize: '12px', color: '#fdba74', fontWeight: 'bold' }}>متوسط نسبة التحقيق:</span>
                                <span style={{ fontSize: '18px', fontWeight: 900, color: '#fb923c' }}>
                                    {(targetItemsForExport.reduce((s, i) => s + (Number(i.targetAmount) || 0), 0) > 0 
                                        ? ((targetItemsForExport.reduce((s, i) => s + (Number(i.achievedAmount) || 0), 0) / targetItemsForExport.reduce((s, i) => s + (Number(i.targetAmount) || 0), 0)) * 100).toFixed(1) 
                                        : "0.0")}%
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', backgroundColor: 'rgba(0,0,0,0.4)', padding: '12px 16px', borderRadius: '14px' }}>
                            <div style={{ textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '11px', color: '#fdba74', fontWeight: 900, marginBottom: '3px' }}>إجمالي التارجت المطلوب</span>
                                <span style={{ fontSize: '20px', fontWeight: 900, color: '#facc15' }}>
                                    {targetItemsForExport.reduce((s, i) => s + (Number(i.targetAmount) || 0), 0).toLocaleString()}
                                </span>
                            </div>
                            <div style={{ textAlign: 'center' }}>
                                <span style={{ display: 'block', fontSize: '11px', color: '#fdba74', fontWeight: 900, marginBottom: '3px' }}>إجمالي المبيعات المحققة</span>
                                <span style={{ fontSize: '20px', fontWeight: 900, color: '#4ade80' }}>
                                    {targetItemsForExport.reduce((s, i) => s + (Number(i.achievedAmount) || 0), 0).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div style={{ textAlign: 'center', paddingTop: '10px', paddingBottom: '10px', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>
                    تم استخراج هذا التقرير آلياً بواسطة نظام سوفت روز للتجارة الحديثة
                </div>
            </div>
            )}

            {/* Faqd Modal (تقرير الفقد) */}
            {showFaqdModal && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/20 w-full max-w-2xl rounded-3xl p-4 sm:p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[92vh] my-auto overflow-hidden">
                        {/* Header */}
                        <div className="flex justify-between items-center pb-3 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shrink-0">
                                    <Activity size={20} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-bold text-base sm:text-lg text-white truncate">تقرير الفقد - تسجيل المبيعات</h3>
                                    <p className="text-[11px] text-gray-400 truncate">متابعة الأيام المسجل وغير المسجل بها مبيعات للموظفين</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowFaqdModal(false)} 
                                className="text-white/50 hover:text-white p-1 rounded-lg transition shrink-0"
                            >
                                <X size={20}/>
                            </button>
                        </div>

                        {/* Controls Form */}
                        <div className="space-y-2.5 py-2.5 shrink-0">
                            {/* تحديد اسم الموظف المستعلم عنه */}
                            <div className="space-y-1">
                                <label className="block text-xs font-bold text-gray-300 flex items-center gap-1.5">
                                    <UserIcon size={14} className="text-blue-400 shrink-0" />
                                    <span>اسم الموظف المستعلم عنه:</span>
                                </label>
                                <select 
                                    className="w-full p-2.5 sm:p-3 rounded-xl bg-gray-800 text-white border border-white/10 text-xs sm:text-sm font-bold outline-none focus:border-blue-500 cursor-pointer"
                                    value={faqdSelectedEmployee} 
                                    onChange={e => {
                                        setFaqdSelectedEmployee(e.target.value);
                                    }}
                                >
                                    <option value="">كل الأسماء</option>
                                    {employeesWithSales.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>

                            {/* سطر واحد: من يوم و إلى يوم */}
                            <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full min-w-0">
                                <div className="min-w-0 space-y-1">
                                    <label className="text-xs font-bold text-gray-300 flex items-center gap-1 truncate">
                                        <Calendar size={13} className="text-blue-400 shrink-0" />
                                        <span>من يوم:</span>
                                    </label>
                                    <input 
                                        type="date" 
                                        className="w-full p-2 sm:p-2.5 rounded-xl bg-gray-800 text-white border border-white/10 text-xs font-bold outline-none focus:border-blue-500 min-w-0" 
                                        value={faqdStartDate} 
                                        onChange={e => {
                                            setFaqdStartDate(e.target.value);
                                        }} 
                                    />
                                </div>
                                <div className="min-w-0 space-y-1">
                                    <label className="text-xs font-bold text-gray-300 flex items-center gap-1 truncate">
                                        <Calendar size={13} className="text-blue-400 shrink-0" />
                                        <span>إلى يوم:</span>
                                    </label>
                                    <input 
                                        type="date" 
                                        className="w-full p-2 sm:p-2.5 rounded-xl bg-gray-800 text-white border border-white/10 text-xs font-bold outline-none focus:border-blue-500 min-w-0" 
                                        value={faqdEndDate} 
                                        onChange={e => {
                                            setFaqdEndDate(e.target.value);
                                        }} 
                                    />
                                </div>
                            </div>

                            {/* زر تصدير اكسيل او pdf اسفل خانه من يوم و الي يوم */}
                            <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full min-w-0 pt-0.5">
                                <button
                                    type="button"
                                    onClick={handleExportFaqdExcel}
                                    className={`w-full ${faqdExportTarget === 'excel' ? 'bg-emerald-600 hover:bg-emerald-500 ring-2 ring-emerald-400' : 'bg-emerald-700/80 hover:bg-emerald-600'} text-white font-bold py-2 sm:py-2.5 rounded-xl transition shadow-lg active:scale-95 flex items-center justify-center gap-1.5 text-xs sm:text-sm cursor-pointer min-w-0`}
                                >
                                    <FileSpreadsheet size={15} className="shrink-0" />
                                    <span className="truncate">تصدير إكسيل</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleExportFaqdPDF}
                                    disabled={isExportingFaqdPDF}
                                    className={`w-full ${faqdExportTarget === 'pdf' ? 'bg-rose-600 hover:bg-rose-500 ring-2 ring-rose-400' : 'bg-rose-700/80 hover:bg-rose-600'} text-white font-bold py-2 sm:py-2.5 rounded-xl transition shadow-lg active:scale-95 flex items-center justify-center gap-1.5 text-xs sm:text-sm cursor-pointer disabled:opacity-50 min-w-0`}
                                >
                                    <FileDown size={15} className="shrink-0" />
                                    <span className="truncate">{isExportingFaqdPDF ? 'جاري التصدير...' : 'تصدير PDF'}</span>
                                </button>
                            </div>
                        </div>

                        {/* Results Summary and Table (يظهر لحظياً دون الحاجة لزر إظهار البيانات) */}
                        {faqdResults && faqdResults.length > 0 && (
                            <div className="flex-1 flex flex-col min-h-0 space-y-2.5 overflow-hidden border-t border-white/10 pt-2.5">
                                {/* Summary Chips */}
                                <div className="grid grid-cols-3 gap-2 shrink-0">
                                    <div className="bg-gray-800/80 border border-white/10 p-2 rounded-xl text-center">
                                        <div className="text-[10px] text-gray-400 font-bold">إجمالي الأيام</div>
                                        <div className="text-sm sm:text-base font-black text-white">{faqdResults.length}</div>
                                    </div>
                                    <div className="bg-green-950/40 border border-green-500/20 p-2 rounded-xl text-center">
                                        <div className="text-[10px] text-green-300 font-bold">مسجل مبيعات</div>
                                        <div className="text-sm sm:text-base font-black text-green-400">
                                            {faqdResults.filter(r => r.hasSales).length}
                                        </div>
                                    </div>
                                    <div className="bg-red-950/40 border border-red-500/20 p-2 rounded-xl text-center">
                                        <div className="text-[10px] text-red-300 font-bold">غير مسجل / إجازات</div>
                                        <div className="text-sm sm:text-base font-black text-red-400">
                                            {faqdResults.filter(r => !r.hasSales).length}
                                        </div>
                                    </div>
                                </div>

                                {/* Results Table - في صف واحد دون مسطرة تحريك يمين أو يسار */}
                                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar border border-white/10 rounded-2xl bg-black/30 p-1 w-full min-w-0">
                                    <table className="w-full table-fixed text-[11px] sm:text-xs text-center border-collapse">
                                        <thead className="bg-white/10 text-white sticky top-0 backdrop-blur-md">
                                            <tr>
                                                <th className="py-2.5 px-1 sm:px-2 text-right font-bold text-white w-[26%] sm:w-[26%]">اسم الموظف</th>
                                                <th className="py-2.5 px-0.5 sm:px-1 text-center font-bold text-white w-[16%] sm:w-[16%]">اليوم</th>
                                                <th className="py-2.5 px-0.5 sm:px-1 text-center font-bold text-white w-[20%] sm:w-[20%]">التاريخ</th>
                                                <th className="py-2.5 px-0.5 sm:px-1 text-center font-bold text-white w-[14%] sm:w-[14%]">عدد المبيعات</th>
                                                <th className="py-2.5 px-0.5 sm:px-1 text-center font-bold text-white w-[24%] sm:w-[24%]">هل مسجل له مبيعات ام لا</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {faqdResults.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-white/5 transition">
                                                    <td className="py-2 px-1 sm:px-2 text-right font-bold text-white truncate" title={row.employeeName}>
                                                        {row.employeeName}
                                                    </td>
                                                    <td className="py-2 px-0.5 sm:px-1 text-center font-medium text-gray-200 truncate">
                                                        {row.dayName}
                                                    </td>
                                                    <td className="py-2 px-0.5 sm:px-1 text-center font-mono text-gray-300 dir-ltr text-[10px] sm:text-xs truncate">
                                                        {row.date}
                                                    </td>
                                                    <td className="py-2 px-0.5 sm:px-1 text-center font-bold text-blue-300 text-[10px] sm:text-xs truncate">
                                                        {row.salesCount > 1 ? row.salesCount : ''}
                                                    </td>
                                                    <td className="py-2 px-0.5 sm:px-1 text-center">
                                                        {row.hasSales ? (
                                                            <span className="inline-flex items-center justify-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-green-500/20 text-green-300 border border-green-500/30 whitespace-nowrap">
                                                                نعم
                                                            </span>
                                                        ) : row.statusLabel === 'إجازة أسبوعية' ? (
                                                            <span className="inline-flex items-center justify-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 whitespace-nowrap">
                                                                إجازة أسبوعية
                                                            </span>
                                                        ) : row.statusLabel === 'إجازة سنوي' || row.statusLabel === 'إجازة سنوية' ? (
                                                            <span className="inline-flex items-center justify-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30 whitespace-nowrap">
                                                                إجازة سنوي
                                                            </span>
                                                        ) : row.statusLabel === 'إجازة عارضة' ? (
                                                            <span className="inline-flex items-center justify-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 whitespace-nowrap">
                                                                إجازة عارضة
                                                            </span>
                                                        ) : row.statusLabel === 'غياب بإذن' ? (
                                                            <span className="inline-flex items-center justify-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                                                                غياب بإذن
                                                            </span>
                                                        ) : row.statusLabel && row.statusLabel !== 'لا' ? (
                                                            <span className="inline-flex items-center justify-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 whitespace-nowrap">
                                                                {row.statusLabel}
                                                            </span>
                                                        ) : (
                                                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-red-500/20 text-red-300 border border-red-500/30 whitespace-nowrap">
                                                                لا
                                                            </span>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Hidden Printable Container for Faqd PDF */}
            {showFaqdModal && (
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                <div 
                    ref={faqdPrintContainerRef} 
                    style={{ 
                        width: '1050px', 
                        background: '#ffffff', 
                        color: '#111827', 
                        direction: 'rtl', 
                        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' 
                    }}
                >
                    {pagesOfFaqdResults.map((pageRows, pageIdx) => (
                        <div 
                            key={`faqd-pdf-page-${pageIdx}`}
                            className="faqd-pdf-page"
                            style={{
                                width: '1050px',
                                minHeight: '1480px',
                                padding: '36px 40px',
                                boxSizing: 'border-box',
                                backgroundColor: '#ffffff',
                                position: 'relative',
                                pageBreakAfter: 'always',
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            {/* Header */}
                            <div style={{ borderBottom: '2px solid #2563eb', paddingBottom: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '24px', fontWeight: '900', color: '#1e3a8a' }}>سوفت روز للمنتجات الورقية</div>
                                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#374151', marginTop: '4px' }}>تقرير الفقد - متابعة تسجيل المبيعات</div>
                                </div>
                                <div style={{ textAlign: 'left', fontSize: '12px', color: '#6b7280', lineHeight: '1.6' }}>
                                    <div><strong>الموظف:</strong> {faqdSelectedEmployee || 'كل الأسماء'}</div>
                                    <div><strong>الفترة:</strong> من {faqdStartDate} إلى {faqdEndDate}</div>
                                    <div><strong>تاريخ الطباعة:</strong> {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                                    <div><strong>الصفحة:</strong> {pageIdx + 1} من {pagesOfFaqdResults.length}</div>
                                </div>
                            </div>

                            {/* Summary badges on first page */}
                            {pageIdx === 0 && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                                    <div style={{ background: '#f3f4f6', border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'bold' }}>إجمالي الأيام</div>
                                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#111827', marginTop: '2px' }}>{faqdResults?.length || 0}</div>
                                    </div>
                                    <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '11px', color: '#047857', fontWeight: 'bold' }}>مسجل له مبيعات (نعم)</div>
                                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#065f46', marginTop: '2px' }}>{faqdResults?.filter(r => r.hasSales).length || 0}</div>
                                    </div>
                                    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 'bold' }}>غير مسجل / فقد (لا)</div>
                                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#991b1b', marginTop: '2px' }}>{faqdResults?.filter(r => !r.hasSales).length || 0}</div>
                                    </div>
                                </div>
                            )}

                            {/* Table with Repeating Headers */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12px' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}>
                                        <th style={{ padding: '10px 8px', border: '1px solid #1e3a8a', width: '45px' }}>م</th>
                                        <th style={{ padding: '10px 12px', border: '1px solid #1e3a8a', textAlign: 'right' }}>اسم الموظف</th>
                                        <th style={{ padding: '10px 10px', border: '1px solid #1e3a8a', width: '120px' }}>اليوم</th>
                                        <th style={{ padding: '10px 10px', border: '1px solid #1e3a8a', width: '130px' }}>التاريخ</th>
                                        <th style={{ padding: '10px 10px', border: '1px solid #1e3a8a', width: '100px' }}>عدد المبيعات</th>
                                        <th style={{ padding: '10px 10px', border: '1px solid #1e3a8a', width: '160px' }}>هل مسجل له مبيعات ام لا</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pageRows.map((row, rIdx) => {
                                        const globalIdx = (pageIdx * 25) + rIdx + 1;
                                        const isEven = rIdx % 2 === 1;
                                        return (
                                            <tr key={rIdx} style={{ backgroundColor: isEven ? '#f9fafb' : '#ffffff' }}>
                                                <td style={{ padding: '9px 8px', border: '1px solid #e5e7eb', color: '#6b7280' }}>{globalIdx}</td>
                                                <td style={{ padding: '9px 12px', border: '1px solid #e5e7eb', textAlign: 'right', fontWeight: 'bold', color: '#111827' }}>{row.employeeName}</td>
                                                <td style={{ padding: '9px 10px', border: '1px solid #e5e7eb', color: '#374151' }}>{row.dayName}</td>
                                                <td style={{ padding: '9px 10px', border: '1px solid #e5e7eb', fontFamily: 'monospace', color: '#4b5563' }}>{row.date}</td>
                                                <td style={{ padding: '9px 10px', border: '1px solid #e5e7eb', fontWeight: 'bold', color: row.salesCount > 1 ? '#1d4ed8' : '#6b7280' }}>
                                                    {row.salesCount > 1 ? row.salesCount : ''}
                                                </td>
                                                <td style={{ padding: '8px 8px', border: '1px solid #e5e7eb', fontWeight: 'bold' }}>
                                                    {row.hasSales ? (
                                                        <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: '12px', backgroundColor: '#d1fae5', color: '#065f46', fontSize: '11px' }}>
                                                            نعم
                                                        </span>
                                                    ) : row.statusLabel === 'إجازة أسبوعية' ? (
                                                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', backgroundColor: '#dbeafe', color: '#1e40af', fontSize: '11px' }}>
                                                            إجازة أسبوعية
                                                        </span>
                                                    ) : row.statusLabel === 'إجازة سنوي' || row.statusLabel === 'إجازة سنوية' ? (
                                                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', backgroundColor: '#ccfbf1', color: '#115e59', fontSize: '11px' }}>
                                                            إجازة سنوي
                                                        </span>
                                                    ) : row.statusLabel === 'إجازة عارضة' ? (
                                                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', backgroundColor: '#fef3c7', color: '#92400e', fontSize: '11px' }}>
                                                            إجازة عارضة
                                                        </span>
                                                    ) : row.statusLabel === 'غياب بإذن' ? (
                                                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', backgroundColor: '#f3e8ff', color: '#6b21a8', fontSize: '11px' }}>
                                                            غياب بإذن
                                                        </span>
                                                    ) : row.statusLabel && row.statusLabel !== 'لا' ? (
                                                        <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '12px', backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '11px' }}>
                                                            {row.statusLabel}
                                                        </span>
                                                    ) : (
                                                        <span style={{ display: 'inline-block', padding: '3px 12px', borderRadius: '12px', backgroundColor: '#fee2e2', color: '#991b1b', fontSize: '11px' }}>
                                                            لا
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>

                            {/* Footer */}
                            <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
                                <div>سوفت روز للمنتجات الورقية - التقرير معتمد إلكترونياً</div>
                                <div>صفحة {pageIdx + 1} من {pagesOfFaqdResults.length}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            )}

            {/* Hidden Printable Container for Target PDF */}
            {(showCurrentTargetsModal || showPastTargetsModal || showTargetModal) && (
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                <div 
                    ref={targetPdfPrintContainerRef} 
                    style={{ 
                        width: '1400px', 
                        background: '#ffffff', 
                        color: '#111827', 
                        direction: 'rtl', 
                        fontFamily: 'Cairo, Tajawal, sans-serif',
                        display: 'none'
                    }}
                >
                    {pagesOfTargetResults.map((pageRows, pageIdx) => {
                        const totalTarget = targetItemsForExport.reduce((sum, item) => sum + (Number(item.targetAmount) || 0), 0);
                        const totalAchieved = targetItemsForExport.reduce((sum, item) => sum + (Number(item.achievedAmount) || 0), 0);
                        const totalPerc = totalTarget > 0 ? ((totalAchieved / totalTarget) * 100).toFixed(1) : "0.0";
                        const reportTitle = selectedTargetMonth === 'current' 
                            ? 'تقرير تارجت ومبيعات الشهر الحالي' 
                            : `تقرير أرشيف التارجت لشهر ${selectedTargetMonth}`;

                        return (
                            <div 
                                key={`target-page-${pageIdx}`}
                                className="target-pdf-page"
                                style={{
                                    width: '1400px',
                                    minHeight: '990px',
                                    padding: '30px 36px',
                                    boxSizing: 'border-box',
                                    backgroundColor: '#ffffff',
                                    position: 'relative',
                                    pageBreakAfter: 'always',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                {/* Header */}
                                <div style={{ borderBottom: '2px solid #ea580c', paddingBottom: '16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#9a3412' }}>سوفت روز للمنتجات الورقية</div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#1f2937', marginTop: '4px' }}>{reportTitle}</div>
                                    </div>
                                    <div style={{ textAlign: 'left', fontSize: '12px', color: '#6b7280', lineHeight: '1.6' }}>
                                        <div><strong>الموظف:</strong> {targetPrintEmployee || 'جميع الحسابات'}</div>
                                        <div><strong>الشهر:</strong> {selectedTargetMonth === 'current' ? `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}` : selectedTargetMonth}</div>
                                        <div><strong>تاريخ الطباعة:</strong> {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                                        <div><strong>الصفحة:</strong> {pageIdx + 1} من {pagesOfTargetResults.length}</div>
                                    </div>
                                </div>

                                {/* Summary badges on first page */}
                                {pageIdx === 0 && (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '20px' }}>
                                        <div style={{ background: '#fefce8', border: '1px solid #fef08a', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '11px', color: '#854d0e', fontWeight: 'bold' }}>إجمالي التارجت</div>
                                            <div style={{ fontSize: '20px', fontWeight: '900', color: '#713f12', marginTop: '2px' }}>{totalTarget.toLocaleString()}</div>
                                        </div>
                                        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '11px', color: '#047857', fontWeight: 'bold' }}>إجمالي المحقق</div>
                                            <div style={{ fontSize: '20px', fontWeight: '900', color: '#065f46', marginTop: '2px' }}>{totalAchieved.toLocaleString()}</div>
                                        </div>
                                        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 'bold' }}>متوسط النسبة</div>
                                            <div style={{ fontSize: '20px', fontWeight: '900', color: '#1e40af', marginTop: '2px' }}>{totalPerc}%</div>
                                        </div>
                                    </div>
                                )}

                                {/* Table with Repeating Headers */}
                                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center', fontSize: '12px' }}>
                                    <thead>
                                        <tr style={{ backgroundColor: '#c2410c', color: '#ffffff' }}>
                                            <th style={{ padding: '10px 8px', border: '1px solid #c2410c', width: '50px' }}>م</th>
                                            <th style={{ padding: '10px 14px', border: '1px solid #c2410c', textAlign: 'right' }}>الاسم والفروع</th>
                                            <th style={{ padding: '10px 12px', border: '1px solid #c2410c', width: '150px' }}>التارجت</th>
                                            <th style={{ padding: '10px 12px', border: '1px solid #c2410c', width: '150px' }}>المحقق</th>
                                            <th style={{ padding: '10px 12px', border: '1px solid #c2410c', width: '130px' }}>النسبة</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {pageRows.map((item, rIdx) => {
                                            const globalIdx = (pageIdx * 10) + rIdx + 1;
                                            const isEven = rIdx % 2 === 1;
                                            const percVal = item.targetAmount > 0 ? ((item.achievedAmount / item.targetAmount) * 100).toFixed(1) : "0.0";
                                            const percNum = parseFloat(percVal) || 0;
                                            const rawMarkets = item.activeMarkets || item.market || '';
                                            const marketList = rawMarkets.split(/[،,]/).map((m: string) => m.trim()).filter(Boolean);

                                            return (
                                                <tr key={rIdx} style={{ backgroundColor: isEven ? '#fafaf9' : '#ffffff' }}>
                                                    <td style={{ padding: '12px 8px', border: '1px solid #e5e7eb', color: '#6b7280', verticalAlign: 'top', fontSize: '13px' }}>
                                                        {globalIdx}
                                                    </td>
                                                    <td style={{ padding: '12px 14px', border: '1px solid #e5e7eb', textAlign: 'right', verticalAlign: 'top' }}>
                                                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#111827', wordBreak: 'break-word', whiteSpace: 'normal', lineHeight: '1.4' }}>
                                                            {item.employeeName}
                                                        </div>
                                                        <div style={{ marginTop: '6px', fontSize: '12px', color: '#1d4ed8', wordBreak: 'break-word', whiteSpace: 'normal' }}>
                                                            <span style={{ color: '#6b7280', fontWeight: 'bold', display: 'block', fontSize: '11px', marginBottom: '2px' }}>الفروع:</span>
                                                            {marketList.length > 0 ? (
                                                                marketList.map((m: string, mIdx: number) => (
                                                                    <div key={mIdx} style={{ lineHeight: '1.6', color: '#1e40af', paddingRight: '4px' }}>
                                                                        • {m}
                                                                    </div>
                                                                ))
                                                            ) : (
                                                                <span style={{ color: '#9ca3af' }}>غير محدد</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '12px 12px', border: '1px solid #e5e7eb', color: '#854d0e', fontWeight: 'bold', fontSize: '14px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                                        {(Number(item.targetAmount) || 0).toLocaleString()}
                                                    </td>
                                                    <td style={{ padding: '12px 12px', border: '1px solid #e5e7eb', color: '#166534', fontWeight: 'bold', fontSize: '14px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                                        {(Number(item.achievedAmount) || 0).toLocaleString()}
                                                    </td>
                                                    <td style={{ padding: '12px 12px', border: '1px solid #e5e7eb', fontWeight: 'bold', fontSize: '13px', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                                        <span style={{
                                                            display: 'inline-block',
                                                            padding: '4px 12px',
                                                            borderRadius: '12px',
                                                            backgroundColor: percNum >= 100 ? '#dcfce7' : percNum >= 80 ? '#e0f2fe' : '#fef3c7',
                                                            color: percNum >= 100 ? '#15803d' : percNum >= 80 ? '#0369a1' : '#b45309'
                                                        }}>
                                                            {percVal}%
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* Footer */}
                                <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#9ca3af' }}>
                                    <div>سوفت روز للمنتجات الورقية - التقرير معتمد إلكترونياً</div>
                                    <div>صفحة {pageIdx + 1} من {pagesOfTargetResults.length}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
            )}

            {/* مودال الأداء (شاشة الأداء) */}
            {showPerformanceModal && (
                <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-5 overflow-y-auto">
                    <div 
                        id="performance-modal-capture-area"
                        className="bg-gray-900 border border-white/20 w-full max-w-4xl rounded-3xl p-4 sm:p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[95vh] my-auto overflow-hidden text-right"
                    >
                        {/* Header */}
                        <div className="flex justify-between items-center pb-3 sm:pb-4 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <TrendingUp className="text-emerald-400 shrink-0" size={26} />
                                <div>
                                    <h3 className="font-bold text-lg sm:text-2xl text-white">تقرير ومعدل الأداء</h3>
                                    <div className="text-[11px] sm:text-xs text-emerald-400 font-bold mt-0.5">
                                        الموظف: <span className="text-white">{perfEmployee === 'all' ? 'جميع الموظفين' : perfEmployee}</span> | الفترة: <span className="text-white">من 1/1/{selectedPerfYear} حتى نهاية {monthNamesAr[perfEndMonth]}</span>
                                    </div>
                                </div>
                            </div>
                            <button 
                                data-html2canvas-ignore="true"
                                onClick={() => setShowPerformanceModal(false)} 
                                className="text-white/60 hover:text-white p-1 rounded-full transition cursor-pointer"
                                title="إغلاق"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {/* الفلاتر: اختيار الموظف والعام والفترة المستعلم عنها في سطر واحد بدون اختفاء أي بيانات */}
                        <div data-html2canvas-ignore="true" className="grid grid-cols-3 gap-1.5 sm:gap-3 my-2.5 sm:my-3.5 shrink-0">
                            <div className="min-w-0">
                                <label className="block text-[9px] sm:text-[11px] font-bold text-gray-300 mb-0.5 sm:mb-1 truncate" title="اسم الموظف (المسجل لهم مبيعات فقط)">
                                    <span className="hidden sm:inline">اسم الموظف (المسجل لهم مبيعات فقط):</span>
                                    <span className="sm:hidden">الموظف:</span>
                                </label>
                                <select 
                                    className="w-full p-1.5 sm:p-2.5 rounded-xl bg-gray-800 text-white border border-white/10 text-[10px] sm:text-xs font-bold outline-none cursor-pointer truncate"
                                    value={perfEmployee} 
                                    onChange={e => setPerfEmployee(e.target.value)}
                                >
                                    <option value="all">الكل (جميع الموظفين المسجل لهم مبيعات)</option>
                                    {employeesWithSales.map(name => (
                                        <option key={name} value={name}>{name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="min-w-0">
                                <label className="block text-[9px] sm:text-[11px] font-bold text-gray-300 mb-0.5 sm:mb-1 truncate" title="العام (من 1/1)">
                                    <span className="hidden sm:inline">العام (من 1/1):</span>
                                    <span className="sm:hidden">العام:</span>
                                </label>
                                <select 
                                    className="w-full p-1.5 sm:p-2.5 rounded-xl bg-gray-800 text-white border border-white/10 text-[10px] sm:text-xs font-bold outline-none cursor-pointer truncate"
                                    value={perfYearMode} 
                                    onChange={e => {
                                        const mode = e.target.value as any;
                                        setPerfYearMode(mode);
                                        if (mode === 'current') {
                                            setPerfEndMonth(new Date().getMonth());
                                        } else {
                                            setPerfEndMonth(11);
                                        }
                                    }}
                                >
                                    <option value="current">من بداية العام الحالي ({currentYear}) من 1/1</option>
                                    <option value="previous">العام السابق ({currentYear - 1}) من 1/1</option>
                                </select>
                            </div>

                            <div className="min-w-0">
                                <label className="block text-[9px] sm:text-[11px] font-bold text-gray-300 mb-0.5 sm:mb-1 truncate" title="حتى نهاية شهر (الفترة المستعلم عنها)">
                                    <span className="hidden sm:inline">حتى نهاية شهر (الفترة المستعلم عنها):</span>
                                    <span className="sm:hidden">نهاية الشهر:</span>
                                </label>
                                <select 
                                    className="w-full p-1.5 sm:p-2.5 rounded-xl bg-gray-800 text-white border border-white/10 text-[10px] sm:text-xs font-bold outline-none cursor-pointer truncate"
                                    value={perfEndMonth} 
                                    onChange={e => setPerfEndMonth(Number(e.target.value))}
                                >
                                    {monthNamesAr.map((name, idx) => (
                                        <option key={idx} value={idx}>حتى نهاية {name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1 pl-1" id="performance-scroll-area">
                            {performanceReportData.isAll ? (
                                /* عرض الكل: ملخص شامل وجدول مقارنة لجميع الموظفين */
                                <div className="space-y-4">
                                    {/* ملخص إجمالي الشركة */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                                        <div className="bg-blue-950/40 border border-blue-500/20 p-3 rounded-2xl text-center">
                                            <div className="text-[11px] text-blue-300 font-bold mb-1">إجمالي المبيعات</div>
                                            <div className="text-base sm:text-xl font-black text-white">{(performanceReportData.companyTotalAchieved || 0).toLocaleString()} <span className="text-xs opacity-60">ج.م</span></div>
                                        </div>
                                        <div className="bg-purple-950/40 border border-purple-500/20 p-3 rounded-2xl text-center">
                                            <div className="text-[11px] text-purple-300 font-bold mb-1">إجمالي التارجت</div>
                                            <div className="text-base sm:text-xl font-black text-white">{(performanceReportData.companyTotalTarget || 0).toLocaleString()} <span className="text-xs opacity-60">ج.م</span></div>
                                        </div>
                                        <div className="bg-emerald-950/40 border border-emerald-500/20 p-3 rounded-2xl text-center">
                                            <div className="text-[11px] text-emerald-300 font-bold mb-1">تحقيق تارجت المبيعات</div>
                                            <div className="text-base sm:text-xl font-black text-emerald-400">{performanceReportData.companyOverallSalesRate}%</div>
                                        </div>
                                        <div className="bg-amber-950/40 border border-amber-500/20 p-3 rounded-2xl text-center">
                                            <div className="text-[11px] text-amber-300 font-bold mb-1">متوسط التقييم العام</div>
                                            <div className="text-base sm:text-xl font-black text-amber-400">{performanceReportData.avgFinalScore}% <span className="text-xs opacity-60">من 100</span></div>
                                        </div>
                                    </div>

                                    {/* جدول مبيعات أشهر السنة مجمعة حتى الشهر المحدد */}
                                    <div className="bg-gray-800/60 border border-white/10 rounded-2xl p-3 sm:p-4">
                                        <h4 className="text-xs sm:text-sm font-bold text-white mb-3 flex items-center gap-1.5">
                                            <Calendar size={16} className="text-blue-400" /> مبيعات الأشهر حتى نهاية {monthNamesAr[perfEndMonth]} لعام {selectedPerfYear}:
                                        </h4>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                            {(performanceReportData.companyMonthly || []).map(m => (
                                                <div key={m.monthIdx} className={`p-2.5 rounded-xl border ${m.hasSales ? 'bg-gray-900/80 border-white/5' : 'bg-gray-900/30 border-white/5 opacity-60'}`}>
                                                    <div className="flex justify-between items-center text-xs font-bold text-white/80 mb-1">
                                                        <span>{m.month}</span>
                                                        {m.hasSales ? (
                                                            <span className={m.rate >= 100 ? 'text-emerald-400' : m.rate >= 80 ? 'text-blue-400' : 'text-amber-400'}>{m.rate}%</span>
                                                        ) : (
                                                            <span className="text-[10px] text-gray-400">لم تسجل مبيعات</span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs font-black text-white">{(m.achieved || 0).toLocaleString()} ج.م</div>
                                                    <div className="text-[10px] text-white/50">{m.hasSales ? `تارجت: ${(m.target || 0).toLocaleString()} ج.م` : 'مستثنى'}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* جدول مقارنة وتقييم أداء كل موظف */}
                                    <div className="bg-gray-800/60 border border-white/10 rounded-2xl p-3 sm:p-4 overflow-x-auto">
                                        <h4 className="text-xs sm:text-sm font-bold text-white mb-3 flex items-center gap-1.5">
                                            <Trophy size={16} className="text-amber-400" /> تقييم ومعدل أداء الموظفين التفصيلي (الفترة من 1/1 حتى نهاية {monthNamesAr[perfEndMonth]}):
                                        </h4>
                                        <table className="w-full text-xs text-center border-collapse">
                                            <thead className="bg-white/5 text-white/60">
                                                <tr>
                                                    <th className="py-2.5 px-3 text-right">اسم الموظف</th>
                                                    <th className="py-2.5 px-2">إجمالي المبيعات</th>
                                                    <th className="py-2.5 px-2">التارجت</th>
                                                    <th className="py-2.5 px-2">نسبة التحقيق</th>
                                                    <th className="py-2.5 px-2">الأشهر المقيمة</th>
                                                    <th className="py-2.5 px-2">الإجازات (سنوي/عارضة/امتحانات)</th>
                                                    <th className="py-2.5 px-2">الجزاءات</th>
                                                    <th className="py-2.5 px-3 font-black text-emerald-400">التقييم العام (من 100%)</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5 text-white">
                                                {(performanceReportData.employeesList || []).map((emp, idx) => (
                                                    <tr key={idx} className="hover:bg-white/5 transition">
                                                        <td className="py-2.5 px-3 text-right font-bold text-white">{emp.empName}</td>
                                                        <td className="py-2.5 px-2 font-black text-blue-300">{(emp.totalAchieved || 0).toLocaleString()} ج.م</td>
                                                        <td className="py-2.5 px-2 text-white/60">{(emp.totalTarget || 0).toLocaleString()} ج.م</td>
                                                        <td className="py-2.5 px-2 font-bold">
                                                            <span className={`px-2 py-0.5 rounded-full text-[11px] ${emp.overallSalesRate >= 100 ? 'bg-emerald-500/20 text-emerald-300' : emp.overallSalesRate >= 80 ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'}`}>
                                                                {emp.overallSalesRate}%
                                                            </span>
                                                        </td>
                                                        <td className="py-2.5 px-2 text-[11px] text-white/70 font-medium">
                                                            {emp.evaluatedMonthsCount} من {emp.totalMonthsQueried}
                                                        </td>
                                                        <td className="py-2.5 px-2 text-xs text-white/80">
                                                            سنوي: {emp.leaves.annualUsed} | عارضة: {emp.leaves.casualUsed} | امتحانات: {emp.leaves.examsUsed}
                                                        </td>
                                                        <td className="py-2.5 px-2">
                                                            {emp.leaves.penaltiesCount > 0 ? (
                                                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-500/20 text-red-300">
                                                                    {emp.leaves.penaltiesCount} جزاء
                                                                </span>
                                                            ) : (
                                                                <span className="text-white/40">0</span>
                                                            )}
                                                        </td>
                                                        <td className="py-2.5 px-3 font-black text-emerald-400 text-sm">
                                                            {emp.finalScore}%
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ) : (
                                /* عرض موظف محدد: مبيعات الأشهر ملونة وبجانب بعض + تقييم مبيعات منفرد + رصيد إجازات وجزاءات بجانب بعض + تقييم انضباط منفرد + تقييم عام شامل */
                                performanceReportData.single && (
                                    <div className="space-y-4">
                                        {/* 1. مبيعات كل شهر منفصل عن الآخر ملونة بجانب بعض وليس أسفل بعض */}
                                        <div className="bg-gray-800/60 border border-white/10 rounded-2xl p-3 sm:p-4">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
                                                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                                                    <Calendar size={16} className="text-blue-400 shrink-0" /> مبيعات الأشهر لـ ({performanceReportData.single.empName}) حتى نهاية {monthNamesAr[perfEndMonth]}:
                                                </h4>
                                                <span className="text-[11px] text-emerald-400 font-semibold">
                                                    الأشهر المحتسبة في التقييم: {performanceReportData.single.evaluatedMonthsCount} من {performanceReportData.single.totalMonthsQueried} شهر
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                                {performanceReportData.single.monthlyBreakdown.map(m => (
                                                    <div 
                                                        key={m.monthIdx} 
                                                        className={`border p-2.5 sm:p-3 rounded-xl space-y-1 transition ${
                                                            !m.hasSales 
                                                                ? 'bg-gray-900/40 border-white/5 opacity-60' 
                                                                : m.rate >= 100 
                                                                ? 'bg-emerald-950/30 border-emerald-500/30' 
                                                                : m.rate >= 80 
                                                                ? 'bg-blue-950/30 border-blue-500/30' 
                                                                : 'bg-amber-950/30 border-amber-500/30'
                                                        }`}
                                                    >
                                                        <div className="flex justify-between items-center text-xs font-bold text-white/90">
                                                            <span>{m.month}</span>
                                                            {m.hasSales ? (
                                                                <span className={`text-[11px] font-black ${m.rate >= 100 ? 'text-emerald-400' : m.rate >= 80 ? 'text-blue-400' : 'text-amber-400'}`}>
                                                                    {Math.round(m.rate * 10) / 10}%
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-gray-400 font-bold bg-white/5 px-1.5 py-0.5 rounded">
                                                                    لم تسجل مبيعات
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-sm font-black text-white">
                                                            {(m.achieved || 0).toLocaleString()} <span className="text-[10px] opacity-60">ج.م</span>
                                                        </div>
                                                        <div className="text-[10px] text-white/50">
                                                            {m.hasSales ? `تارجت: ${(m.target || 0).toLocaleString()} ج.م` : 'مستثنى من التقييم'}
                                                        </div>
                                                        {m.hasSales && (
                                                            <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mt-1">
                                                                <div 
                                                                    className={`h-full rounded-full ${m.rate >= 100 ? 'bg-emerald-500' : m.rate >= 80 ? 'bg-blue-500' : 'bg-amber-500'}`} 
                                                                    style={{ width: `${Math.min(100, m.rate)}%` }}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 2. التقييم العام على الأداء في المبيعات بنسبة مئوية من تحقيق التارجت (منفرد) */}
                                        <div className="bg-blue-950/30 border border-blue-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                            <div>
                                                <div className="text-xs font-bold text-blue-300 uppercase mb-1 flex items-center gap-1.5">
                                                    <TrendingUp size={15} /> تقييم الأداء في المبيعات (تحقيق التارجت للأشهر المقيمة - منفرد)
                                                </div>
                                                <div className="text-xs sm:text-sm text-white/80 space-y-0.5">
                                                    <div>
                                                        إجمالي المبيعات المحققة: <strong className="text-white text-base">{(performanceReportData.single.totalAchieved || 0).toLocaleString()} ج.م</strong> | إجمالي التارجت: <strong className="text-white text-base">{(performanceReportData.single.totalTarget || 0).toLocaleString()} ج.م</strong>
                                                    </div>
                                                    <div className="text-[11px] text-blue-300/80">
                                                        الأشهر المقيمة: <strong>{performanceReportData.single.evaluatedMonthsCount}</strong> من أصل {performanceReportData.single.totalMonthsQueried} شهر (تم تجاهل واستثناء الأشهر التي لم يسجل بها مبيعات ليظهر التقييم صحيحاً).
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-center sm:text-left bg-blue-500/20 border border-blue-400/30 px-5 py-2.5 rounded-2xl shrink-0">
                                                <div className="text-[10px] font-bold text-blue-300">نسبة تحقيق التارجت</div>
                                                <div className="text-2xl font-black text-white">{performanceReportData.single.overallSalesRate}%</div>
                                                <div className="text-[10px] text-blue-200">الدرجة: {performanceReportData.single.salesScore} / 70</div>
                                            </div>
                                        </div>

                                        {/* 3. استعلام رصيد الإجازات والغياب والجزاءات للموظف المختار (في مربعات بجانب بعض بشكل واضح) */}
                                        <div className="bg-gray-800/60 border border-white/10 rounded-2xl p-4">
                                            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
                                                <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                                                    <Clock size={16} className="text-amber-400" /> استعلام رصيد الإجازات والغياب والجزاءات للموظف (مربعات واضحة):
                                                </h4>
                                                <span className="text-[11px] text-white/50">من خانة رصيد إجازات</span>
                                            </div>
                                            <div className={`grid grid-cols-2 ${performanceReportData.single.leaves.summerUsed > 0 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-2.5`}>
                                                <div className="bg-green-950/30 border border-green-500/30 p-3 rounded-xl text-center">
                                                    <div className="text-[11px] text-green-400 font-bold mb-1">الإجازات (سنوي وعارض)</div>
                                                    <div className="text-xs text-white">المستهلك: <strong>{performanceReportData.single.leaves.annualUsed + performanceReportData.single.leaves.casualUsed}</strong> يوم</div>
                                                    <div className="text-[11px] text-white/60 mt-0.5">المتبقي: {performanceReportData.single.leaves.annualRemaining + performanceReportData.single.leaves.casualRemaining} يوم</div>
                                                </div>

                                                {performanceReportData.single.leaves.summerUsed > 0 && (
                                                    <div className="bg-teal-950/30 border border-teal-500/30 p-3 rounded-xl text-center">
                                                        <div className="text-[11px] text-teal-400 font-bold mb-1">إجازات المصيف</div>
                                                        <div className="text-xs text-white font-black">{performanceReportData.single.leaves.summerUsed} يوم</div>
                                                        <div className="text-[10px] text-white/50 mt-0.5">أيام المصيف</div>
                                                    </div>
                                                )}

                                                <div className="bg-purple-950/30 border border-purple-500/30 p-3 rounded-xl text-center">
                                                    <div className="text-[11px] text-purple-400 font-bold mb-1">إجازات الامتحانات</div>
                                                    <div className="text-xs text-white font-black">{performanceReportData.single.leaves.examsUsed} يوم</div>
                                                    <div className="text-[10px] text-white/50 mt-0.5">معتمدة رسمياً</div>
                                                </div>

                                                <div className="bg-red-950/30 border border-red-500/30 p-3 rounded-xl text-center">
                                                    <div className="text-[11px] text-red-400 font-bold mb-1">الجزاءات والغياب</div>
                                                    <div className={`text-xs font-black ${performanceReportData.single.leaves.penaltiesCount > 0 ? 'text-red-400' : 'text-white'}`}>
                                                        {performanceReportData.single.leaves.penaltiesCount} جزاء
                                                    </div>
                                                    <div className="text-[10px] text-white/50 mt-0.5">غياب بإذن: {performanceReportData.single.leaves.unpaidUsed} يوم</div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* 4. تقييم الانضباط والإجازات والغياب (منفرد) */}
                                        <div className="bg-purple-950/30 border border-purple-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                                            <div>
                                                <div className="text-xs font-bold text-purple-300 uppercase mb-1 flex items-center gap-1.5">
                                                    <Clock size={15} /> تقييم الانضباط ورصيد الإجازات والغياب (منفرد)
                                                </div>
                                                <div className="text-xs sm:text-sm text-white/80 space-y-0.5">
                                                    <div>مدى الالتزام بالحضور وعدم تكرار الجزاءات أو الغياب بإذن خلال الفترة المستعلم عنها.</div>
                                                    <div className="text-[11px] text-purple-300/80">
                                                        الجزاءات المسجلة: <strong>{performanceReportData.single.leaves.penaltiesCount}</strong> | أيام الغياب بإذن: <strong>{performanceReportData.single.leaves.unpaidUsed}</strong>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-center sm:text-left bg-purple-500/20 border border-purple-400/30 px-5 py-2.5 rounded-2xl shrink-0">
                                                <div className="text-[10px] font-bold text-purple-300">نسبة الانضباط</div>
                                                <div className="text-2xl font-black text-white">{performanceReportData.single.disciplineRate}%</div>
                                                <div className="text-[10px] text-purple-200">الدرجة: {performanceReportData.single.disciplineScore} / 30</div>
                                            </div>
                                        </div>

                                        {/* 5. التقييم العام الشامل بنسبة مئوية دقيقة كام من مائة (منفرد وبارز) */}
                                        <div className="bg-emerald-950/30 border-2 border-emerald-500/40 rounded-2xl p-4 sm:p-5 text-center space-y-2">
                                            <div 
                                                className="text-xs sm:text-sm font-bold text-emerald-400"
                                                style={{ letterSpacing: '0px' }}
                                            >
                                                التقييم العام الشامل لمعدل الأداء والانضباط (كام من مائة)
                                            </div>
                                            <div className="text-4xl sm:text-5xl font-black text-emerald-400">
                                                {performanceReportData.single.finalScore}%
                                            </div>
                                            <div className="text-xs text-white/80 max-w-md mx-auto" style={{ letterSpacing: '0px' }}>
                                                تقييم متكامل يجمع بين نسبة تحقيق تارجت المبيعات المسجلة للأشهر النشطة (70 نقطة) ونسبة الانضباط والالتزام بعدم الجزاءات والاستعلام عن رصيد الإجازات بدقة (30 نقطة).
                                            </div>
                                            <div className="pt-1">
                                                <span 
                                                    className={`inline-block px-4 py-1 rounded-full text-xs font-black border ${performanceReportData.single.ratingBg}`}
                                                    style={{ letterSpacing: '0px' }}
                                                >
                                                    {performanceReportData.single.ratingGrade}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            )}
                        </div>

                        {/* Footer: Export Buttons */}
                        <div 
                            data-html2canvas-ignore="true"
                            className="grid grid-cols-3 gap-1.5 sm:gap-3 pt-3 border-t border-white/10 shrink-0"
                        >
                            <button 
                                onClick={handleExportPerformanceExcel}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 sm:py-2.5 px-1 sm:px-3 rounded-xl transition shadow-lg active:scale-95 flex items-center justify-center gap-1 sm:gap-2 text-[11px] sm:text-sm cursor-pointer whitespace-nowrap min-w-0"
                                title="تصدير تقرير الأداء إكسيل"
                            >
                                <FileSpreadsheet size={15} className="shrink-0" /> 
                                <span className="truncate">إكسيل</span>
                            </button>
                            <button 
                                onClick={handlePrintPerformancePDF}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 sm:py-2.5 px-1 sm:px-3 rounded-xl transition shadow-lg active:scale-95 flex items-center justify-center gap-1 sm:gap-2 text-[11px] sm:text-sm cursor-pointer whitespace-nowrap min-w-0"
                                title="تصدير PDF / طباعة"
                            >
                                <Printer size={15} className="shrink-0" /> 
                                <span className="truncate">PDF</span>
                            </button>
                            <button 
                                onClick={() => setShowPerfImageQualityModal(true)}
                                disabled={isExportingPerfImage}
                                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 sm:py-2.5 px-1 sm:px-3 rounded-xl transition shadow-lg active:scale-95 flex items-center justify-center gap-1 sm:gap-2 text-[11px] sm:text-sm cursor-pointer disabled:opacity-50 whitespace-nowrap min-w-0"
                                title="تصدير كـ صورة"
                            >
                                <ImageIcon size={15} className="shrink-0" /> 
                                <span className="truncate">{isExportingPerfImage ? 'انتظار...' : 'صورة'}</span>
                            </button>
                        </div>
                    </div>

                    {/* مودال منبثق لاختيار جودة تصدير الصورة */}
                    {showPerfImageQualityModal && (
                        <div 
                            data-html2canvas-ignore="true"
                            className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
                        >
                            <div className="bg-gray-900 border border-white/20 rounded-3xl max-w-md w-full p-5 sm:p-6 text-white shadow-2xl relative space-y-4 text-right">
                                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
                                            <ImageIcon size={22} />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-base sm:text-lg text-white">تصدير تقرير الأداء كصورة</h3>
                                            <p className="text-[11px] text-white/60">اختر دقة وجودة الصورة المطلوبة للتحميل</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => setShowPerfImageQualityModal(false)}
                                        disabled={isExportingPerfImage}
                                        className="p-1.5 hover:bg-white/10 rounded-full text-white/70 hover:text-white transition cursor-pointer"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>

                                <div className="space-y-3 pt-1">
                                    {/* زر 1: تصدير بأعلى جودة */}
                                    <button
                                        onClick={() => handleExportPerformanceImage('ultra')}
                                        disabled={isExportingPerfImage}
                                        className="w-full text-right p-4 rounded-2xl bg-gradient-to-r from-indigo-950/60 to-purple-950/60 hover:from-indigo-900/80 hover:to-purple-900/80 border-2 border-indigo-500/40 hover:border-indigo-400 transition cursor-pointer group shadow-lg active:scale-[0.98] disabled:opacity-50"
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2 font-black text-sm sm:text-base text-indigo-300 group-hover:text-white">
                                                <Sparkles size={18} className="text-amber-400" />
                                                <span>تصدير بأعلى جودة (Ultra HD)</span>
                                            </div>
                                            <span className="text-[10px] bg-indigo-500/30 text-indigo-200 font-bold px-2 py-0.5 rounded-full border border-indigo-400/30">
                                                أعلى دقة
                                            </span>
                                        </div>
                                        <p className="text-xs text-white/70 leading-relaxed pr-6">
                                            تحميل الصورة بأعلى جودة ودقة يمكن الوصول إليها، كاملة التفاصيل والحواف ونقاء فائق، مناسبة للطباعة والعرض المكتبي.
                                        </p>
                                        {perfImageQualityLoading === 'ultra' && (
                                            <div className="mt-2.5 flex items-center gap-2 text-xs text-amber-300 font-bold pr-6">
                                                <Loader2 size={15} className="animate-spin" /> جاري استخراج وتحميل الصورة بأعلى جودة...
                                            </div>
                                        )}
                                    </button>

                                    {/* زر 2: تحميل بجودة عادية مناسبة للهاتف */}
                                    <button
                                        onClick={() => handleExportPerformanceImage('normal')}
                                        disabled={isExportingPerfImage}
                                        className="w-full text-right p-4 rounded-2xl bg-gray-800/80 hover:bg-gray-800 border border-white/10 hover:border-white/30 transition cursor-pointer group shadow active:scale-[0.98] disabled:opacity-50"
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <div className="flex items-center gap-2 font-bold text-sm sm:text-base text-white group-hover:text-blue-300">
                                                <Smartphone size={18} className="text-blue-400" />
                                                <span>تحميل كـ صورة (جودة عادية مناسبة للهاتف)</span>
                                            </div>
                                            <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-400/20">
                                                حجم خفيف وسريع
                                            </span>
                                        </div>
                                        <p className="text-xs text-white/70 leading-relaxed pr-6">
                                            تحميل الصورة بجودة عادية وحجم خفيف وسريع، سهلة ومثالية للمشاركة عبر الهاتف وتطبيقات المراسلة والواتساب.
                                        </p>
                                        {perfImageQualityLoading === 'normal' && (
                                            <div className="mt-2.5 flex items-center gap-2 text-xs text-blue-300 font-bold pr-6">
                                                <Loader2 size={15} className="animate-spin" /> جاري تجهيز وتحميل الصورة للهاتف...
                                            </div>
                                        )}
                                    </button>
                                </div>

                                <div className="pt-2 flex justify-end">
                                    <button
                                        onClick={() => setShowPerfImageQualityModal(false)}
                                        disabled={isExportingPerfImage}
                                        className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white/80 hover:text-white text-xs font-bold transition cursor-pointer"
                                    >
                                        إلغاء
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};

export default SalesLog;

