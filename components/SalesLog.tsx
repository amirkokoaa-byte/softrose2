import { onCachedValue } from "../firebaseCache";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { ref, onValue, remove, update, get, set, push } from "firebase/database";
import { User, SaleRecord, ProductItem, UserTarget, TargetHistory } from '../types';
import { 
    Trash2, Edit, FileSpreadsheet, Save, X, Calendar, User as UserIcon, TrendingUp, Star, Trophy, Download, Filter, Target, History, Copy, Search, Package, ShoppingBag, Calculator, ChevronDown, ChevronUp, Printer, ThumbsUp, ThumbsDown, MessageSquare, Send, Heart
} from 'lucide-react';
import { PRODUCTS_FACIAL, PRODUCTS_KITCHEN, PRODUCTS_TOILET, PRODUCTS_DOLPHIN } from '../constants';
import { exportToCSV } from '../utils';
import { Share2, FileDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';

interface Props {
    user: User;
    markets: string[];
    theme: string;
    products: ProductItem[];
}

const SalesLog: React.FC<Props> = ({ user, markets, theme, products }) => {
    const [sales, setSales] = useState<SaleRecord[]>([]);

    const [commentText, setCommentText] = useState<{[key: string]: string}>({});
    const [showCommentInput, setShowCommentInput] = useState<{[key: string]: boolean}>({});

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

    const handleAddComment = async (saleId: string) => {
        const text = commentText[saleId]?.trim();
        if (!text) return;
        
        const sale = sales.find(s => s.id === saleId);
        if (!sale) return;
        
        const newComment = {
            id: Date.now().toString(),
            text,
            senderId: user.username || user.name,
            senderName: user.name,
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
                message: `أضاف ${user.name} تعليقاً على مبيعاتك في ${sale.market}`,
                sender: user.name,
                timestamp: Date.now(),
                isRead: false
            });
        }
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
    const [usersList, setUsersList] = useState<User[]>([]);
    const [filterDate, setFilterDate] = useState('');
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
    const [reportStart, setReportStart] = useState('');
    const [reportEnd, setReportEnd] = useState('');

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

    useEffect(() => {
        let unsubUsers, unsubTargets, unsubHistory;
        const unsubSales = onCachedValue(ref(db, 'sales'), 'sales', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                let loadedSales: SaleRecord[] = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                if (user.role !== 'admin' && !user.canViewAllSales) {
                    loadedSales = loadedSales.filter(s => s.employeeName === user.name);
                }
                setSales(loadedSales.sort((a, b) => b.timestamp - a.timestamp));
            } else { setSales([]); }
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

    useEffect(() => {
        let result = sales;
        if (filterDate) result = result.filter(s => s.date.includes(filterDate));
        if (filterEmployee) result = result.filter(s => s.employeeName.includes(filterEmployee));
        if (filterMarket) result = result.filter(s => s.market === filterMarket);
        setFilteredSales(result);
    }, [sales, filterDate, filterEmployee, filterMarket]);

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

    // حساب نتائج تقرير مبيعات الأصناف
    const reportResults = useMemo<{ 
        totalQty: number; 
        totalValue: number; 
        itemsGrouped: Record<string, { price: number; qty: number; total: number }>;
        categoryGrouped: Record<string, number>;
    }>(() => {
        let results = sales;
        if (reportMarket !== 'all') results = results.filter(s => s.market === reportMarket);
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
                    const prod = products.find(p => normalizeName(p.name) === nName);
                    const cat = prod?.category || 'Uncategorized';
                    if (!categoryGrouped[cat]) categoryGrouped[cat] = 0;
                    categoryGrouped[cat] += (i.qty * i.price);
                }
            });
        });

        return { totalQty, totalValue, itemsGrouped, categoryGrouped };
    }, [sales, reportItem, reportMarket, reportStart, reportEnd, products]);

    
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
                return (nameMatches || userMatches) && s.timestamp >= start && s.timestamp <= end;
            });
            const activeMarkets = Array.from(new Set(employeeSales.map(s => s.market))).sort().join('، ');

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
            <>
                {finalTargets.map((t, idx) => {
                    const perc = t.finalTarget > 0 ? ((t.achieved / t.finalTarget) * 100).toFixed(1) : 0;
                    return (
                        <div key={t.userId ? `target-${t.userId}-${idx}` : `target-${t.employeeName || idx}-${idx}`} className="bg-black/30 border border-white/5 p-4 rounded-2xl">
                            <div className="flex justify-between items-center mb-2">
                                <div>
                                    <div className="font-bold text-white text-lg">{t.employeeName}</div>
                                    <div className="text-xs opacity-60 text-white">{t.market}</div>
                                    {t.activeMarkets && (
                                        <div className="text-[11px] text-blue-300 mt-1 font-medium break-words whitespace-normal md:max-w-md">
                                            الفروع: {t.activeMarkets}
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button data-html2canvas-ignore="true" onClick={() => handleEditCurrentTarget(t.userId, t.finalTarget)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded-lg transition" title="تعديل"><Edit size={16}/></button>
                                    <button data-html2canvas-ignore="true" onClick={() => handleDeleteCurrentTarget(t.userId)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition" title="حذف"><Trash2 size={16}/></button>
                                    <div className="text-left flex flex-col ml-3 pl-3 border-l border-white/10">
                                        <span className="text-xs opacity-60 text-white">نسبة التحقيق</span>
                                        <span className="font-black text-blue-400">{perc}%</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between items-center bg-gray-800 p-3 rounded-xl">
                                <div className="flex flex-col">
                                    <span className="text-[10px] opacity-50 text-white uppercase font-black">التارجت</span>
                                    <span className="font-black text-yellow-400">{(Number(t?.finalTarget) || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex flex-col text-left">
                                    <span className="text-[10px] opacity-50 text-white uppercase font-black">المحقق</span>
                                    <span className="font-black text-green-400">{(Number(t?.achieved) || 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                
                {finalTargets.length > 0 && (
                    <div className="mt-4 p-4 rounded-2xl bg-orange-600/20 border border-orange-500/30">
                        <div className="flex justify-between items-center">
                            <div className="font-bold text-white text-lg">{targetPrintEmployee ? "الإجمالي المحقق" : "الإجمالي لجميع الحسابات"}</div>
                            <div className="flex items-center gap-2">
                                <div className="text-left flex flex-col pl-3 border-l border-white/20">
                                    <span className="text-xs opacity-70 text-white">متوسط النسبة</span>
                                    <span className="font-black text-orange-400">{totalPerc}%</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 flex justify-between items-center bg-black/40 p-3 rounded-xl">
                            <div className="flex flex-col">
                                <span className="text-[10px] opacity-70 text-white uppercase font-black">إجمالي التارجت</span>
                                <span className="font-black text-yellow-400">{(Number(totalTarget) || 0).toLocaleString()}</span>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-[10px] opacity-70 text-white uppercase font-black">إجمالي المحقق</span>
                                <span className="font-black text-green-400">{(Number(totalAchieved) || 0).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                )}
                
                {finalTargets.length === 0 && <div className="text-center py-10 opacity-50 text-white">لا يوجد تارجت مسجل</div>}
            </>
        );
    };

    const getPastMonthTargetsData = (mKey: string) => {
        const [yStr, mStr] = mKey.split('-');
        const year = parseInt(yStr);
        const month = parseInt(mStr) - 1; // Month index (0-11)
        
        const exactNames = findExactEmployeeNames();
        const targetNames = [exactNames.omnia, exactNames.toqa, exactNames.mena];

        const candidates = new Map<string, { userId: string; employeeName: string; market: string }>();

        targetsList.forEach(t => {
            candidates.set(t.employeeName, {
                userId: t.userId,
                employeeName: t.employeeName,
                market: t.market
            });
        });

        archiveData.forEach(h => {
            if (h.month === mKey && !(h as any).isDeleted) {
                let market = '';
                const existing = candidates.get(h.employeeName);
                if (existing) {
                    market = existing.market;
                } else {
                    const foundTarget = targetsList.find(t => t.employeeName === h.employeeName);
                    if (foundTarget) {
                        market = foundTarget.market;
                    } else {
                        const foundSale = sales.find(s => s.employeeName === h.employeeName);
                        market = foundSale ? foundSale.market : 'غير محدد';
                    }
                }
                candidates.set(h.employeeName, {
                    userId: h.userId,
                    employeeName: h.employeeName,
                    market: market || 'غير محدد'
                });
            }
        });

        if (mKey === "2026-06") {
            targetNames.forEach(empName => {
                if (!candidates.has(empName)) {
                    const u = usersList.find(usr => usr.name === empName);
                    const t = targetsList.find(tg => tg.employeeName === empName);
                    let market = t ? t.market : '';
                    if (!market) {
                        const foundSale = sales.find(s => s.employeeName === empName);
                        market = foundSale ? foundSale.market : 'غير محدد';
                    }
                    candidates.set(empName, {
                        userId: u?.key || empName,
                        employeeName: empName,
                        market: market || 'غير محدد'
                    });
                }
            });
        }

        const resultList = Array.from(candidates.values()).map(c => {
            const historical = archiveData.find(a => a.userId === c.userId && a.month === mKey);
            
            let targetAmount = 0;
            if (historical) {
                if ((historical as any).isDeleted) return null;
                targetAmount = historical.targetAmount;
            } else {
                const t = targetsList.find(x => x.employeeName === c.employeeName);
                targetAmount = t ? t.finalTarget : 0;
            }

            let achievedAmount = computeAchieved(c.employeeName, year, month, c.userId);
            const start = new Date(year, month, 1).getTime();
            const end = new Date(year, month + 1, 0, 23, 59, 59).getTime();
            const employeeSales = sales.filter(s => {
                const nameMatches = s.employeeName?.trim().toLowerCase() === c.employeeName?.trim().toLowerCase();
                const userMatches = c.userId && s.username && (s.username.replace(/[.#$/\[\]]/g, "_") === c.userId || s.username === c.userId);
                return (nameMatches || userMatches) && s.timestamp >= start && s.timestamp <= end;
            });
            const activeMarkets = Array.from(new Set(employeeSales.map(s => s.market))).sort().join('، ');
            if (mKey === "2026-06" && targetNames.includes(c.employeeName)) {
                achievedAmount = computeAchieved(c.employeeName, 2026, 5, c.userId); // June
            }

            if (targetAmount === 0 && achievedAmount === 0) return null;

            return {
                userId: c.userId,
                employeeName: c.employeeName,
                market: c.market,
                targetAmount,
                achievedAmount,
                activeMarkets
            };
        }).filter(Boolean) as { userId: string; employeeName: string; market: string; targetAmount: number; achievedAmount: number; activeMarkets?: string; }[];

        return resultList;
    };

    const renderPastMonthTargetsList = (mKey: string) => {
        let dataList = getPastMonthTargetsData(mKey);
        if (targetPrintEmployee) {
            dataList = dataList.filter(t => t.userId === targetPrintEmployee);
        }

        const totalTarget = dataList.reduce((sum, item) => sum + item.targetAmount, 0);
        const totalAchieved = dataList.reduce((sum, item) => sum + item.achievedAmount, 0);
        const totalPerc = totalTarget > 0 ? ((totalAchieved / totalTarget) * 100).toFixed(1) : "0.0";

        return (
            <div className="space-y-4">
                <div className="p-4 bg-orange-600/10 border border-orange-500/30 rounded-2xl flex items-center justify-between">
                    <div>
                        <span className="text-[10px] opacity-70 text-white uppercase font-black block">شهر الأرشيف المختار</span>
                        <span className="font-black text-lg text-white">{mKey}</span>
                    </div>
                </div>
                <div className="space-y-2">
                    {dataList.map((item, idx) => {
                        const perc = item.targetAmount > 0 ? ((item.achievedAmount / item.targetAmount) * 100).toFixed(1) : "0.0";
                        return (
                            <div key={`past-target-${item.userId || item.employeeName}-${mKey}-${idx}`} className="flex justify-between items-center bg-black/20 p-4 rounded-xl border border-white/5">
                                <div className="min-w-[160px] max-w-[200px] flex flex-col justify-center text-right pr-2">
                                    <div className="font-bold text-white text-sm break-words whitespace-normal">{item.employeeName}</div>
                                    <div className="text-[11px] text-blue-300 mt-1 font-medium break-words whitespace-normal">{item.market}</div>
                                    {item.activeMarkets && (
                                        <div className="text-[11px] text-blue-300 mt-1 font-medium break-words whitespace-normal">
                                            الفروع: {item.activeMarkets}
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1 flex justify-center gap-6">
                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] opacity-50 text-white uppercase font-black">التارجت</span>
                                        <span className="font-black text-yellow-400 text-sm">{(Number(item.targetAmount) || 0).toLocaleString()} ج.م</span>
                                    </div>
                                    <div className="flex flex-col items-center">
                                        <span className="text-[10px] opacity-50 text-white uppercase font-black">المحقق</span>
                                        <span className="font-black text-green-400 text-sm">{(Number(item.achievedAmount) || 0).toLocaleString()} ج.م</span>
                                    </div>
                                </div>
                                <div className="w-20 text-left border-l border-white/10 pl-2 ml-2 flex flex-col justify-center">
                                    <span className="text-[10px] opacity-50 text-white uppercase font-black block text-center">النسبة</span>
                                    <span className="font-black text-blue-400 text-sm text-center">{perc}%</span>
                                </div>
                            </div>
                        );
                    })}
                    {dataList.length === 0 && <div className="text-center py-10 opacity-50 text-white">لا توجد بيانات لهذا الشهر</div>}
                </div>
                {dataList.length > 0 && (
                    <div className="mt-4 p-4 rounded-2xl bg-orange-600/20 border border-orange-500/30">
                        <div className="flex justify-between items-center">
                            <div className="font-bold text-white text-lg">{targetPrintEmployee ? "الإجمالي المحقق" : "الإجمالي لجميع الحسابات"}</div>
                            <div className="flex items-center gap-2">
                                <div className="text-left flex flex-col pl-3 border-l border-white/20">
                                    <span className="text-xs opacity-70 text-white">متوسط النسبة</span>
                                    <span className="font-black text-orange-400">{totalPerc}%</span>
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 flex justify-between items-center bg-black/40 p-3 rounded-xl">
                            <div className="flex flex-col">
                                <span className="text-[10px] opacity-70 text-white uppercase font-black">إجمالي التارجت</span>
                                <span className="font-black text-yellow-400">{(Number(totalTarget) || 0).toLocaleString()} ج.م</span>
                            </div>
                            <div className="flex flex-col text-left">
                                <span className="text-[10px] opacity-70 text-white uppercase font-black">إجمالي المحقق</span>
                                <span className="font-black text-green-400">{(Number(totalAchieved) || 0).toLocaleString()} ج.م</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    const handleDownloadImage = async (isLowQuality = false) => {
        let element = document.getElementById('current-targets-print-area');
        if (!element || element.offsetParent === null) {
            element = document.getElementById('hidden-print-area');
        }
        if (!element) return;
        try {
            const scale = isLowQuality ? 2 : (8000 / element.offsetWidth);
            const canvas = await html2canvas(element, {
                backgroundColor: '#111827',
                scale: scale, 
            });
            
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = `targets-${new Date().toISOString().split('T')[0]}.png`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                }
            }, 'image/png', isLowQuality ? 0.8 : 1.0);
        } catch (err) {
            console.error("Failed to capture image", err);
            alert("حدث خطأ أثناء تحميل الصورة");
        }
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

    const handleExportCurrent = () => {
        if (filteredSales.length === 0) return alert("لا توجد بيانات للتصدير");
        const exportData = filteredSales.map(s => ({
            "اسم الموظف": s.employeeName,
            "اليوم": s.timestamp ? new Date(s.timestamp).toLocaleDateString('ar-EG', { weekday: 'long' }) : '',
            "التاريخ": s.date,
            "اسم الفرع": s.market,
            "إجمالي مبيعات اليوم": (Number(s.total) || 0).toLocaleString()
        }));
        exportToCSV(exportData, "Current_Sales_Log");
    };

    const handleExportPeriod = () => {
        if (!exportStart || !exportEnd) return alert("اختر الفترة الزمنية");
        const startTS = new Date(exportStart).getTime();
        const endTS = new Date(exportEnd).getTime() + 86400000;
        const periodSales = sales.filter(s => s.timestamp >= startTS && s.timestamp <= endTS && (!exportMarket || s.market === exportMarket) && (!exportEmployee || s.employeeName === exportEmployee || s.username === exportEmployee));
        
        if (periodSales.length === 0) return alert("لا توجد مبيعات");

        let grandTotalValue = 0;
        const exportData: any[] = periodSales.map(s => {
            grandTotalValue += s.total;
            return {
                "اسم الموظف": s.employeeName || s.username || "System",
                "التاريخ": s.date,
                "اسم الماركت": s.market,
                "إجمالي المبيعات": s.total
            };
        });

        exportData.push({
            "اسم الموظف": "الإجمالي العام",
            "التاريخ": "",
            "اسم الماركت": "",
            "إجمالي المبيعات": grandTotalValue
        });

        exportToCSV(exportData, `Sales_Report_${exportStart}_to_${exportEnd}`);
        setShowExportModal(false);
    };

    const handleExportProductSales = () => {
        const dataRows = (Object.entries(reportResults.itemsGrouped) as [string, { price: number; qty: number; total: number }][]).map(([name, stats]) => ({
            "اسم الصنف": name,
            "الفترة": `من ${reportStart || 'البداية'} إلى ${reportEnd || 'الآن'}`,
            "سعر القطعة": stats.price,
            "الكمية المباعة": stats.qty,
            "الإجمالي": stats.total
        }));
        
        dataRows.push({
            "اسم الصنف": "الإجمالي العام",
            "الفترة": "",
            "سعر القطعة": 0,
            "الكمية المباعة": reportResults.totalQty,
            "الإجمالي": reportResults.totalValue
        });

        exportToCSV(dataRows, `Product_Sales_Report_${reportStart}_to_${reportEnd}`);
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
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).getTime(); // fixing to end of month
        const currentMonthSales = sales.filter(s => s.timestamp >= start && s.timestamp <= end);
        const totals: Record<string, number> = {};
        currentMonthSales.forEach(s => totals[s.employeeName] = (totals[s.employeeName] || 0) + s.total);
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

    const stars = getStarOfMonth();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-white"><FileSpreadsheet /> سجل المبيعات</h2>
                <div className="flex items-center gap-2">
                    {user.role === 'admin' && (
                        <div className="relative">
                            <button 
                                onClick={() => setShowTargetDropdown(!showTargetDropdown)} 
                                className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold shadow-lg transition active:scale-95"
                            >
                                <Target size={18}/> خاص بالتارجت <ChevronDown size={16} className={`transition-transform duration-200 ${showTargetDropdown ? 'rotate-180' : ''}`}/>
                            </button>
                            {showTargetDropdown && (
                                <div className="absolute left-0 mt-2 w-48 bg-gray-900 border border-white/10 rounded-2xl shadow-2xl z-50 py-2 overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95">
                                    <button 
                                        onClick={() => { setShowTargetDropdown(false); setShowProductSalesModal(true); }}
                                        className="w-full text-right px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-600/30 flex items-center gap-2 transition"
                                    >
                                        <Package size={16} className="text-blue-400"/> مبيعات صنف
                                    </button>
                                    <button 
                                        onClick={() => { setShowTargetDropdown(false); loadArchive(); }}
                                        className="w-full text-right px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-700/50 flex items-center gap-2 transition"
                                    >
                                        <History size={16} className="text-amber-400"/> تارجت سابق
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
                    )}
                </div>
            </div>
            
            {user.role === 'admin' && selectedSalesIds.length > 0 && (
                <div className="flex flex-col md:flex-row gap-3 animate-in fade-in slide-in-from-top-2">
                    <button onClick={() => setShowExportModal(true)} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition active:scale-95"><Filter size={18}/> تصدير فترة معينة ({selectedSalesIds.length})</button>
                    <button onClick={handleExportCurrent} className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition active:scale-95"><Download size={18}/> تصدير السجل الحالي ({selectedSalesIds.length})</button>
                </div>
            )}

            {stars && stars.first && (
                <div className="bg-[#808080] p-6 rounded-3xl border border-white/20 shadow-2xl relative overflow-hidden group">
                    <div className="absolute -right-4 -top-4 opacity-10 group-hover:rotate-12 transition-transform duration-700"><Trophy size={120} /></div>
                    <div className="text-center mb-6 relative z-10">
                        <Trophy className="text-yellow-400 animate-pulse mx-auto mb-2" size={40} />
                        <h3 className="text-xl font-black text-white uppercase tracking-widest">نجوم الشهر الحالي</h3>
                    </div>
                    
                    <div className="flex flex-col md:flex-row justify-center items-center gap-6 relative z-10">
                        {/* المركز الأول */}
                        <div className="flex flex-col items-center bg-white/10 p-4 rounded-2xl border border-yellow-400/50 min-w-[200px]">
                            <div className="text-yellow-400 text-sm font-black mb-1">المركز الأول</div>
                            <div className="text-2xl font-black text-white">{stars.first.name}</div>
                            <div className="text-sm font-bold opacity-80 text-white mt-2">مبيعات: <span className="text-green-300 font-black">{(Number(stars.first.total) || 0).toLocaleString()} ج.م</span></div>
                        </div>

                        {/* المركز الثاني */}
                        {stars.second && (
                            <div className="flex flex-col items-center bg-white/5 p-4 rounded-2xl border border-gray-400/50 min-w-[200px] md:scale-95">
                                <div className="text-gray-300 text-sm font-black mb-1">المركز الثاني</div>
                                <div className="text-xl font-black text-white">{stars.second.name}</div>
                                <div className="text-sm font-bold opacity-80 text-white mt-2">مبيعات: <span className="text-green-300 font-black">{(Number(stars.second.total) || 0).toLocaleString()} ج.م</span></div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {user.role === 'admin' && <input type="date" className="p-3 rounded-xl bg-gray-700 text-white border border-white/20" value={filterDate} onChange={e => setFilterDate(e.target.value)} />}
                <input type="text" placeholder="بحث باسم الموظف..." className="p-3 rounded-xl bg-gray-700 text-white border border-white/10 text-xs" value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} />
                <select className="p-3 rounded-xl bg-gray-700 text-white border border-white/20" value={filterMarket} onChange={e => setFilterMarket(e.target.value)}>
                    <option value="">كل الماركتات</option>
                    {markets.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
            </div>
            
            <div className="flex items-center justify-between bg-gray-800 p-4 rounded-2xl border border-white/10 shadow-lg">
                <div className="flex items-center gap-2">
                    <input type="checkbox" id="selectAll" className="w-5 h-5 accent-blue-500 rounded" 
                           checked={filteredSales.length > 0 && selectedSalesIds.length === filteredSales.length}
                           onChange={e => {
                               if (e.target.checked) setSelectedSalesIds(filteredSales.map(s => s.id));
                               else setSelectedSalesIds([]);
                           }} />
                    <label htmlFor="selectAll" className="text-white font-bold cursor-pointer">تحديد الكل ({filteredSales.length})</label>
                </div>
                {selectedSalesIds.length > 0 && (
                    <div className="flex gap-2">
                        <button onClick={() => handleShareSales(true)} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition text-xs shadow-xl"><FileDown size={14}/> تصدير PDF</button>
                        <button onClick={() => handleShareSales(false)} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition text-xs shadow-xl"><Download size={14}/> تحميل للهاتف</button>
                    </div>
                )}
            </div>
            <div className="space-y-4">
                {filteredSales.slice(0, visibleCount).map(sale => (
                    <div key={sale.id} className="p-5 rounded-3xl border border-white/10 bg-gray-800 shadow-2xl">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-3">
        <input type="checkbox" className="w-5 h-5 accent-blue-500 rounded"
               checked={selectedSalesIds.includes(sale.id)} 
               onChange={e => {
                   if (e.target.checked) setSelectedSalesIds(prev => [...prev, sale.id]);
                   else setSelectedSalesIds(prev => prev.filter(id => id !== sale.id));
               }} />
        <div className="font-bold text-xl text-blue-400">{sale.market}</div>
    </div>
                                <div className="flex flex-wrap items-center gap-3 text-[10px] opacity-60 font-bold mt-1 text-white">
                                    <span className="flex items-center gap-1"><Calendar size={12}/> {sale.timestamp ? new Date(sale.timestamp).toLocaleDateString('ar-EG', { weekday: 'long' }) : ''} - {sale.date}</span>
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
                                    {(Array.isArray(sale.comments) ? sale.comments : (sale.comments ? Object.values(sale.comments) : [])).map((comment, cIdx) => (
                                        <div key={comment.id || `comment-${sale.id}-${cIdx}`} className="bg-white/5 rounded-xl p-3 flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-blue-300">{comment.senderName}</span>
                                                    <span className="text-[9px] opacity-50">{comment.timestamp ? new Date(comment.timestamp).toLocaleString('ar-EG') : ''}</span>
                                                </div>
                                                <p className="text-xs text-white/90 whitespace-pre-wrap">{comment.text}</p>
                                            </div>
                                            <button onClick={() => handleLikeComment(sale.id, comment.id || `${cIdx}`)} className={`p-1.5 rounded-full ${comment.isLiked ? 'text-red-500 bg-red-500/10' : 'text-white/40 hover:text-white/80 hover:bg-white/10'} transition`}>
                                                <Heart size={14} fill={comment.isLiked ? 'currentColor' : 'none'} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                                {showCommentInput[sale.id] && (
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
                                )}
                            </div>
                        )}
                    </div>
                ))}
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
                                    {markets.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">الموظف</label>
                                <select className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold" value={targetEmployeeKey} onChange={e => setTargetEmployeeKey(e.target.value)}>
                                    <option value="">-- اختر الموظف --</option>
                                    {usersList.map(u => <option key={u.key} value={u.key}>{u.name}</option>)}
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
                                <input type="text" placeholder="بحث بالشهر أو الاسم..." className="w-full pr-10 p-3 rounded-xl bg-gray-800 text-white border border-white/10 text-xs" value={archiveSearch} onChange={e => setArchiveSearch(e.target.value)} />
                            </div>
                            <select className="p-3 rounded-xl bg-[#808080] text-white border border-white/10 text-xs font-bold" value={archiveEmployee} onChange={e => setArchiveEmployee(e.target.value)}>
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

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">الأصناف</label>
                                <select className="w-full p-3 rounded-xl bg-[#808080] text-white border border-white/10 text-xs font-bold" value={reportItem} onChange={e => setReportItem(e.target.value)}>
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
                                <select className="w-full p-3 rounded-xl bg-[#808080] text-white border border-white/10 text-xs font-bold" value={reportMarket} onChange={e => setReportMarket(e.target.value)}>
                                    <option value="all">كل الماركتات المسجلة</option>
                                    {marketsWithSales.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>

                        </div>
<button onClick={() => setShowProductSalesDataModal(true)} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition shadow-lg mt-4">اظهر البيانات</button>
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
                        <div className="flex gap-2 mb-4">
                                <input type="date" className="w-full p-1.5 rounded-lg bg-gray-800 text-white border border-white/10 text-[10px]" value={reportStart} onChange={e => setReportStart(e.target.value)} />
                                <input type="date" className="w-full p-1.5 rounded-lg bg-gray-800 text-white border border-white/10 text-[10px]" value={reportEnd} onChange={e => setReportEnd(e.target.value)} />
                        </div>
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
                    <div><label className="block text-xs font-bold mb-1 opacity-60 text-white">الماركت (اختياري)</label><select className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10" value={exportMarket} onChange={e => setExportMarket(e.target.value)}><option value="">كل الماركتات</option>{markets.map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div><label className="block text-xs font-bold mb-1 opacity-60 text-white">الموظف (اختياري)</label><select className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10" value={exportEmployee} onChange={e => setExportEmployee(e.target.value)}><option value="">كل الموظفين</option>{Array.from(new Set(sales.map(s => s.employeeName || s.username || "System"))).filter(Boolean).map(name => <option key={name} value={name}>{name}</option>)}</select></div>
                    <button onClick={handleExportPeriod} className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-xl transition active:scale-95">بدء التحميل (Excel)</button>
                  
                        </div>
                    </div>
                </div>
            )}
            {showCurrentTargetsModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/10 w-full max-w-2xl rounded-3xl p-6 shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-orange-400 flex items-center gap-2">
                                <Target size={24}/> {selectedTargetMonth === 'current' ? 'تارجت الشهر الحالي' : `أرشيف التارجت لشهر ${selectedTargetMonth}`}
                            </h3>
                            <button onClick={() => { setShowCurrentTargetsModal(false); setSelectedTargetMonth('current'); }} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4 items-end">
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-black opacity-50 uppercase mb-1 text-white">التارجت السابق</label>
                                <select 
                                    className="w-full p-2.5 rounded-xl bg-gray-800 text-white border border-white/10 text-xs font-bold"
                                    value={selectedTargetMonth === 'current' ? '' : selectedTargetMonth}
                                    onChange={(e) => {
                                        if (e.target.value) {
                                            setSelectedTargetMonth(e.target.value);
                                        }
                                    }}
                                >
                                    <option value="" disabled>-- اختر شهر من الأرشيف --</option>
                                    {pastMonthsList.map(mKey => (
                                        <option key={mKey} value={mKey}>{mKey}</option>
                                    ))}
                                </select>
                            </div>

                            <button 
                                onClick={() => setSelectedTargetMonth('current')}
                                className={`py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition h-[40px] ${
                                    selectedTargetMonth === 'current' 
                                        ? 'bg-orange-600 text-white cursor-default' 
                                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                                }`}
                            >
                                <Target size={14}/> الشهر الحالي
                            </button>
                            <div className="md:col-span-1">
                                <label className="block text-[10px] font-black opacity-50 uppercase mb-1 text-white">تحديد اسم</label>
                                <select 
                                    className="w-full p-2.5 rounded-xl bg-gray-800 text-white border border-white/10 text-xs font-bold"
                                    value={targetPrintEmployee} 
                                    onChange={e => setTargetPrintEmployee(e.target.value)}
                                >
                                    <option value="">الكل</option>
                                    {usersList.filter(u => {
                                        if (selectedTargetMonth === 'current') {
                                            const now = new Date();
                                            const achieved = computeAchieved(u.name, now.getFullYear(), now.getMonth(), u.key);
                                            return achieved > 0;
                                        } else {
                                            const h = archiveData.find(x => x.month === selectedTargetMonth && (x.userId === u.key || x.employeeName === u.name));
                                            return h && h.achievedAmount > 0;
                                        }
                                    }).map(u => <option key={u.key} value={u.key}>{u.name}</option>)}
                                </select>
                            </div>
                            <button 
                                onClick={() => handleDownloadImage(false)}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition h-[40px]"
                                title="تحميل صورة"
                            >
                                <Printer size={14}/> تحميل
                            </button>
                            {targetPrintEmployee && (
                                <button 
                                    onClick={() => handleDownloadImage(true)}
                                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition h-[40px]"
                                    title="تحميل بجودة للهاتف"
                                >
                                    <Download size={14}/> للهاتف
                                </button>
                            )}
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            <div id="current-targets-print-area" className="space-y-2 bg-gray-900 pb-2">
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
                                
                                const monthTargets = targetsList.map((t, tIdx) => {
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
                                        <div key={`month-target-${t.userId || t.employeeName}-${mKey}-${tIdx}`} className="flex justify-between items-center bg-black/20 p-3 rounded-xl border border-white/5">
                                            <div className="w-1/3">
                                                <div className="font-bold text-white text-sm truncate">{t.employeeName}</div>
                                                <div className="text-[10px] opacity-60 text-white truncate">{t.market}</div>
                                            </div>
                                            <div className="flex-1 flex justify-center gap-6">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] opacity-50 text-white uppercase font-black">التارجت</span>
                                                    <span className="font-black text-yellow-400 text-sm">{(Number(pastTarget) || 0).toLocaleString()}</span>
                                                </div>
                                                <div className="flex flex-col items-center">
                                                    <span className="text-[10px] opacity-50 text-white uppercase font-black">المحقق</span>
                                                    <span className="font-black text-green-400 text-sm">{(Number(achieved) || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1.5 border-r pr-3 mr-1 border-white/10">
                                                <button onClick={() => handleEditPastTarget(t.userId, t.employeeName, mKey, historical, pastTarget, achieved)} className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded-lg transition" title="تعديل"><Edit size={16}/></button>
                                                <button onClick={() => handleDeletePastTarget(t.userId, t.employeeName, mKey, historical)} className="p-1.5 text-red-400 hover:bg-red-500/20 rounded-lg transition" title="حذف"><Trash2 size={16}/></button>
                                            </div>
                                            <div className="w-16 text-left border-l border-white/10 pl-2 ml-2">
                                                <span className="font-black text-blue-400 text-sm">{perc}%</span>
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
                                    <div className="font-bold text-2xl text-blue-400 mb-2">{sale.market}</div>
                                    <div className="flex flex-wrap items-center gap-4 text-sm opacity-80 font-bold mt-1 text-white mb-4">
                                        <span className="flex items-center gap-1"><Calendar size={16}/> {sale.timestamp ? new Date(sale.timestamp).toLocaleDateString('ar-EG', { weekday: 'long' }) : ''} - {sale.date}</span>
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
                                        {t.employeeName.charAt(0)}
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

            {/* Hidden Print Area for html2canvas */}
            <div style={{ position: 'absolute', left: '-9999px', top: '-9999px' }}>
                <div id="hidden-print-area" className="w-[600px] p-6 bg-gray-900 space-y-2">
                    {selectedTargetMonth === 'current' 
                        ? renderTargetsList() 
                        : renderPastMonthTargetsList(selectedTargetMonth)
                    }
                </div>
            </div>

        </div>
    );
};

export default SalesLog;
