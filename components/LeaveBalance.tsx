import { onCachedValue } from "../firebaseCache";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../firebase';
import { ref, onValue, set, push, remove, update, get } from "firebase/database";
import { User, LeaveBalance, LeaveRecord } from '../types';
import { 
    Trash2, Edit, CalendarPlus, X, Save, History, 
    ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, Calendar as CalendarIcon,
    User as UserIcon, FileSpreadsheet, Printer, Archive, RotateCcw,
    FileDown, Loader2
} from 'lucide-react';
import { exportToCSV, exportToExcel } from '../utils';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Props {
    user: User;
    theme: string;
}

const LeaveBalanceComponent: React.FC<Props> = ({ user, theme }) => {
    const [balances, setBalances] = useState<Record<string, LeaveBalance>>({});
    const [usersList, setUsersList] = useState<User[]>([]);
    const [allHistory, setAllHistory] = useState<({id: string} & LeaveRecord)[]>([]);
    
    const [showAddLeaveModal, setShowAddLeaveModal] = useState(false);
    const [showHistoryDetailsModal, setShowHistoryDetailsModal] = useState(false);
    const [historyFilterType, setHistoryFilterType] = useState<string>('all');
    const [showExportModal, setShowExportModal] = useState(false);
    const [showEditBalanceModal, setShowEditBalanceModal] = useState<LeaveBalance | null>(null);
    const [editingRecord, setEditingRecord] = useState<(LeaveRecord & { id: string }) | null>(null);
    const [editDate, setEditDate] = useState('');
    const [editDays, setEditDays] = useState(1);
    const [editType, setEditType] = useState<'annual' | 'casual' | 'sick' | 'exams' | 'unpaid' | 'custom' | 'penalty' | 'official' | 'summer'>('annual');
    const [editLabel, setEditLabel] = useState('');
    
    const [selectedEmployeeForExport, setSelectedEmployeeForExport] = useState<string>('all');
    const [exportStartDate, setExportStartDate] = useState<string>('');
    const [exportEndDate, setExportEndDate] = useState<string>('');
    
    // دورة الإجازات: تبدأ من 21 في الشهر السابق إلى 20 في الشهر الحالي
    const [periodDate, setPeriodDate] = useState<Date>(() => {
        const now = new Date();
        return now.getDate() >= 21 ? new Date(now.getFullYear(), now.getMonth(), 21) : new Date(now.getFullYear(), now.getMonth() - 1, 21);
    });

    const [selectedUser, setSelectedUser] = useState('');
    const [leaveDate, setLeaveDate] = useState('');
    const [leaveDays, setLeaveDays] = useState(1);
    const [leaveType, setLeaveType] = useState<'annual' | 'casual' | 'sick' | 'exams' | 'unpaid'>('annual');
    const [historyUserView, setHistoryUserView] = useState<{userId: string, name: string} | null>(null);
    const [customLeaveName, setCustomLeaveName] = useState('');
    const [officialOccasion, setOfficialOccasion] = useState('');
    const [showWeeklyModal, setShowWeeklyModal] = useState(false);
    const [weeklyUser, setWeeklyUser] = useState('');
    const [weeklyDay, setWeeklyDay] = useState('');

    const [viewArchived, setViewArchived] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);

    const [showRouteModal, setShowRouteModal] = useState(false);
    const [selectedRouteUser, setSelectedRouteUser] = useState('');
    const [routeBranches, setRouteBranches] = useState<string[]>(['', '', '', '', '']);
    const [allRoutes, setAllRoutes] = useState<Record<string, string[]>>({});
    const [isExportingRoutePDF, setIsExportingRoutePDF] = useState(false);
    const [routeExportTarget, setRouteExportTarget] = useState<string>('all');
    const routePrintContainerRef = useRef<HTMLDivElement>(null);
    const [filterUser, setFilterUser] = useState<string>('all');

    // جدول سير الموظفين الأسبوعي
    const [showScheduleModal, setShowScheduleModal] = useState(false);
    const [selectedScheduleUser, setSelectedScheduleUser] = useState<string>('');
    const [allRouteSchedules, setAllRouteSchedules] = useState<Record<string, Record<string, string[]>>>({});
    const [currentSchedule, setCurrentSchedule] = useState<Record<string, string[]>>({
        'السبت': [],
        'الأحد': [],
        'الإثنين': [],
        'الثلاثاء': [],
        'الأربعاء': [],
        'الخميس': []
    });
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);
    const [isExportingSchedulePDF, setIsExportingSchedulePDF] = useState(false);
    const [scheduleExportTarget, setScheduleExportTarget] = useState<string>('all');
    const schedulePrintContainerRef = useRef<HTMLDivElement>(null);
    const allSchedulePrintContainerRef = useRef<HTMLDivElement>(null);

    // تصدير PDF للسجل الكامل للإجازات والغياب
    const [isExportingFullLeavePDF, setIsExportingFullLeavePDF] = useState(false);
    const [pdfExportTime, setPdfExportTime] = useState<Date>(new Date());
    const fullHistoryPrintContainerRef = useRef<HTMLDivElement>(null);

    const getRoleTitle = (role?: string) => {
        if (!role) return 'موظف مبيعات';
        const r = role.toLowerCase();
        if (r === 'admin') return 'مسؤول / مدير النظام (Admin)';
        if (r === 'manager') return 'مدير (Manager)';
        if (r === 'supervisor') return 'مشرف مبيعات (Supervisor)';
        if (r === 'coordinator') return 'منسق (Coordinator)';
        if (r === 'merchandiser') return 'مروج مبيعات / منسق أرفف (Merchandiser)';
        if (r === 'usher') return 'أشر (Usher)';
        if (r === 'user') return 'موظف مبيعات (Sales)';
        return role;
    };

    const getDayOfWeekName = (dateOrRec: any) => {
        try {
            let dateStr = typeof dateOrRec === 'string' ? dateOrRec : dateOrRec?.date || dateOrRec?.leaveDate || dateOrRec?.startDate;
            if (!dateStr && dateOrRec?.timestamp) {
                const d = new Date(Number(dateOrRec.timestamp));
                if (!isNaN(d.getTime())) return d.toLocaleDateString('ar-EG', { weekday: 'long' });
            }
            if (!dateStr && dateOrRec?.createdAt) {
                const d = new Date(dateOrRec.createdAt);
                if (!isNaN(d.getTime())) return d.toLocaleDateString('ar-EG', { weekday: 'long' });
            }
            if (!dateStr) return '-';
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return '-';
            return d.toLocaleDateString('ar-EG', { weekday: 'long' });
        } catch {
            return '-';
        }
    };

    const formatToDDMMYYYY = (val: any): string => {
        if (!val) return '-';
        if (typeof val === 'string') {
            const trimmed = val.trim();
            const ymdMatch = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
            if (ymdMatch) {
                const [, y, m, d] = ymdMatch;
                return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
            }
            const dmyMatch = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
            if (dmyMatch) {
                const [, d, m, y] = dmyMatch;
                return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
            }
        }
        try {
            const d = val instanceof Date ? val : new Date(val);
            if (!isNaN(d.getTime())) {
                const day = String(d.getDate()).padStart(2, '0');
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const y = d.getFullYear();
                return `${day}/${m}/${y}`;
            }
        } catch {
            // ignore
        }
        return typeof val === 'string' ? val.trim() : '-';
    };

    const getDisplayDate = (rec: any) => {
        if (!rec) return '-';
        if (typeof rec.date === 'string' && rec.date.trim() !== '') {
            return formatToDDMMYYYY(rec.date.trim());
        }
        if (typeof rec.leaveDate === 'string' && rec.leaveDate.trim() !== '') {
            return formatToDDMMYYYY(rec.leaveDate.trim());
        }
        if (typeof rec.startDate === 'string' && rec.startDate.trim() !== '') {
            return formatToDDMMYYYY(rec.startDate.trim());
        }
        if (rec.timestamp && !isNaN(Number(rec.timestamp))) {
            return formatToDDMMYYYY(new Date(Number(rec.timestamp)));
        }
        if (rec.createdAt) {
            return formatToDDMMYYYY(new Date(rec.createdAt));
        }
        return '-';
    };

    const getDeductionBadgeInfo = (rec: LeaveRecord) => {
        const title = formatLeaveTitle(rec);
        const isPermissionLeave = rec.type === 'unpaid' || 
            Boolean(rec.deductedFromUnpaid && rec.deductedFromUnpaid > 0) || 
            title.includes('إذن') || 
            title.includes('اذن') || 
            title.includes('أذن') || 
            title.includes('راتب') ||
            Boolean(rec.customLabel && (
                rec.customLabel.includes('إذن') || 
                rec.customLabel.includes('اذن') || 
                rec.customLabel.includes('أذن') ||
                rec.customLabel.includes('راتب')
            ));

        if (isPermissionLeave) {
            return {
                badge: 'تخصم من الراتب',
                bg: '#ffedd5',
                color: '#c2410c'
            };
        }
        if (rec.deductedFromAnnual) {
            return {
                badge: 'خصم سنوي',
                bg: '#dcfce7',
                color: '#15803d'
            };
        }
        if (rec.deductedFromCasual) {
            return {
                badge: 'خصم عارضة',
                bg: '#fef9c3',
                color: '#854d0e'
            };
        }
        if (rec.type === 'official') {
            return {
                badge: 'إضافي للموظف',
                bg: '#e0f2fe',
                color: '#0369a1'
            };
        }
        if (rec.type === 'penalty') {
            return {
                badge: 'خصم جزاء',
                bg: '#ffe4e6',
                color: '#be123c'
            };
        }
        return {
            badge: 'غير مخصوم',
            bg: '#f1f5f9',
            color: '#475569'
        };
    };

    const handleArchiveUser = async (userId: string, isArchiving: boolean) => {
        const target = usersList.find(u => u.key === userId);
        const name = target?.name || target?.username || 'الموظف';
        const confirmMsg = isArchiving 
            ? `تأكيد الأرشفة:\nهل أنت متأكد من أرشفة حساب "${name}"؟\nسيتم إخفاؤه من جميع القوائم المنسدلة والحسابات المسجلة النشطة مع إبقائه في الأرشيف.`
            : `تأكيد استعادة الحساب:\nهل أنت متأكد من استعادة حساب "${name}" وإلغاء الأرشفة؟\nسيتم رجوع الاسم مرة أخرى للظهور في كافة القوائم المنسدلة المسجلة.`;
        if (window.confirm(confirmMsg)) {
            await update(ref(db, `users/${userId}`), { isArchived: isArchiving });
            alert(isArchiving ? `تمت أرشفة حساب "${name}" بنجاح.` : `تمت استعادة حساب "${name}" وإلغاء الأرشفة بنجاح.`);
        }
    };


    // نوع البيانات: "remaining" (يتم الطرح) أو "accrued" (يتم الجمع كعداد)
    const typeLogic: any = { annual: 'remaining', casual: 'remaining', sick: 'accrued', exams: 'accrued', unpaid: 'accrued', custom: 'remaining', penalty: 'accrued', official: 'none', summer: 'accrued' };
    const typeLabels: any = { annual: 'سنوي', casual: 'عارضة', sick: 'مرضي', exams: 'امتحانات', unpaid: 'غياب بأذن', penalty: 'جزاء', official: 'إجازة رسمية', summer: 'إجازة مصيف' }; // custom handled separately
    const typeColors: any = { annual: 'text-green-400', casual: 'text-yellow-400', sick: 'text-red-400', exams: 'text-purple-400', unpaid: 'text-orange-400', custom: 'text-cyan-400', penalty: 'text-red-600', official: 'text-blue-400', summer: 'text-teal-400' };

    useEffect(() => {
        const unsubUsers = onCachedValue(ref(db, 'users'), 'users', snapshot => {
            if (snapshot.exists()) {
                const u: User[] = [];
                snapshot.forEach(c => { u.push({ key: c.key!, ...c.val() }); });
                setUsersList(u);
            }
        });
        
        const unsubBalances = onCachedValue(ref(db, 'leave_balances'), 'leave_balances', snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val() as Record<string, LeaveBalance>;
                setBalances(data);
                
                // منطق التصفير التلقائي لخانة "غياب بأذن" في يوم 21 من كل شهر
                const now = new Date();
                const day = now.getDate();
                const currentMonthKey = `${now.getFullYear()}-${now.getMonth() + 1}`;
                
                if (day >= 21) {
                    Object.keys(data).forEach(async (uKey) => {
                        const balance = data[uKey];
                        if (balance.lastUnpaidReset !== currentMonthKey) {
                            await update(ref(db, `leave_balances/${uKey}`), {
                                unpaid: 0,
                                lastUnpaidReset: currentMonthKey
                            });
                        }
                    });
                }
            } else {
                setBalances({});
            }
        });
        
        const unsubHistory = onCachedValue(ref(db, 'leave_history'), 'leave_history', snapshot => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const h: any = Object.keys(data).map(key => ({ id: key, ...data[key] }));
                setAllHistory(h);
            } else { setAllHistory([]); }
        });
        
        const unsubRoutes = onCachedValue(ref(db, 'routes'), 'routes', snapshot => {
            if (snapshot.exists()) {
                setAllRoutes(snapshot.val());
            } else {
                setAllRoutes({});
            }
        });

        const unsubSchedules = onCachedValue(ref(db, 'routeSchedules'), 'routeSchedules', snapshot => {
            if (snapshot.exists()) {
                setAllRouteSchedules(snapshot.val());
            } else {
                setAllRouteSchedules({});
            }
        });

        return () => { unsubUsers(); unsubBalances(); unsubHistory(); unsubRoutes(); unsubSchedules(); };
    }, []);

    const getPeriodEnd = (start: Date) => {
        const end = new Date(start);
        end.setMonth(end.getMonth() + 1);
        end.setDate(20);
        return end;
    };

    const changePeriod = (direction: number) => {
        const next = new Date(periodDate);
        next.setMonth(next.getMonth() + direction);
        setPeriodDate(next);
    };

    const filterHistoryByPeriodAndUser = (userId: string) => {
        const pStart = new Date(periodDate);
        pStart.setHours(0,0,0,0);
        const pEnd = getPeriodEnd(periodDate);
        pEnd.setHours(23,59,59,999);
        return allHistory.filter(r => r.userId === userId && new Date(r.date) >= pStart && new Date(r.date) <= pEnd);
    };

    const handleDeleteRecord = async (id: string, record: LeaveRecord & any) => {
        if(!confirm("حذف السجل وإعادة الرصيد للموظف؟")) return;
        
        const balanceRef = ref(db, `leave_balances/${record.userId}`);
        const balanceSnap = await get(balanceRef);
        if(balanceSnap.exists()) {
            const bal = balanceSnap.val();
            const updates: any = {};
            
            if (record.deductedFromAnnual != null || record.deductedFromCasual != null || record.deductedFromUnpaid != null) {
                if (record.deductedFromAnnual) {
                    updates.annual = (Number(bal.annual) || 0) + Number(record.deductedFromAnnual);
                }
                if (record.deductedFromCasual) {
                    updates.casual = (Number(bal.casual) || 0) + Number(record.deductedFromCasual);
                }
                if (record.deductedFromUnpaid) {
                    updates.unpaid = Math.max(0, (Number(bal.unpaid) || 0) - Number(record.deductedFromUnpaid));
                }
            } else {
                const multiplier = typeLogic[record.type] === 'remaining' ? 1 : -1;
                updates[record.type] = (Number(bal[record.type]) || 0) + (multiplier * Number(record.days));
                if (record.type === 'summer' && record.deductedFromAnnual !== false) {
                    updates.annual = (Number(bal.annual) || 0) + Number(record.days);
                }
            }

            if (Object.keys(updates).length > 0) {
                await update(balanceRef, updates);
            }
        }
        
        await remove(ref(db, `leave_history/${id}`));
        alert("تم الحذف وتحديث الرصيد بنجاح");
    };

    const formatLeaveTitle = (rec: LeaveRecord) => {
        if (rec.type === 'official') {
            const occasion = rec.customLabel ? ` - ${rec.customLabel}` : '';
            return `إجازة رسمية${occasion} - إضافي للموظف`;
        }
        return rec.customLabel ? `${typeLabels[rec.type] || rec.type} - ${rec.customLabel}` : (typeLabels[rec.type] || rec.type);
    };

    const handleStartEditRecord = (rec: LeaveRecord & { id: string }) => {
        setEditingRecord(rec);
        setEditDate(rec.date);
        setEditDays(rec.days);
        setEditType(rec.type as any);
        setEditLabel(rec.customLabel || '');
    };

    const handleSaveEditRecord = async () => {
        if (!editingRecord) return;
        const days = Number(editDays);
        if (days <= 0) return alert("عدد الأيام يجب أن يكون أكبر من 0");
        if (!editDate) return alert("اختر التاريخ");

        const balanceRef = ref(db, `leave_balances/${editingRecord.userId}`);
        const balanceSnap = await get(balanceRef);
        let cur = balanceSnap.exists() ? balanceSnap.val() : { 
            userId: editingRecord.userId, 
            employeeName: editingRecord.employeeName || 'Unknown', 
            annual: 21, 
            casual: 7, 
            sick: 0, 
            exams: 0, 
            unpaid: 0 
        };

        // 1. Revert previous deduction
        if (editingRecord.deductedFromAnnual != null || editingRecord.deductedFromCasual != null || editingRecord.deductedFromUnpaid != null) {
            if (editingRecord.deductedFromAnnual) {
                cur.annual = (Number(cur.annual) || 0) + Number(editingRecord.deductedFromAnnual);
            }
            if (editingRecord.deductedFromCasual) {
                cur.casual = (Number(cur.casual) || 0) + Number(editingRecord.deductedFromCasual);
            }
            if (editingRecord.deductedFromUnpaid) {
                cur.unpaid = Math.max(0, (Number(cur.unpaid) || 0) - Number(editingRecord.deductedFromUnpaid));
            }
        } else {
            const multiplier = typeLogic[editingRecord.type] === 'remaining' ? 1 : -1;
            cur[editingRecord.type] = (Number(cur[editingRecord.type]) || 0) + (multiplier * Number(editingRecord.days));
            if (editingRecord.type === 'summer' && editingRecord.deductedFromAnnual !== false) {
                cur.annual = (Number(cur.annual) || 0) + Number(editingRecord.days);
            }
        }

        // 2. Compute new deductions
        let deductedFromAnnual = 0;
        let deductedFromCasual = 0;
        let deductedFromUnpaid = 0;

        const availAnnual = Math.max(0, Number(cur.annual != null ? cur.annual : 21));
        const availCasual = Math.max(0, Number(cur.casual != null ? cur.casual : 7));

        const leaveDateObj = new Date(editDate);
        const isAfterJuly1 = (leaveDateObj.getMonth() > 5) || (leaveDateObj.getMonth() === 6 && leaveDateObj.getDate() >= 1);

        if (editType === 'official') {
            // Official leaves are not deducted from any balance
        } else if (editType === 'sick' || editType === 'exams' || editType === 'summer') {
            if (availAnnual >= days) {
                cur.annual = availAnnual - days;
                deductedFromAnnual = days;
            } else if (availAnnual > 0 && availAnnual < days) {
                deductedFromAnnual = availAnnual;
                cur.annual = 0;
                const rem = days - availAnnual;
                if (availCasual >= rem) {
                    cur.casual = availCasual - rem;
                    deductedFromCasual = rem;
                } else {
                    deductedFromCasual = availCasual;
                    cur.casual = 0;
                    const unpaidPart = rem - availCasual;
                    cur.unpaid = Number(cur.unpaid || 0) + unpaidPart;
                    deductedFromUnpaid = unpaidPart;
                }
            } else {
                if (availCasual >= days) {
                    cur.casual = availCasual - days;
                    deductedFromCasual = days;
                } else {
                    deductedFromCasual = availCasual;
                    cur.casual = 0;
                    const unpaidPart = days - availCasual;
                    cur.unpaid = Number(cur.unpaid || 0) + unpaidPart;
                    deductedFromUnpaid = unpaidPart;
                }
            }
        } else if (editType === 'casual') {
            if (isAfterJuly1) {
                if (availCasual >= days) {
                    cur.casual = availCasual - days;
                    deductedFromCasual = days;
                } else if (availCasual > 0 && availCasual < days) {
                    deductedFromCasual = availCasual;
                    cur.casual = 0;
                    const rem = days - availCasual;
                    if (availAnnual >= rem) {
                        cur.annual = availAnnual - rem;
                        deductedFromAnnual = rem;
                    } else {
                        deductedFromAnnual = availAnnual;
                        cur.annual = 0;
                        const unpaidPart = rem - availAnnual;
                        cur.unpaid = Number(cur.unpaid || 0) + unpaidPart;
                        deductedFromUnpaid = unpaidPart;
                    }
                } else {
                    if (availAnnual >= days) {
                        cur.annual = availAnnual - days;
                        deductedFromAnnual = days;
                    } else if (availAnnual > 0 && availAnnual < days) {
                        deductedFromAnnual = availAnnual;
                        cur.annual = 0;
                        const unpaidPart = days - availAnnual;
                        cur.unpaid = Number(cur.unpaid || 0) + unpaidPart;
                        deductedFromUnpaid = unpaidPart;
                    } else {
                        cur.unpaid = Number(cur.unpaid || 0) + days;
                        deductedFromUnpaid = days;
                    }
                }
            } else {
                if (availCasual >= days) {
                    cur.casual = availCasual - days;
                    deductedFromCasual = days;
                } else {
                    deductedFromCasual = availCasual;
                    cur.casual = 0;
                    const rem = days - availCasual;
                    if (availAnnual >= rem) {
                        cur.annual = availAnnual - rem;
                        deductedFromAnnual = rem;
                    } else {
                        deductedFromAnnual = availAnnual;
                        cur.annual = 0;
                        const unpaidPart = rem - availAnnual;
                        cur.unpaid = Number(cur.unpaid || 0) + unpaidPart;
                        deductedFromUnpaid = unpaidPart;
                    }
                }
            }
        } else if (editType === 'annual' || editType === 'custom') {
            if (availAnnual >= days) {
                cur.annual = availAnnual - days;
                deductedFromAnnual = days;
            } else if (availAnnual > 0 && availAnnual < days) {
                deductedFromAnnual = availAnnual;
                cur.annual = 0;
                const rem = days - availAnnual;
                if (availCasual >= rem) {
                    cur.casual = availCasual - rem;
                    deductedFromCasual = rem;
                } else {
                    deductedFromCasual = availCasual;
                    cur.casual = 0;
                    const unpaidPart = rem - availCasual;
                    cur.unpaid = Number(cur.unpaid || 0) + unpaidPart;
                    deductedFromUnpaid = unpaidPart;
                }
            } else {
                if (availCasual >= days) {
                    cur.casual = availCasual - days;
                    deductedFromCasual = days;
                } else {
                    deductedFromCasual = availCasual;
                    cur.casual = 0;
                    const unpaidPart = days - availCasual;
                    cur.unpaid = Number(cur.unpaid || 0) + unpaidPart;
                    deductedFromUnpaid = unpaidPart;
                }
            }
        } else if (editType === 'unpaid') {
            cur.unpaid = Number(cur.unpaid || 0) + days;
            deductedFromUnpaid = days;
        } else if (editType === 'penalty') {
            cur.penalty = Number((cur as any).penalty || 0) + days;
        }

        if (editType !== 'official') {
            await set(balanceRef, cur);
        }

        const updatedRecordData: any = {
            date: editDate,
            days: days,
            type: editType,
            deductedFromAnnual,
            deductedFromCasual,
            deductedFromUnpaid,
            timestamp: new Date(editDate).getTime()
        };
        if (editType === 'custom' || editType === 'official') {
            updatedRecordData.customLabel = editLabel.trim();
        } else {
            updatedRecordData.customLabel = null;
        }

        await update(ref(db, `leave_history/${editingRecord.id}`), updatedRecordData);
        setEditingRecord(null);
        alert("تم تعديل الإجازة وتحديث الرصيد بنجاح");
    };

    const handleDeleteEmployeeData = async (userId: string, userName: string) => {
        if(!confirm(`هل أنت متأكد من حذف بيانات إجازات الموظف "${userName}" نهائياً؟`)) return;
        await remove(ref(db, `leave_balances/${userId}`));
        alert("تم حذف سجل الرصيد للموظف");
    };

    const handleAddLeave = async () => {
        if (!leaveDate) return alert("اختر التاريخ");
        if (leaveType === 'custom' && !customLeaveName.trim()) return alert("اكتب نوع الإجازة المخصصة");
        if (leaveType === 'official' && !officialOccasion.trim()) return alert("اكتب المناسبة للإجازة الرسمية");
        
        if (leaveType === 'official') {
            const isOfficialDuplicate = allHistory.some(r => r.date === leaveDate && r.type === 'official');
            if (isOfficialDuplicate) return alert("تم تسجيل إجازة رسمية في هذا اليوم مسبقاً");
            const ts = new Date(leaveDate).getTime();
            const updates: any = {};
            usersList.forEach(u => {
                const newRef = push(ref(db, 'leave_history'));
                updates[newRef.key!] = {
                    userId: u.key || 'unknown',
                    employeeName: u.name || u.username || 'Unknown',
                    date: leaveDate,
                    days: Number(leaveDays),
                    type: 'official',
                    customLabel: officialOccasion.trim(),
                    timestamp: ts
                };
            });
            await update(ref(db, 'leave_history'), updates);
            setShowAddLeaveModal(false);
            setOfficialOccasion('');
            return alert("تم تعميم الإجازة الرسمية بنجاح");
        }

        if (!selectedUser) return alert("اختر الموظف");

        const targetUser = usersList.find(u => u.key === selectedUser);
        if (!targetUser) return;

        const isDuplicate = allHistory.some(r => r.userId === selectedUser && r.date === leaveDate);
        if (isDuplicate) return alert("تم تسجيل هذا اليوم مسبقاً لهذا الموظف");

        const balanceRef = ref(db, `leave_balances/${selectedUser}`);
        const snap = await get(balanceRef);
        let cur = snap.exists() ? snap.val() : { userId: selectedUser, employeeName: targetUser.name || targetUser.username || 'Unknown', annual: 21, casual: 7, sick: 0, exams: 0, unpaid: 0 };
        
        const days = Number(leaveDays);
        let effectiveType = leaveType;
        let deductedFromAnnual = 0;
        let deductedFromCasual = 0;
        let deductedFromUnpaid = 0;
        let alertMessage = "تم تسجيل العملية بنجاح";
        let shouldSendInAppNotif = false;

        const availAnnual = Math.max(0, Number(cur.annual != null ? cur.annual : 21));
        const availCasual = Math.max(0, Number(cur.casual != null ? cur.casual : 7));

        const leaveDateObj = new Date(leaveDate);
        const isAfterJuly1 = (leaveDateObj.getMonth() > 5) || (leaveDateObj.getMonth() === 6 && leaveDateObj.getDate() >= 1);

        // 1. في حالة تسجيل إجازة مرضي أو امتحانات أو مصيف: تخصم مباشرة من السنوي، وإن لم يتوفر تخصم من العارضة
        if (leaveType === 'sick' || leaveType === 'exams' || leaveType === 'summer') {
            if (availAnnual >= days) {
                cur.annual = availAnnual - days;
                deductedFromAnnual = days;
                alertMessage = `تم تسجيل إجازة (${typeLabels[leaveType]}) وخصم ${days} يوم من رصيد السنوي المتبقي.`;
            } else if (availAnnual > 0 && availAnnual < days) {
                deductedFromAnnual = availAnnual;
                cur.annual = 0;
                const rem = days - availAnnual;
                if (availCasual >= rem) {
                    cur.casual = availCasual - rem;
                    deductedFromCasual = rem;
                    alertMessage = `تم خصم ${availAnnual} يوم من السنوي و ${rem} يوم من رصيد العارضة لعدم كفاية رصيد السنوي.`;
                } else {
                    deductedFromCasual = availCasual;
                    cur.casual = 0;
                    const unpaidPart = rem - availCasual;
                    cur.unpaid = Number(cur.unpaid || 0) + unpaidPart;
                    deductedFromUnpaid = unpaidPart;
                    alertMessage = `تنبيه: تم استنفاذ رصيد السنوي والعارضة! تم خصم ${availAnnual > 0 ? `${availAnnual} يوم سنوي و ` : ''}${availCasual > 0 ? `${availCasual} يوم عارضة و ` : ''}${unpaidPart} يوم كـ غياب بأذن (تخصم من الراتب).`;
                }
                shouldSendInAppNotif = true;
            } else {
                // لا يوجد رصيد سنوي إطلاقاً
                if (availCasual >= days) {
                    cur.casual = availCasual - days;
                    deductedFromCasual = days;
                    alertMessage = `تم خصم ${days} يوم من رصيد العارضة لعدم توفر رصيد سنوي.`;
                    shouldSendInAppNotif = true;
                } else {
                    deductedFromCasual = availCasual;
                    cur.casual = 0;
                    const unpaidPart = days - availCasual;
                    cur.unpaid = Number(cur.unpaid || 0) + unpaidPart;
                    deductedFromUnpaid = unpaidPart;
                    alertMessage = `تنبيه: تم استنفاذ رصيد السنوي والعارضة! تم خصم ${availCasual > 0 ? `${availCasual} يوم عارضة و ` : ''}${unpaidPart} يوم كـ غياب بأذن (تخصم من الراتب).`;
                    shouldSendInAppNotif = true;
                }
            }
        } 
        // 2. إجازة عارضة: بعد 1 يوليو في حال استنفاذ العارضة تخصم من السنوي مع إشعار، وإن نفد كلاهما تظهر في غياب بإذن
        else if (leaveType === 'casual') {
            if (isAfterJuly1) {
                if (availCasual >= days) {
                    cur.casual = availCasual - days;
                    deductedFromCasual = days;
                    alertMessage = `تم تسجيل إجازة عارضة وخصم ${days} يوم من رصيد العارضة.`;
                } else if (availCasual > 0 && availCasual < days) {
                    deductedFromCasual = availCasual;
                    cur.casual = 0;
                    const rem = days - availCasual;
                    if (availAnnual >= rem) {
                        cur.annual = availAnnual - rem;
                        deductedFromAnnual = rem;
                        alertMessage = `تنبيه (بعد 1 يوليو): تم استنفاذ رصيد العارضة، وتم خصم ${rem} يوم من رصيد السنوي للموظف.`;
                    } else {
                        deductedFromAnnual = availAnnual;
                        cur.annual = 0;
                        const unpaidPart = rem - availAnnual;
                        cur.unpaid = Number(cur.unpaid || 0) + unpaidPart;
                        deductedFromUnpaid = unpaidPart;
                        alertMessage = `تنبيه: تم استنفاذ رصيد العارضة والسنوي بالكامل، تم تسجيل ${unpaidPart} يوم كـ غياب بأذن (تخصم من الراتب).`;
                    }
                    shouldSendInAppNotif = true;
                } else {
                    // رصيد العارضة 0 بعد 1 يوليو
                    if (availAnnual >= days) {
                        cur.annual = availAnnual - days;
                        deductedFromAnnual = days;
                        alertMessage = `تنبيه (بعد 1 يوليو): تم استنفاذ رصيد العارضة بالكامل، وتم خصم ${days} يوم من رصيد السنوي للموظف.`;
                    } else if (availAnnual > 0 && availAnnual < days) {
                        deductedFromAnnual = availAnnual;
                        cur.annual = 0;
                        const unpaidPart = days - availAnnual;
                        cur.unpaid = Number(cur.unpaid || 0) + unpaidPart;
                        deductedFromUnpaid = unpaidPart;
                        alertMessage = `تنبيه: رصيد العارضة مستنفذ وتم خصم ${availAnnual} يوم من السنوي، وتسجيل ${unpaidPart} يوم كـ غياب بأذن (تخصم من الراتب).`;
                    } else {
                        cur.unpaid = Number(cur.unpaid || 0) + days;
                        deductedFromUnpaid = days;
                        alertMessage = `تنبيه: تم استنفاذ رصيد العارضة والسنوي بالكامل، تم تسجيل الإجازة كـ غياب بأذن (تخصم من الراتب).`;
                    }
                    shouldSendInAppNotif = true;
                }
            } else {
                // قبل 1 يوليو
                if (availCasual >= days) {
                    cur.casual = availCasual - days;
                    deductedFromCasual = days;
                } else {
                    deductedFromCasual = availCasual;
                    cur.casual = 0;
                    const rem = days - availCasual;
                    if (availAnnual >= rem) {
                        cur.annual = availAnnual - rem;
                        deductedFromAnnual = rem;
                        alertMessage = `تم استنفاذ رصيد العارضة، وتم خصم المتبقي (${rem} يوم) من رصيد السنوي.`;
                    } else {
                        deductedFromAnnual = availAnnual;
                        cur.annual = 0;
                        const unpaidPart = rem - availAnnual;
                        cur.unpaid = Number(cur.unpaid || 0) + unpaidPart;
                        deductedFromUnpaid = unpaidPart;
                        alertMessage = `تم استنفاذ رصيد العارضة والسنوي بالكامل، تم تسجيل ${unpaidPart} يوم كـ غياب بأذن (تخصم من الراتب).`;
                    }
                    shouldSendInAppNotif = true;
                }
            }
        }
        // 3. إجازة سنوية أو مخصصة
        else if (leaveType === 'annual' || leaveType === 'custom') {
            if (availAnnual >= days) {
                cur.annual = availAnnual - days;
                deductedFromAnnual = days;
            } else if (availAnnual > 0 && availAnnual < days) {
                deductedFromAnnual = availAnnual;
                cur.annual = 0;
                const rem = days - availAnnual;
                if (availCasual >= rem) {
                    cur.casual = availCasual - rem;
                    deductedFromCasual = rem;
                    alertMessage = `تم استنفاذ رصيد السنوي، وتم خصم ${rem} يوم من رصيد العارضة.`;
                } else {
                    deductedFromCasual = availCasual;
                    cur.casual = 0;
                    const unpaidPart = rem - availCasual;
                    cur.unpaid = Number(cur.unpaid || 0) + unpaidPart;
                    deductedFromUnpaid = unpaidPart;
                    alertMessage = `تم استنفاذ رصيد السنوي والعارضة، تم تسجيل ${unpaidPart} يوم كـ غياب بأذن (تخصم من الراتب).`;
                }
                shouldSendInAppNotif = true;
            } else {
                if (availCasual >= days) {
                    cur.casual = availCasual - days;
                    deductedFromCasual = days;
                    alertMessage = `رصيد السنوي منتهي، تم خصم ${days} يوم من رصيد العارضة.`;
                } else {
                    deductedFromCasual = availCasual;
                    cur.casual = 0;
                    const unpaidPart = days - availCasual;
                    cur.unpaid = Number(cur.unpaid || 0) + unpaidPart;
                    deductedFromUnpaid = unpaidPart;
                    alertMessage = `رصيد السنوي والعارضة منتهيان، تم تسجيل ${unpaidPart} يوم كـ غياب بأذن (تخصم من الراتب).`;
                }
                shouldSendInAppNotif = true;
            }
        }
        // 4. غياب بإذن (تخصم من الراتب)
        else if (leaveType === 'unpaid') {
            cur.unpaid = Number(cur.unpaid || 0) + days;
            deductedFromUnpaid = days;
            alertMessage = `تم تسجيل ${days} يوم كـ غياب بأذن (تخصم من الراتب).`;
        }
        // 5. جزاء
        else if (leaveType === 'penalty') {
            cur.penalty = Number((cur as any).penalty || 0) + days;
            alertMessage = `تم تسجيل جزاء ${days} يوم بنجاح.`;
        }

        await set(balanceRef, cur);
        
        const newLeaveData: any = {
            userId: selectedUser,
            employeeName: targetUser.name || targetUser.username || 'Unknown',
            date: leaveDate,
            days: days,
            type: effectiveType,
            deductedFromAnnual,
            deductedFromCasual,
            deductedFromUnpaid,
            timestamp: new Date(leaveDate).getTime()
        };
        if (effectiveType === 'custom') {
            newLeaveData.customLabel = customLeaveName.trim();
        }
        if (effectiveType === 'summer') {
            newLeaveData.deductedFromAnnual = deductedFromAnnual;
        }

        await push(ref(db, 'leave_history'), newLeaveData);

        // إرسال إشعار في التطبيق للموظف في حال وجود خصم أو نفاد رصيد
        if (shouldSendInAppNotif && targetUser.key) {
            try {
                const notifRef = push(ref(db, `notifications/${targetUser.key}`));
                await set(notifRef, {
                    id: notifRef.key,
                    message: alertMessage,
                    sender: user.name || 'الإدارة',
                    timestamp: Date.now(),
                    isRead: false,
                    actionType: 'leave',
                    dateString: new Date().toLocaleDateString('ar-EG'),
                    timeString: new Date().toLocaleTimeString('ar-EG')
                });
            } catch (err) {
                console.error("Error sending leave notification:", err);
            }
        }
        
        setShowAddLeaveModal(false);
        setCustomLeaveName('');
        alert(alertMessage);
    };

    const handleUpdateBalance = async () => {
        if(!showEditBalanceModal) return;
        await set(ref(db, `leave_balances/${showEditBalanceModal.userId}`), showEditBalanceModal);
        setShowEditBalanceModal(null);
        alert("تم تحديث الرصيد بنجاح");
    };

    const handleExportExcel = () => {
        if (!exportStartDate || !exportEndDate) {
            return alert("يرجى تحديد فترة التقرير (من وإلى)");
        }
        if (new Date(exportStartDate) > new Date(exportEndDate)) {
            return alert("تاريخ البداية يجب أن يكون قبل تاريخ النهاية");
        }

        const startTS = new Date(exportStartDate);
        startTS.setHours(0,0,0,0);
        const endTS = new Date(exportEndDate);
        endTS.setHours(23,59,59,999);

        const getRandomTime = (startHour, startMin, endHour, endMin) => {
            const totalStartMins = startHour * 60 + startMin;
            const totalEndMins = endHour * 60 + endMin;
            const randomMins = Math.floor(Math.random() * (totalEndMins - totalStartMins + 1)) + totalStartMins;
            const h = Math.floor(randomMins / 60);
            const m = randomMins % 60;
            // Format to 12-hour AM/PM for better readability, or 24h as per requirement: (09:00 to 09:35)
            return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        };

        const generateRandomIn = () => getRandomTime(9, 0, 9, 35);
        const generateRandomOut = (userName = "") => {
            const lowerName = userName.toLowerCase();
            if (lowerName.includes('coordinator') || lowerName.includes('منسق')) {
                return getRandomTime(4, 45, 5, 15);
            } else if (lowerName.includes('usher') || lowerName.includes('أشر') || lowerName.includes('اشر')) {
                return getRandomTime(5, 45, 6, 15);
            }
            return getRandomTime(5, 45, 6, 15);
        };

        const weekdaysArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
        
        let usersToExport = usersList.filter(u => !u.isArchived);
        if (selectedEmployeeForExport !== 'all') {
            usersToExport = usersList.filter(u => u.key === selectedEmployeeForExport);
        }

        if(usersToExport.length === 0) return alert("لا توجد بيانات تطابق الاختيارات المختارة");

        const sheets: any[] = [];

        usersToExport.forEach(u => {
            const uBalance = balances[u.key!] || {};
            const weeklyDays = uBalance.weeklyDays || [];
            
            const aoa: any[][] = [];
            aoa.push([`${u.name} (${u.role || 'موظف'})`]);
            aoa.push(["اليوم", "التاريخ", "الحضور", "الانصراف", "ملاحظات"]);

            const userHistory = allHistory.filter(h => h.userId === u.key);
            const leaveDaysMap = new Map();
            userHistory.forEach(record => {
                const rDate = new Date(record.date);
                const rDays = Math.ceil(record.days);
                for (let i = 0; i < rDays; i++) {
                    const d = new Date(rDate);
                    d.setDate(d.getDate() + i);
                    const y = d.getFullYear();
                    const m = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const dStr = `${y}-${m}-${day}`;
                    leaveDaysMap.set(dStr, record);
                }
            });
            
            const monthlyLeaveCount: Record<string, number> = {}; 

            for (let d = new Date(startTS); d <= endTS; d.setDate(d.getDate() + 1)) {
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const dayNum = String(d.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${dayNum}`;
                
                const dayName = weekdaysArabic[d.getDay()];
                
                let cycleMonth = d.getMonth();
                let cycleYear = d.getFullYear();
                if (d.getDate() >= 21) {
                    cycleMonth += 1;
                    if (cycleMonth > 11) {
                        cycleMonth = 0;
                        cycleYear += 1;
                    }
                }
                const monthKey = `${cycleYear}-${cycleMonth}`;
                
                if (!monthlyLeaveCount[monthKey]) monthlyLeaveCount[monthKey] = 0;

                let attIn = "";
                let attOut = "";
                let notes = "";

                const leaveRecord = leaveDaysMap.get(dateStr);
                
                if (weeklyDays.includes(dayName)) {
                    attIn = "إجازة";
                    attOut = "أسبوعية";
                    notes = "";
                } else if (leaveRecord) {
                    const type = leaveRecord.type;
                    if (type === 'official') {
                        attIn = generateRandomIn();
                        attOut = generateRandomOut(u.name);
                        notes = "يوم إضافي";
                    } else if (type === 'penalty') {
                        attIn = "غياب";
                        attOut = "بإذن";
                        notes = `جزاء خصم ${leaveRecord.days} يوم`;
                    } else if (type === 'unpaid') {
                        attIn = "غياب";
                        attOut = "بإذن";
                        notes = "تخصم من الراتب";
                    } else if (type === 'summer') {
                        attIn = "إجازة";
                        attOut = "سنوي";
                        notes = "إجازة مصيف";
                    } else if (type === 'casual') {
                        monthlyLeaveCount[monthKey]++;
                        // Check if casual balance is exhausted and annual is exhausted
                        let isSalaryDeduction = false;
                        if (monthlyLeaveCount[monthKey] > 2) {
                            isSalaryDeduction = true; // Exceeded monthly casual limit
                        }
                        
                        // User requested: "وفي حاله انهاء رصيد العارضه وانتهاء رصيد السنوي يتم ظهور في خانه الملاحظات في الاكسيل تخصم من الراتب"
                        // Since we just have the current balance, we can check it
                        const casualBal = Number(uBalance.casual || 0);
                        const annualBal = Number(uBalance.annual || 0);
                        if (casualBal <= 0 && annualBal <= 0) {
                            isSalaryDeduction = true;
                        }

                        if (isSalaryDeduction) {
                            attIn = "غياب";
                            attOut = "بإذن";
                            notes = "تخصم من الراتب";
                        } else {
                            attIn = "إجازة";
                            attOut = typeLabels[type] || "عارضة";
                            if (monthlyLeaveCount[monthKey] > 2 && annualBal > 0) {
                                notes = "تخصم من السنوي لتخطي العارضة";
                            } else if (casualBal <= 0 && annualBal > 0) {
                                notes = "تخصم من السنوي لانتهاء العارضة";
                            }
                        }
                    } else if (type === 'annual' || type === 'custom') {
                        const annualBal = Number(uBalance.annual || 0);
                        if (annualBal <= 0) {
                            attIn = "غياب";
                            attOut = "بإذن";
                            notes = "تخصم من الراتب لانتهاء السنوي";
                        } else {
                            attIn = "إجازة";
                            attOut = typeLabels[type] || leaveRecord.customLabel || "سنوي";
                        }
                    } else {
                        attIn = "إجازة";
                        attOut = typeLabels[type] || type;
                    }
                } else {
                    attIn = generateRandomIn();
                    attOut = generateRandomOut(u.name);
                }

                const formattedExportDate = `${dayNum}/${m}/${y}`;
                aoa.push([dayName, formattedExportDate, attIn, attOut, notes]);
            }
            
            sheets.push({
                name: (u.name || 'موظف').substring(0, 31),
                data: aoa,
                isAoa: true
            });
        });

        exportToExcel(sheets, `التقرير_الشامل_للموارد_البشرية_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}`);
        setShowExportModal(false);
    };

    const activeUsersList = usersList.filter(u => !u.isArchived);
    const archivedUsersList = usersList.filter(u => u.isArchived);

    const displayedUsers = user.role === 'admin' 
        ? (viewArchived ? archivedUsersList : activeUsersList).filter(u => filterUser === 'all' || u.key === filterUser)
        : activeUsersList.filter(u => u.name === user.name);

    const handleSaveWeekly = async () => {
        if (!weeklyUser || !weeklyDay) return alert("اكمل البيانات");
        const balanceRef = ref(db, `leave_balances/${weeklyUser}`);
        const snap = await get(balanceRef);
        let cur = snap.exists() ? snap.val() : { userId: weeklyUser, annual: 21, casual: 7, sick: 0, exams: 0, unpaid: 0 };
        
        const days = cur.weeklyDays || [];
        if (!days.includes(weeklyDay)) {
            days.push(weeklyDay);
        }
        cur.weeklyDays = days;
        await set(balanceRef, cur);
        alert("تم حفظ الإجازة الأسبوعية للحساب");
        setShowWeeklyModal(false);
    };

    const selectedRouteUserName = activeUsersList.find(u => u.key === selectedRouteUser)?.name || '';

    const handleExportRouteExcel = (targetUserKey?: string) => {
        const filterKey = targetUserKey !== undefined ? targetUserKey : selectedRouteUser;
        if (!filterKey) {
            alert('يرجى اختيار اسم الموظف أو اختيار "الكل" للتصدير');
            return;
        }

        const eligibleUsers = activeUsersList.filter(
            u => u.name !== 'المدير العام' && u.name !== 'Mr. Khaled attef' && !(u.name && u.name.includes('@'))
        );

        const usersToExport = filterKey === 'all'
            ? eligibleUsers
            : eligibleUsers.filter(u => u.key === filterKey);

        if (usersToExport.length === 0) {
            alert('لا يوجد موظف محدد للتصدير');
            return;
        }

        const userBranchesMap: Record<string, string[]> = {};
        usersToExport.forEach(u => {
            let branches = allRoutes[u.key!] || [];
            if (filterKey === u.key && routeBranches && routeBranches.length > 0) {
                const nonEmpty = routeBranches.filter(b => b && b.trim() !== '');
                if (nonEmpty.length > 0) branches = routeBranches;
            }
            userBranchesMap[u.key!] = branches.filter(b => b && b.trim() !== '');
        });

        // ترتيب الموظفين: الأكثر فروعاً بالأعلى والأقل فروعاً بالأسفل
        const sortedUsers = [...usersToExport].sort((a, b) => {
            return (userBranchesMap[b.key!]?.length || 0) - (userBranchesMap[a.key!]?.length || 0);
        });

        const activeUsersWithRoutes = filterKey === 'all'
            ? sortedUsers.filter(u => (userBranchesMap[u.key!]?.length || 0) > 0)
            : sortedUsers;

        if (activeUsersWithRoutes.length === 0 && filterKey === 'all') {
            alert('لا توجد أي فروع مسجلة لتصديرها');
            return;
        }

        const aoa: any[][] = [];
        aoa.push(['بيان خطوط السير والفروع المسجلة']);
        aoa.push([`تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`]);
        aoa.push([]);

        // تقسيم الأسماء بالعرض في صفوف من 5 موظفين جنباً إلى جنب
        const chunks: (typeof activeUsersWithRoutes)[] = [];
        for (let i = 0; i < activeUsersWithRoutes.length; i += 5) {
            chunks.push(activeUsersWithRoutes.slice(i, i + 5));
        }

        chunks.forEach((chunk) => {
            // صف الأسماء بالعرض بجانب بعض
            const headerRow = chunk.map(u => u.name);
            aoa.push(headerRow);

            // أقصى عدد فروع في هذه المجموعة
            const chunkMaxBranches = Math.max(1, ...chunk.map(u => (userBranchesMap[u.key!] || []).length));

            for (let r = 0; r < chunkMaxBranches; r++) {
                const row = chunk.map(u => {
                    const branches = userBranchesMap[u.key!] || [];
                    return branches[r] || '';
                });
                aoa.push(row);
            }

            aoa.push([]); // سطر فارغ فاصل بين كل صف
        });

        const targetUserObj = eligibleUsers.find(u => u.key === filterKey);
        const targetName = filterKey === 'all'
            ? 'جميع_الموظفين'
            : (targetUserObj?.name || 'الموظف').replace(/\s+/g, '_');

        const fileName = `خط_السير_${targetName}_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}`;
        exportToExcel([{ name: 'خطوط السير', data: aoa, isAoa: true }], fileName);
    };

    const handleExportRoutePDF = async (targetUserKey?: string) => {
        const filterKey = targetUserKey !== undefined ? targetUserKey : selectedRouteUser;
        if (!filterKey) {
            alert('يرجى اختيار اسم الموظف أو اختيار "الكل" لتصدير PDF');
            return;
        }

        const eligibleUsers = activeUsersList.filter(
            u => u.name !== 'المدير العام' && u.name !== 'Mr. Khaled attef' && !(u.name && u.name.includes('@'))
        );

        if (filterKey === 'all') {
            const hasAny = eligibleUsers.some(u => {
                const b = allRoutes[u.key!] || [];
                return b.some(x => x && x.trim() !== '');
            });
            if (!hasAny) {
                alert('لا توجد أي فروع مسجلة لتصديرها');
                return;
            }
        }

        setRouteExportTarget(filterKey);
        setIsExportingRoutePDF(true);

        try {
            await new Promise(r => setTimeout(r, 100));
            const container = routePrintContainerRef.current;
            if (!container) return;

            // ضبط الحاوية بموضع ثابت أعلى الشاشة لمنع أي اقتطاع بسبب التمرير أو حدود الحاويات الأبوية
            container.style.display = 'flex';
            container.style.position = 'fixed';
            container.style.top = '0px';
            container.style.left = '0px';
            container.style.zIndex = '99999';
            container.style.width = '1300px';

            await new Promise(r => setTimeout(r, 200));

            const canvas = await html2canvas(container, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                scrollX: 0,
                scrollY: 0,
                x: 0,
                y: 0,
                width: container.offsetWidth || 1300,
                height: container.offsetHeight,
                windowWidth: 1400
            });

            container.style.display = 'none';
            container.style.position = '';
            container.style.top = '';
            container.style.left = '';
            container.style.zIndex = '';

            const imgData = canvas.toDataURL('image/jpeg', 0.98);
            // الورقة بالعرض (Landscape A4: 297mm x 210mm)
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth(); // 297 mm
            const pdfHeight = pdf.internal.pageSize.getHeight(); // 210 mm

            // أخذ مساحة الورقة كاملة حتى الحواف (هامش 3 مم فقط)
            const margin = 3;
            const availableWidth = pdfWidth - (margin * 2); // 291 mm
            const availableHeight = pdfHeight - (margin * 2); // 204 mm

            const canvasRatio = canvas.width / canvas.height;
            const pageRatio = availableWidth / availableHeight;

            let finalWidth = availableWidth;
            let finalHeight = availableHeight;

            if (canvasRatio > pageRatio) {
                finalWidth = availableWidth;
                finalHeight = availableWidth / canvasRatio;
            } else {
                finalHeight = availableHeight;
                finalWidth = availableHeight * canvasRatio;
            }

            const posX = margin + (availableWidth - finalWidth) / 2;
            const posY = margin + (availableHeight - finalHeight) / 2;

            // ورقة واحدة فقط بالكامل
            pdf.addImage(imgData, 'JPEG', posX, posY, finalWidth, finalHeight);

            const targetUserObj = eligibleUsers.find(u => u.key === filterKey);
            const targetName = filterKey === 'all'
                ? 'جميع_الموظفين'
                : (targetUserObj?.name || 'الموظف').replace(/\s+/g, '_');

            const dateStr = new Date().toISOString().split('T')[0];
            pdf.save(`خط_السير_${targetName}_${dateStr}.pdf`);
        } catch (err) {
            console.error('Error exporting route PDF:', err);
            alert('حدث خطأ أثناء تصدير ملف PDF');
        } finally {
            if (routePrintContainerRef.current) {
                routePrintContainerRef.current.style.display = 'none';
                routePrintContainerRef.current.style.position = '';
                routePrintContainerRef.current.style.top = '';
                routePrintContainerRef.current.style.left = '';
                routePrintContainerRef.current.style.zIndex = '';
            }
            setIsExportingRoutePDF(false);
        }
    };

    const handleExportFullLeavePDF = async () => {
        if (!historyUserView) return;
        setIsExportingFullLeavePDF(true);
        const now = new Date();
        setPdfExportTime(now);

        try {
            await new Promise(r => setTimeout(r, 100));
            const container = fullHistoryPrintContainerRef.current;
            if (!container) return;

            // ضبط الحاوية بموضع ثابت أعلى الشاشة لمنع أي اقتطاع بسبب التمرير أو أبعاد الشاشة
            container.style.display = 'block';
            container.style.position = 'fixed';
            container.style.top = '0px';
            container.style.left = '0px';
            container.style.zIndex = '99999';
            container.style.width = '1050px';

            await new Promise(r => setTimeout(r, 200));

            const pageElements = container.querySelectorAll('.leave-pdf-page');
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth(); // 210 mm
            const pdfPageHeight = pdf.internal.pageSize.getHeight(); // 297 mm

            if (pageElements && pageElements.length > 0) {
                for (let i = 0; i < pageElements.length; i++) {
                    const pageEl = pageElements[i] as HTMLElement;
                    const canvas = await html2canvas(pageEl, {
                        scale: 2,
                        useCORS: true,
                        backgroundColor: '#ffffff',
                        logging: false,
                        scrollX: 0,
                        scrollY: 0,
                        x: 0,
                        y: 0,
                        width: pageEl.offsetWidth || 1050,
                        height: pageEl.offsetHeight,
                        windowWidth: 1100
                    });

                    const imgData = canvas.toDataURL('image/jpeg', 0.98);
                    const imgHeight = (canvas.height * pdfWidth) / canvas.width;

                    if (i > 0) {
                        pdf.addPage();
                    }
                    pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(pdfPageHeight, imgHeight));
                }
            } else {
                const canvas = await html2canvas(container, {
                    scale: 2,
                    useCORS: true,
                    backgroundColor: '#ffffff',
                    logging: false,
                    scrollX: 0,
                    scrollY: 0,
                    x: 0,
                    y: 0,
                    width: container.offsetWidth || 1050,
                    height: container.offsetHeight,
                    windowWidth: 1100
                });

                const imgData = canvas.toDataURL('image/jpeg', 0.98);
                const imgHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, Math.min(pdfPageHeight, imgHeight));
            }

            container.style.display = 'none';
            container.style.position = '';
            container.style.top = '';
            container.style.left = '';
            container.style.zIndex = '';

            const safeEmpName = (historyUserView.name || 'الموظف').replace(/\s+/g, '_');
            const dateStr = now.toISOString().split('T')[0];
            pdf.save(`سجل_إجازات_${safeEmpName}_${dateStr}.pdf`);
        } catch (error) {
            console.error('Error generating leave history PDF:', error);
            alert('حدث خطأ أثناء إنشاء ملف الـ PDF، يرجى المحاولة مرة أخرى.');
        } finally {
            if (fullHistoryPrintContainerRef.current) {
                fullHistoryPrintContainerRef.current.style.display = 'none';
                fullHistoryPrintContainerRef.current.style.position = '';
                fullHistoryPrintContainerRef.current.style.top = '';
                fullHistoryPrintContainerRef.current.style.left = '';
                fullHistoryPrintContainerRef.current.style.zIndex = '';
            }
            setIsExportingFullLeavePDF(false);
        }
    };

    const handlePrintRoute = (targetUserKey?: string) => {
        const filterKey = targetUserKey !== undefined ? targetUserKey : selectedRouteUser;
        if (!filterKey) {
            alert('يرجى اختيار اسم الموظف أو اختيار "الكل" للطباعة');
            return;
        }

        const eligibleUsers = activeUsersList.filter(
            u => u.name !== 'المدير العام' && u.name !== 'Mr. Khaled attef' && !(u.name && u.name.includes('@'))
        );

        if (filterKey === 'all') {
            const hasAny = eligibleUsers.some(u => {
                const b = allRoutes[u.key!] || [];
                return b.some(x => x && x.trim() !== '');
            });
            if (!hasAny) {
                alert('لا توجد أي فروع مسجلة لطباعتها');
                return;
            }
        }

        setRouteExportTarget(filterKey);

        setTimeout(() => {
            const container = routePrintContainerRef.current;
            if (!container) return;

            container.style.display = 'flex';

            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentWindow?.document;
            if (iframeDoc) {
                iframeDoc.open();
                iframeDoc.write(`
                    <!DOCTYPE html>
                    <html dir="rtl" lang="ar">
                    <head>
                        <meta charset="utf-8" />
                        <title>طباعة خط السير</title>
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
                            @page {
                                size: A4 landscape;
                                margin: 3mm;
                            }
                            * {
                                box-sizing: border-box;
                            }
                            body {
                                font-family: 'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                direction: rtl;
                                margin: 0;
                                padding: 0;
                                color: #111827;
                                background-color: #ffffff;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            table {
                                width: 100%;
                                height: 100%;
                                table-layout: fixed;
                                border-collapse: collapse;
                            }
                            th, td {
                                text-align: center;
                                vertical-align: middle;
                            }
                        </style>
                    </head>
                    <body>
                        ${container.innerHTML}
                    </body>
                    </html>
                `);
                iframeDoc.close();
                setTimeout(() => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                    setTimeout(() => {
                        try {
                            document.body.removeChild(iframe);
                        } catch (e) {}
                        container.style.display = 'none';
                    }, 1000);
                }, 300);
            } else {
                container.style.display = 'none';
            }
        }, 100);
    };

    const WEEK_DAYS = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'];

    // توليد توزيع تلقائي بمعدل 3 زيارات لكل فرع موزعة على أيام الأسبوع من السبت إلى الخميس
    const generateDefaultScheduleForBranches = (branches: string[]): Record<string, string[]> => {
        const cleanBranches = branches.filter(b => b && b.trim() !== '');
        const schedule: Record<string, string[]> = {
            'السبت': [],
            'الأحد': [],
            'الإثنين': [],
            'الثلاثاء': [],
            'الأربعاء': [],
            'الخميس': []
        };

        if (cleanBranches.length === 0) return schedule;

        // أنماط التوزيع الشائعة لـ 3 أيام أسبوعياً
        const patterns = [
            ['السبت', 'الإثنين', 'الأربعاء'],
            ['الأحد', 'الثلاثاء', 'الخميس'],
            ['السبت', 'الثلاثاء', 'الخميس'],
            ['الأحد', 'الإثنين', 'الأربعاء'],
            ['السبت', 'الأربعاء', 'الخميس'],
            ['الأحد', 'الإثنين', 'الثلاثاء']
        ];

        cleanBranches.forEach((branch, idx) => {
            const pattern = patterns[idx % patterns.length];
            pattern.forEach(day => {
                if (!schedule[day].includes(branch)) {
                    schedule[day].push(branch);
                }
            });
        });

        return schedule;
    };

    // جلب الجدول الفعلي للموظف سواء كان محفوظاً مسبقاً أو التوزيع التلقائي من فروع خط السير
    const getEffectiveSchedule = (userKey: string): Record<string, string[]> => {
        if (userKey === selectedScheduleUser && currentSchedule) {
            return currentSchedule;
        }
        const saved = allRouteSchedules[userKey];
        if (saved && typeof saved === 'object') {
            return {
                'السبت': Array.isArray(saved['السبت']) ? saved['السبت'] : [],
                'الأحد': Array.isArray(saved['الأحد']) ? saved['الأحد'] : [],
                'الإثنين': Array.isArray(saved['الإثنين']) ? saved['الإثنين'] : [],
                'الثلاثاء': Array.isArray(saved['الثلاثاء']) ? saved['الثلاثاء'] : [],
                'الأربعاء': Array.isArray(saved['الأربعاء']) ? saved['الأربعاء'] : [],
                'الخميس': Array.isArray(saved['الخميس']) ? saved['الخميس'] : []
            };
        }
        const branches = allRoutes[userKey] || [];
        return generateDefaultScheduleForBranches(branches);
    };

    const handleSelectScheduleUser = (userKey: string) => {
        setSelectedScheduleUser(userKey);
        if (!userKey || userKey === 'all') return;

        const saved = allRouteSchedules[userKey];
        if (saved && typeof saved === 'object') {
            setCurrentSchedule({
                'السبت': Array.isArray(saved['السبت']) ? [...saved['السبت']] : [],
                'الأحد': Array.isArray(saved['الأحد']) ? [...saved['الأحد']] : [],
                'الإثنين': Array.isArray(saved['الإثنين']) ? [...saved['الإثنين']] : [],
                'الثلاثاء': Array.isArray(saved['الثلاثاء']) ? [...saved['الثلاثاء']] : [],
                'الأربعاء': Array.isArray(saved['الأربعاء']) ? [...saved['الأربعاء']] : [],
                'الخميس': Array.isArray(saved['الخميس']) ? [...saved['الخميس']] : []
            });
        } else {
            const branches = allRoutes[userKey] || [];
            setCurrentSchedule(generateDefaultScheduleForBranches(branches));
        }
    };

    const handleSaveSchedule = async () => {
        if (!selectedScheduleUser || selectedScheduleUser === 'all') {
            alert('يرجى اختيار موظف لحفظ خط السير');
            return;
        }
        setIsSavingSchedule(true);
        try {
            await set(ref(db, `routeSchedules/${selectedScheduleUser}`), currentSchedule);
            alert('تم حفظ جدول خط السير بنجاح للموظف');
        } catch (e: any) {
            alert('حدث خطأ أثناء حفظ جدول خط السير: ' + e.message);
        } finally {
            setIsSavingSchedule(false);
        }
    };

    const handleAutoDistributeSchedule = () => {
        if (!selectedScheduleUser || selectedScheduleUser === 'all') return;
        const branches = allRoutes[selectedScheduleUser] || [];
        if (branches.filter(b => b.trim() !== '').length === 0) {
            alert('لا توجد فروع مسجلة في خط سير هذا الموظف بعد');
            return;
        }
        setCurrentSchedule(generateDefaultScheduleForBranches(branches));
    };

    const handleAddBranchToDay = (day: string, branchName: string) => {
        if (!branchName || !branchName.trim()) return;
        setCurrentSchedule(prev => {
            const currentDayBranches = prev[day] || [];
            if (currentDayBranches.includes(branchName.trim())) return prev;
            return {
                ...prev,
                [day]: [...currentDayBranches, branchName.trim()]
            };
        });
    };

    const handleRemoveBranchFromDay = (day: string, branchIdx: number) => {
        setCurrentSchedule(prev => {
            const currentDayBranches = [...(prev[day] || [])];
            currentDayBranches.splice(branchIdx, 1);
            return {
                ...prev,
                [day]: currentDayBranches
            };
        });
    };

    const handleToggleBranchDay = (branch: string, day: string) => {
        setCurrentSchedule(prev => {
            const currentDayBranches = prev[day] || [];
            const exists = currentDayBranches.includes(branch);
            return {
                ...prev,
                [day]: exists 
                    ? currentDayBranches.filter(b => b !== branch)
                    : [...currentDayBranches, branch]
            };
        });
    };

    // تصدير إكسيل للموظف المختار
    const handleExportSingleScheduleExcel = (userKey: string) => {
        const userObj = activeUsersList.find(u => u.key === userKey);
        const userName = userObj?.name || 'الموظف';
        const schedule = getEffectiveSchedule(userKey);

        const aoa: any[][] = [];
        aoa.push([`جدول خط السير الأسبوعي للموظف: ${userName}`]);
        aoa.push([`تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`]);
        aoa.push([]);

        // صف أسماء الأيام
        aoa.push(WEEK_DAYS);

        // عدد الصفوف بناءً على أقصى عدد فروع في أي يوم
        const maxBranches = Math.max(1, ...WEEK_DAYS.map(day => (schedule[day] || []).length));
        for (let r = 0; r < maxBranches; r++) {
            const row = WEEK_DAYS.map(day => (schedule[day] || [])[r] || '');
            aoa.push(row);
        }

        const fileName = `جدول_سير_${userName.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}`;
        exportToExcel([{ name: 'جدول خط السير', data: aoa, isAoa: true }], fileName);
    };

    // تصدير PDF للموظف المختار
    const handleExportSingleSchedulePDF = async (userKey: string) => {
        const userObj = activeUsersList.find(u => u.key === userKey);
        const userName = userObj?.name || 'الموظف';
        setScheduleExportTarget(userKey);
        setIsExportingSchedulePDF(true);

        try {
            await new Promise(r => setTimeout(r, 100));
            const container = schedulePrintContainerRef.current;
            if (!container) return;

            container.style.display = 'flex';
            container.style.position = 'fixed';
            container.style.top = '0px';
            container.style.left = '0px';
            container.style.zIndex = '99999';
            container.style.width = '1300px';

            await new Promise(r => setTimeout(r, 200));

            const canvas = await html2canvas(container, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                scrollX: 0,
                scrollY: 0,
                x: 0,
                y: 0,
                width: container.offsetWidth || 1300,
                height: container.offsetHeight,
                windowWidth: 1400
            });

            container.style.display = 'none';
            container.style.position = '';
            container.style.top = '';
            container.style.left = '';
            container.style.zIndex = '';

            const imgData = canvas.toDataURL('image/jpeg', 0.98);
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 3;
            const availableWidth = pdfWidth - (margin * 2);
            const availableHeight = pdfHeight - (margin * 2);

            const canvasRatio = canvas.width / canvas.height;
            let renderWidth = availableWidth;
            let renderHeight = renderWidth / canvasRatio;
            if (renderHeight > availableHeight) {
                renderHeight = availableHeight;
                renderWidth = renderHeight * canvasRatio;
            }

            const posX = margin + (availableWidth - renderWidth) / 2;
            const posY = margin + (availableHeight - renderHeight) / 2;

            pdf.addImage(imgData, 'JPEG', posX, posY, renderWidth, renderHeight);
            const fileName = `جدول_سير_${userName.replace(/\s+/g, '_')}_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.pdf`;
            pdf.save(fileName);
        } catch (e: any) {
            alert('حدث خطأ أثناء تصدير PDF: ' + e.message);
        } finally {
            setIsExportingSchedulePDF(false);
        }
    };

    // طباعة مباشرة لجدول الموظف
    const handlePrintSingleSchedule = (userKey: string) => {
        setScheduleExportTarget(userKey);
        setTimeout(() => {
            const container = schedulePrintContainerRef.current;
            if (!container) return;
            container.style.display = 'flex';
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentWindow?.document;
            if (iframeDoc) {
                iframeDoc.open();
                iframeDoc.write(`
                    <!DOCTYPE html>
                    <html dir="rtl" lang="ar">
                    <head>
                        <meta charset="utf-8" />
                        <title>طباعة جدول خط السير</title>
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
                            @page { size: A4 landscape; margin: 4mm; }
                            * { box-sizing: border-box; }
                            body {
                                font-family: 'Cairo', system-ui, sans-serif;
                                direction: rtl;
                                margin: 0;
                                padding: 0;
                                color: #111827;
                                background-color: #ffffff;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                            th, td { text-align: center; vertical-align: middle; border: 1px solid #d1d5db; padding: 6px; }
                        </style>
                    </head>
                    <body>
                        ${container.innerHTML}
                    </body>
                    </html>
                `);
                iframeDoc.close();
                setTimeout(() => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                    setTimeout(() => {
                        try { document.body.removeChild(iframe); } catch (e) {}
                        container.style.display = 'none';
                    }, 1000);
                }, 300);
            } else {
                container.style.display = 'none';
            }
        }, 100);
    };

    // تصدير إكسيل لجدول جميع الموظفين
    const handleExportAllSchedulesExcel = () => {
        const eligibleUsers = activeUsersList
            .filter(u => u.name !== 'المدير العام' && u.name !== 'Mr. Khaled attef' && !(u.name && u.name.includes('@')))
            .filter(u => {
                const sched = getEffectiveSchedule(u.key!);
                const count = WEEK_DAYS.reduce((sum, d) => sum + (sched[d]?.length || 0), 0);
                return count > 0;
            });

        if (eligibleUsers.length === 0) {
            alert('لا توجد جداول خطوط سير مسجلة لأي موظف للتصدير');
            return;
        }

        const aoa: any[][] = [];
        aoa.push(['جدول خطوط السير الأسبوعية لجميع الموظفين']);
        aoa.push([`تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')} - ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`]);
        aoa.push([]);

        const headers = ['م', 'اسم الموظف', ...WEEK_DAYS];
        aoa.push(headers);

        eligibleUsers.forEach((u, idx) => {
            const sched = getEffectiveSchedule(u.key!);
            const row = [
                idx + 1,
                u.name,
                ...WEEK_DAYS.map(d => (sched[d] || []).join(' - '))
            ];
            aoa.push(row);
        });

        const fileName = `جدول_سير_جميع_الموظفين_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}`;
        exportToExcel([{ name: 'جدول خطوط السير', data: aoa, isAoa: true }], fileName);
    };

    // تصدير PDF لجدول جميع الموظفين
    const handleExportAllSchedulesPDF = async () => {
        const eligibleUsers = activeUsersList
            .filter(u => u.name !== 'المدير العام' && u.name !== 'Mr. Khaled attef' && !(u.name && u.name.includes('@')))
            .filter(u => {
                const sched = getEffectiveSchedule(u.key!);
                const count = WEEK_DAYS.reduce((sum, d) => sum + (sched[d]?.length || 0), 0);
                return count > 0;
            });

        if (eligibleUsers.length === 0) {
            alert('لا توجد جداول خطوط سير مسجلة لأي موظف للتصدير');
            return;
        }

        setIsExportingSchedulePDF(true);

        try {
            await new Promise(r => setTimeout(r, 100));
            const container = allSchedulePrintContainerRef.current;
            if (!container) return;

            container.style.display = 'flex';
            container.style.position = 'fixed';
            container.style.top = '0px';
            container.style.left = '0px';
            container.style.zIndex = '99999';
            container.style.width = '1300px';

            await new Promise(r => setTimeout(r, 200));

            const canvas = await html2canvas(container, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                scrollX: 0,
                scrollY: 0,
                x: 0,
                y: 0,
                width: container.offsetWidth || 1300,
                height: container.offsetHeight,
                windowWidth: 1400
            });

            container.style.display = 'none';
            container.style.position = '';
            container.style.top = '';
            container.style.left = '';
            container.style.zIndex = '';

            const imgData = canvas.toDataURL('image/jpeg', 0.98);
            const pdf = new jsPDF('l', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 3;
            const availableWidth = pdfWidth - (margin * 2);
            const availableHeight = pdfHeight - (margin * 2);

            const canvasRatio = canvas.width / canvas.height;
            let renderWidth = availableWidth;
            let renderHeight = renderWidth / canvasRatio;
            if (renderHeight > availableHeight) {
                renderHeight = availableHeight;
                renderWidth = renderHeight * canvasRatio;
            }

            const posX = margin + (availableWidth - renderWidth) / 2;
            const posY = margin + (availableHeight - renderHeight) / 2;

            pdf.addImage(imgData, 'JPEG', posX, posY, renderWidth, renderHeight);
            const fileName = `جدول_سير_جميع_الموظفين_${new Date().toLocaleDateString('ar-EG').replace(/\//g, '-')}.pdf`;
            pdf.save(fileName);
        } catch (e: any) {
            alert('حدث خطأ أثناء تصدير PDF: ' + e.message);
        } finally {
            setIsExportingSchedulePDF(false);
        }
    };

    // طباعة مباشرة لجدول جميع الموظفين
    const handlePrintAllSchedules = () => {
        setTimeout(() => {
            const container = allSchedulePrintContainerRef.current;
            if (!container) return;
            container.style.display = 'flex';
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);

            const iframeDoc = iframe.contentWindow?.document;
            if (iframeDoc) {
                iframeDoc.open();
                iframeDoc.write(`
                    <!DOCTYPE html>
                    <html dir="rtl" lang="ar">
                    <head>
                        <meta charset="utf-8" />
                        <title>طباعة جدول خطوط السير لجميع الموظفين</title>
                        <style>
                            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
                            @page { size: A4 landscape; margin: 4mm; }
                            * { box-sizing: border-box; }
                            body {
                                font-family: 'Cairo', system-ui, sans-serif;
                                direction: rtl;
                                margin: 0;
                                padding: 0;
                                color: #111827;
                                background-color: #ffffff;
                                -webkit-print-color-adjust: exact;
                                print-color-adjust: exact;
                            }
                            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
                            th, td { text-align: center; vertical-align: middle; border: 1px solid #d1d5db; padding: 6px; }
                        </style>
                    </head>
                    <body>
                        ${container.innerHTML}
                    </body>
                    </html>
                `);
                iframeDoc.close();
                setTimeout(() => {
                    iframe.contentWindow?.focus();
                    iframe.contentWindow?.print();
                    setTimeout(() => {
                        try { document.body.removeChild(iframe); } catch (e) {}
                        container.style.display = 'none';
                    }, 1000);
                }, 300);
            } else {
                container.style.display = 'none';
            }
        }, 100);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                    <History className="text-blue-500" /> رصيد الإجازات والغياب
                </h2>
                {user.role === 'admin' && (
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                        <select 
                            value={filterUser}
                            onChange={(e) => setFilterUser(e.target.value)}
                            className="w-full sm:w-auto bg-gray-800 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl text-xs sm:text-sm font-bold border border-white/10 shadow-xl outline-none"
                        >
                            <option value="all">الكل (عرض جميع الموظفين)</option>
                            {(viewArchived ? archivedUsersList : activeUsersList).map(u => (
                                <option key={u.key} value={u.key}>{u.name}</option>
                            ))}
                        </select>
                        <div className="grid grid-cols-3 gap-1 sm:flex sm:items-center sm:gap-2 w-full sm:w-auto">
                            <button 
                                onClick={() => setShowExportModal(true)} 
                                className="bg-green-600 hover:bg-green-500 text-white px-1 sm:px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-xs md:text-sm shadow-xl flex items-center justify-center gap-0.5 sm:gap-1.5 active:scale-95 transition whitespace-nowrap min-w-0"
                                title="تصدير إكسيل"
                            >
                                <FileSpreadsheet size={13} className="shrink-0" />
                                <span className="truncate">تصدير إكسيل</span>
                            </button>
                            <button 
                                onClick={() => setShowAddLeaveModal(true)} 
                                className="bg-red-600 hover:bg-red-500 text-white px-1 sm:px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-xs md:text-sm shadow-xl flex items-center justify-center gap-0.5 sm:gap-1.5 active:scale-95 transition whitespace-nowrap min-w-0"
                                title="تسجيل إجازة"
                            >
                                <CalendarPlus size={13} className="shrink-0" />
                                <span className="truncate">تسجيل إجازة</span>
                            </button>
                            <div className="relative group z-[9999] w-full sm:w-auto">
                                <button 
                                    type="button"
                                    onClick={() => setShowMoreMenu(prev => !prev)}
                                    className="w-full bg-gray-700 hover:bg-gray-600 text-white px-1 sm:px-3 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-xs md:text-sm shadow-xl flex items-center justify-center gap-0.5 sm:gap-1.5 transition cursor-pointer whitespace-nowrap min-w-0"
                                >
                                    <span className="truncate">المزيد ▼</span>
                                </button>
                                <div className={`absolute left-0 sm:right-0 sm:left-auto mt-1 w-44 sm:w-48 bg-gray-800 border border-white/10 rounded-xl shadow-2xl transition-all flex flex-col overflow-hidden max-h-[60vh] overflow-y-auto z-[99999] ${showMoreMenu ? 'opacity-100 visible' : 'opacity-0 invisible group-hover:opacity-100 group-hover:visible'}`}>
                                    <button 
                                        onClick={() => {
                                            setViewArchived(false);
                                            setFilterUser('all');
                                            setShowMoreMenu(false);
                                        }} 
                                        className="text-right px-3.5 py-2.5 text-xs sm:text-sm font-bold text-blue-300 hover:bg-white/10 transition flex items-center gap-2 cursor-pointer w-full"
                                    >
                                        <History size={14} className="text-blue-400 shrink-0" />
                                        <span>رصيد الإجازات</span>
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setShowWeeklyModal(true);
                                            setShowMoreMenu(false);
                                        }} 
                                        className="text-right px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-white/10 transition border-t border-white/5 cursor-pointer w-full"
                                    >
                                        إجازات أسبوعية
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setShowRouteModal(true);
                                            setShowMoreMenu(false);
                                        }} 
                                        className="text-right px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-white/10 transition border-t border-white/5 cursor-pointer w-full"
                                    >
                                        خط السير
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setShowScheduleModal(true);
                                            setShowMoreMenu(false);
                                        }} 
                                        className="text-right px-3.5 py-2.5 text-xs sm:text-sm font-bold text-indigo-300 hover:bg-white/10 transition border-t border-white/5 flex items-center gap-1.5 cursor-pointer w-full"
                                    >
                                        <CalendarIcon size={14} className="text-indigo-400 shrink-0" />
                                        <span>جدول سير</span>
                                    </button>
                                    <button 
                                        onClick={() => {
                                            setViewArchived(!viewArchived);
                                            setShowMoreMenu(false);
                                        }} 
                                        className="text-right px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-white/10 transition border-t border-white/5 flex items-center justify-between cursor-pointer w-full"
                                    >
                                        {viewArchived ? 'الموظفين الحاليين' : 'الأرشيف'}
                                        {viewArchived && <CheckCircle2 size={16} className="text-teal-400" />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ودجت دورة الشهر ورصيد الإجازات المتبقي */}
            <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 p-5 rounded-3xl border border-white/10 shadow-2xl space-y-4">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 border-b border-white/10 pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
                            <CalendarIcon size={22} />
                        </div>
                        <div>
                            <div className="text-xs font-black text-blue-400 uppercase tracking-wider">نطاق دورة الشهر (من 21 إلى 20)</div>
                            <div className="text-sm font-bold text-white mt-0.5">
                                من {periodDate.toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })} إلى {getPeriodEnd(periodDate).toLocaleDateString('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 bg-black/30 p-1.5 rounded-2xl border border-white/5">
                        <button onClick={() => changePeriod(-1)} className="p-2 hover:bg-white/10 text-white rounded-xl transition flex items-center gap-1 text-xs font-bold">
                            <ChevronRight size={16}/> الشهر السابق
                        </button>
                        <span className="px-3 text-xs font-black text-amber-400">
                            {periodDate.toLocaleDateString('ar-EG', { month: 'short', year: 'numeric' })}
                        </span>
                        {(() => {
                            const now = new Date();
                            const currentCycleStart = now.getDate() >= 21 
                                ? new Date(now.getFullYear(), now.getMonth(), 21) 
                                : new Date(now.getFullYear(), now.getMonth() - 1, 21);
                            const isCurrentPeriod = (periodDate.getFullYear() > currentCycleStart.getFullYear()) || 
                                (periodDate.getFullYear() === currentCycleStart.getFullYear() && periodDate.getMonth() >= currentCycleStart.getMonth());
                            
                            return !isCurrentPeriod ? (
                                <button onClick={() => changePeriod(1)} className="p-2 hover:bg-white/10 text-white rounded-xl transition flex items-center gap-1 text-xs font-bold">
                                    الشهر القادم <ChevronLeft size={16}/>
                                </button>
                            ) : null;
                        })()}
                    </div>
                </div>

                {/* بطاقات الرصيد المتبقي السريع */}
                {(() => {
                    let currentUserKey = user.key || usersList.find(u => u.name === user.name)?.key || (displayedUsers.length === 1 ? displayedUsers[0].key : null);
                    if (user.role === 'admin') {
                        const gm = usersList.find(u => u.name === 'المدير العام');
                        if (gm && gm.key) {
                            currentUserKey = gm.key;
                        }
                    }
                    const userBal = currentUserKey && balances[currentUserKey] ? balances[currentUserKey] : {
                        annual: 21,
                        casual: 7,
                        unpaid: 0,
                        sick: 0
                    };

                    const curYear = new Date().getFullYear();
                    const yStart = new Date(curYear, 0, 1, 0, 0, 0, 0);
                    const yEnd = new Date(curYear, 11, 31, 23, 59, 59, 999);

                    const currentUserYearHistory = currentUserKey ? allHistory.filter(h => {
                        if (h.userId !== currentUserKey) return false;
                        const d = new Date(h.date);
                        return d >= yStart && d <= yEnd;
                    }) : [];

                    const currentYearUnpaid = currentUserYearHistory
                        .filter(h => h.type === 'unpaid')
                        .reduce((sum, h) => sum + (Number(h.days) || 0), 0);

                    const currentYearSick = currentUserYearHistory
                        .filter(h => h.type === 'sick')
                        .reduce((sum, h) => sum + (Number(h.days) || 0), 0);

                    return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="bg-black/30 p-3.5 rounded-2xl border border-green-500/20 flex flex-col items-center justify-center text-center">
                                <span className="text-[11px] font-black text-green-400 uppercase">متبقي السنوي</span>
                                <span className="text-2xl font-black text-green-400 mt-1">{userBal.annual ?? 21} <span className="text-xs">يوم</span></span>
                                <span className="text-[9px] text-green-300/60 mt-0.5">محدث لحظياً</span>
                            </div>
                            <div className="bg-black/30 p-3.5 rounded-2xl border border-yellow-500/20 flex flex-col items-center justify-center text-center">
                                <span className="text-[11px] font-black text-yellow-400 uppercase">متبقي العارضة</span>
                                <span className="text-2xl font-black text-yellow-400 mt-1">{userBal.casual ?? 7} <span className="text-xs">يوم</span></span>
                                <span className="text-[9px] text-yellow-300/60 mt-0.5">محدث لحظياً</span>
                            </div>
                            <div className="bg-black/30 p-3.5 rounded-2xl border border-orange-500/20 flex flex-col items-center justify-center text-center">
                                <span className="text-[11px] font-black text-orange-400 uppercase">تخصم من الراتب (غياب بأذن)</span>
                                <span className="text-2xl font-black text-orange-400 mt-1">{currentYearUnpaid} <span className="text-xs">يوم</span></span>
                                <span className="text-[9px] text-orange-300/80 mt-0.5 font-bold">من بداية العام (1/1 إلى 31/12)</span>
                            </div>
                            <div className="bg-black/30 p-3.5 rounded-2xl border border-red-500/20 flex flex-col items-center justify-center text-center">
                                <span className="text-[11px] font-black text-red-400 uppercase">مرضي</span>
                                <span className="text-2xl font-black text-red-400 mt-1">{currentYearSick} <span className="text-xs">يوم</span></span>
                                <span className="text-[9px] text-red-300/80 mt-0.5 font-bold">من بداية العام (1/1 إلى 31/12)</span>
                            </div>
                        </div>
                    );
                })()}
            </div>

            {viewArchived && (
                <div className="bg-orange-500/10 border border-orange-500/30 p-4 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-orange-200 shadow-lg">
                    <div className="flex items-center gap-2">
                        <Archive size={20} className="text-orange-400 shrink-0" />
                        <div>
                            <span className="font-bold text-sm block">أرشيف حسابات الموظفين ({archivedUsersList.length})</span>
                            <span className="text-[11px] opacity-70 block">الحسابات المؤرشفة مخفية من جميع القوائم المنسدلة والتقارير النشطة.</span>
                        </div>
                    </div>
                    {archivedUsersList.length > 0 && (
                        <div className="flex items-center gap-2">
                            <select
                                id="archive-restore-select"
                                className="bg-gray-800 text-white text-xs font-bold px-3 py-2 rounded-xl border border-white/10 outline-none flex-1 sm:w-48"
                                defaultValue=""
                            >
                                <option value="">-- اختر موظف لاستعادته --</option>
                                {archivedUsersList.map(u => (
                                    <option key={u.key} value={u.key}>{u.name}</option>
                                ))}
                            </select>
                            <button
                                onClick={() => {
                                    const sel = document.getElementById('archive-restore-select') as HTMLSelectElement;
                                    if (sel && sel.value) {
                                        handleArchiveUser(sel.value, false);
                                    } else {
                                        alert("يرجى اختيار موظف أولاً من القائمة");
                                    }
                                }}
                                className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-2 rounded-xl font-bold text-xs flex items-center gap-1 transition shadow-md active:scale-95 shrink-0 cursor-pointer"
                            >
                                <RotateCcw size={14} />
                                <span>إلغاء الأرشفة</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 items-start">
                {displayedUsers.map(u => {
                    const balance = balances[u.key!] || {
                        userId: u.key!,
                        employeeName: u.name,
                        annual: 21,
                        casual: 7,
                        sick: 0,
                        exams: 0,
                        unpaid: 0
                    };

                    const curYear = new Date().getFullYear();
                    const yStart = new Date(curYear, 0, 1, 0, 0, 0, 0);
                    const yEnd = new Date(curYear, 11, 31, 23, 59, 59, 999);

                    const userYearHistory = allHistory.filter(h => {
                        if (h.userId !== u.key) return false;
                        const hDate = new Date(h.date);
                        return hDate >= yStart && hDate <= yEnd;
                    });

                    const yearlyUnpaid = userYearHistory
                        .filter(h => h.type === 'unpaid')
                        .reduce((sum, h) => sum + (Number(h.days) || 0), 0);

                    const yearlySick = userYearHistory
                        .filter(h => h.type === 'sick')
                        .reduce((sum, h) => sum + (Number(h.days) || 0), 0);

                    const pStart = new Date(periodDate);
                    pStart.setHours(0,0,0,0);
                    const pEnd = getPeriodEnd(periodDate);
                    pEnd.setHours(23,59,59,999);

                    const userMonthHistory = allHistory.filter(h => {
                        if (h.userId !== u.key) return false;
                        const hDate = new Date(h.date);
                        return hDate >= pStart && hDate <= pEnd;
                    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                    const monthlyAnnual = userMonthHistory.filter(h => h.type === 'annual').reduce((s, h) => s + (Number(h.days) || 0), 0);
                    const monthlyCasual = userMonthHistory.filter(h => h.type === 'casual').reduce((s, h) => s + (Number(h.days) || 0), 0);
                    const monthlyOfficial = userMonthHistory.filter(h => h.type === 'official').reduce((s, h) => s + (Number(h.days) || 0), 0);
                    const monthlySick = userMonthHistory.filter(h => h.type === 'sick').reduce((s, h) => s + (Number(h.days) || 0), 0);
                    const monthlyExams = userMonthHistory.filter(h => h.type === 'exams').reduce((s, h) => s + (Number(h.days) || 0), 0);
                    const monthlyUnpaid = userMonthHistory.filter(h => h.type === 'unpaid').reduce((s, h) => s + (Number(h.days) || 0), 0);
                    const monthlyPenalty = userMonthHistory.filter(h => h.type === 'penalty').reduce((s, h) => s + (Number(h.days) || 0), 0);
                    const monthlySummer = userMonthHistory.filter(h => h.type === 'summer').reduce((s, h) => s + (Number(h.days) || 0), 0);
                    const monthlyCustom = userMonthHistory.filter(h => h.type === 'custom').reduce((s, h) => s + (Number(h.days) || 0), 0);

                    // إجمالي إجازات الشهر (سنوي + عارضة + مصيف + امتحانات + غياب بأذن / تخصم من الراتب + مرضي + جزاء + مخصص) مع استبعاد الإجازات الرسمية
                    const totalMonthDays = userMonthHistory
                        .filter(h => h.type !== 'official')
                        .reduce((s, h) => s + (Number(h.days) || 0), 0);

                    return (
                        <div key={u.key} className="p-5 rounded-3xl border border-white/10 bg-gray-800 text-white shadow-xl relative overflow-hidden flex flex-col transition-all duration-200">
                            <div className="flex justify-between items-start mb-4 pb-3 border-b border-white/10">
                                <div>
                                    <div className="font-black text-xl text-blue-400 flex items-center gap-2">
                                        <span>{u.name}</span>
                                        <span className="text-[10px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded-full border border-blue-500/30">{u.role === 'admin' ? 'مدير' : 'موظف'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-[11px] opacity-40 font-mono">@{u.username}</span>
                                        <span className="text-[10px] text-blue-300/80 font-bold bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">من 1/1 إلى 31/12</span>
                                    </div>
                                </div>
                                <div className="flex gap-1.5 items-center">
                                    {user.role === 'admin' && (
                                        <>
                                            {!viewArchived ? (
                                                <>
                                                    <button 
                                                        onClick={() => setShowEditBalanceModal(balance)} 
                                                        className="p-2 bg-white/5 hover:bg-blue-600/20 text-blue-400 rounded-xl transition border border-white/5"
                                                        title="تعديل الرصيد"
                                                    >
                                                        <Edit size={14}/>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteEmployeeData(u.key!, u.name)} 
                                                        className="p-2 bg-white/5 hover:bg-red-600/20 text-red-400 rounded-xl transition border border-white/5"
                                                        title="حذف البيانات"
                                                    >
                                                        <Trash2 size={14}/>
                                                    </button>
                                                    <button 
                                                        onClick={() => handleArchiveUser(u.key!, true)}
                                                        className="p-2 bg-white/5 hover:bg-orange-600/20 text-orange-400 rounded-xl transition border border-white/5"
                                                        title="أرشفة الحساب"
                                                    >
                                                        <Archive size={14}/>
                                                    </button>
                                                </>
                                            ) : (
                                                <button 
                                                    onClick={() => handleArchiveUser(u.key!, false)}
                                                    className="px-2.5 py-1.5 bg-teal-600/20 hover:bg-teal-600 text-teal-300 hover:text-white rounded-xl transition border border-teal-500/30 flex items-center gap-1 text-xs font-bold"
                                                    title="إلغاء الأرشفة واستعادة الموظف"
                                                >
                                                    <RotateCcw size={13}/>
                                                    <span>إلغاء الأرشفة</span>
                                                </button>
                                            )}
                                        </>
                                    )}
                                    <button 
                                        onClick={() => { setHistoryUserView({userId: u.key!, name: u.name}); setShowHistoryDetailsModal(true); }} 
                                        className="text-xs font-bold bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white px-3 py-2 rounded-xl transition border border-blue-500/30 flex items-center gap-1"
                                    >
                                        <History size={13} /> السجل الكلي
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                                <div className="bg-black/25 p-3.5 rounded-2xl border border-white/5 flex flex-col">
                                    <div>
                                        <div className="text-xs font-black text-blue-300 mb-2.5 pb-1.5 border-b border-white/10 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <CalendarIcon size={13} className="text-blue-400"/>
                                                <span>قائمة أرصدة الإجازات</span>
                                            </span>
                                            <span className="text-[10px] text-green-400 font-bold">محدثة لحظياً</span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="p-2.5 bg-green-500/10 rounded-xl border border-green-500/20 flex flex-col items-center justify-center text-center">
                                                <span className="text-[10px] opacity-90 font-black uppercase text-green-300">متبقي السنوي</span>
                                                <span className="text-lg font-black text-green-400 mt-0.5">{balance.annual ?? 21} <span className="text-[9px]">يوم</span></span>
                                            </div>

                                            <div className="p-2.5 bg-yellow-500/10 rounded-xl border border-yellow-500/20 flex flex-col items-center justify-center text-center">
                                                <span className="text-[10px] opacity-90 font-black uppercase text-yellow-300">متبقي العارضة</span>
                                                <span className="text-lg font-black text-yellow-400 mt-0.5">{balance.casual ?? 7} <span className="text-[9px]">يوم</span></span>
                                            </div>

                                            <div className="p-2.5 bg-orange-500/10 rounded-xl border border-orange-500/20 flex flex-col items-center justify-center text-center">
                                                <span className="text-[10px] opacity-90 font-black uppercase text-orange-300">تخصم من الراتب</span>
                                                <span className="text-lg font-black text-orange-400 mt-0.5">{monthlyUnpaid} <span className="text-[9px]">يوم</span></span>
                                            </div>

                                            <div className="p-2.5 bg-red-500/10 rounded-xl border border-red-500/20 flex flex-col items-center justify-center text-center">
                                                <span className="text-[10px] opacity-90 font-black uppercase text-red-300">مرضي</span>
                                                <span className="text-lg font-black text-red-400 mt-0.5">{monthlySick} <span className="text-[9px]">يوم</span></span>
                                            </div>

                                            <div className="p-2.5 bg-purple-500/10 rounded-xl border border-purple-500/20 flex flex-col items-center justify-center text-center">
                                                <span className="text-[10px] opacity-75 font-black uppercase text-purple-300">امتحانات</span>
                                                <span className="text-lg font-black text-purple-400">{balance.exams ?? 0} <span className="text-[9px]">يوم</span></span>
                                            </div>

                                            <div className="p-2.5 bg-rose-500/10 rounded-xl border border-rose-500/20 flex flex-col items-center justify-center text-center">
                                                <span className="text-[10px] opacity-75 font-black uppercase text-rose-300">جزاء</span>
                                                <span className="text-lg font-black text-rose-400">{(balance as any).penalty ?? 0} <span className="text-[9px]">يوم</span></span>
                                            </div>

                                            {(() => {
                                                const userSummerLeaves = allHistory
                                                    .filter(h => h.userId === u.key && h.type === 'summer')
                                                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                                                const totalSummerDays = userSummerLeaves.reduce((s, h) => s + (Number(h.days) || 0), 0) || Number((balance as any).summer || 0);

                                                let summerTooltip = "";
                                                if (userSummerLeaves.length > 0) {
                                                    const ranges = userSummerLeaves.map(rec => {
                                                        const startD = new Date(rec.date);
                                                        const numDays = Math.ceil(Number(rec.days) || 1);
                                                        const endD = new Date(startD);
                                                        if (numDays > 1) {
                                                            endD.setDate(endD.getDate() + numDays - 1);
                                                        }
                                                        const sStr = rec.date;
                                                        if (numDays > 1) {
                                                            const y = endD.getFullYear();
                                                            const m = String(endD.getMonth() + 1).padStart(2, '0');
                                                            const d = String(endD.getDate()).padStart(2, '0');
                                                            const eStr = `${y}-${m}-${d}`;
                                                            return `${numDays} يوم (من ${sStr} إلى ${eStr})`;
                                                        }
                                                        return `${numDays} يوم (بتاريخ ${sStr})`;
                                                    });
                                                    summerTooltip = ranges.join('\n');
                                                } else if (totalSummerDays > 0) {
                                                    summerTooltip = "رصيد مرحل أو مسجل بدون تواريخ تفصيلية";
                                                } else {
                                                    summerTooltip = "لا توجد إجازات مصيف مسجلة";
                                                }

                                                return (
                                                    <div 
                                                        className="col-span-2 p-2.5 bg-teal-500/10 rounded-xl border border-teal-500/20 flex flex-col justify-between gap-1 cursor-help"
                                                        title={summerTooltip}
                                                    >
                                                        <div className="flex items-center justify-between px-1">
                                                            <span className="text-[10px] opacity-90 font-black uppercase text-teal-300">إجازة مصيف</span>
                                                            <span className="text-base font-black text-teal-400">{totalSummerDays} <span className="text-[9px]">يوم</span></span>
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>

                                    {balance.weeklyDays && balance.weeklyDays.length > 0 && (
                                        <div className="p-2 bg-purple-900/20 rounded-xl border border-purple-500/20 text-center mt-2.5">
                                            <span className="text-[10px] text-purple-300 font-bold">إجازة أسبوعية: {balance.weeklyDays.join('، ')}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="bg-black/35 p-3.5 rounded-2xl border border-white/5 flex flex-col">
                                    <div>
                                        <div className="text-xs font-black text-amber-300 mb-2.5 pb-1.5 border-b border-white/10 flex items-center justify-between">
                                            <span className="flex items-center gap-1.5">
                                                <CalendarIcon size={13} className="text-amber-400"/>
                                                <span>سجل إجازات شهر {periodDate.toLocaleDateString('ar-EG', { month: 'long' })}</span>
                                            </span>
                                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-bold">
                                                إجمالي: {totalMonthDays} يوم
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-1.5 mb-2.5">
                                            <div className="bg-green-500/15 border border-green-500/30 rounded-xl p-2 text-center">
                                                <div className="text-[9px] font-bold text-green-300">أخذ سنوي</div>
                                                <div className="text-base font-black text-green-400 mt-0.5">{monthlyAnnual} <span className="text-[9px]">يوم</span></div>
                                            </div>
                                            <div className="bg-yellow-500/15 border border-yellow-500/30 rounded-xl p-2 text-center">
                                                <div className="text-[9px] font-bold text-yellow-300">أخذ عارضة</div>
                                                <div className="text-base font-black text-yellow-400 mt-0.5">{monthlyCasual} <span className="text-[9px]">يوم</span></div>
                                            </div>
                                            <div className="bg-blue-500/15 border border-blue-500/30 rounded-xl p-2 text-center">
                                                <div className="text-[9px] font-bold text-blue-300">إضافي</div>
                                                <div className="text-base font-black text-blue-400 mt-0.5">{monthlyOfficial} <span className="text-[9px]">يوم</span></div>
                                            </div>
                                        </div>

                                        {(monthlySick > 0 || monthlyExams > 0 || monthlyUnpaid > 0 || monthlyPenalty > 0 || monthlySummer > 0 || monthlyCustom > 0) && (
                                            <div className="flex flex-wrap gap-1 mb-2">
                                                {monthlySick > 0 && <span className="text-[9px] bg-red-500/20 text-red-300 border border-red-500/30 px-2 py-0.5 rounded-md font-bold">مرضي: {monthlySick} يوم</span>}
                                                {monthlyExams > 0 && <span className="text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-md font-bold">امتحانات: {monthlyExams} يوم</span>}
                                                {monthlyUnpaid > 0 && <span className="text-[9px] bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-md font-bold">غياب بإذن: {monthlyUnpaid} يوم</span>}
                                                {monthlyPenalty > 0 && <span className="text-[9px] bg-rose-500/20 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded-md font-bold">جزاء: {monthlyPenalty} يوم</span>}
                                                {monthlySummer > 0 && <span className="text-[9px] bg-teal-500/20 text-teal-300 border border-teal-500/30 px-2 py-0.5 rounded-md font-bold">مصيف: {monthlySummer} يوم</span>}
                                                {monthlyCustom > 0 && <span className="text-[9px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-md font-bold">مخصص: {monthlyCustom} يوم</span>}
                                            </div>
                                        )}
                                    </div>

                                    {/* قائمة الإجازات تظهر كاملة بدون شريط تمرير أو تقييد ليتوسع حجم المربع تلقائياً */}
                                    <div className="space-y-1.5 mt-1">
                                        {userMonthHistory.length === 0 ? (
                                            <div className="text-center py-4 text-[11px] text-white/40 italic bg-white/5 rounded-xl border border-white/5">
                                                لا توجد إجازات مسجلة لدورة هذا الشهر
                                            </div>
                                        ) : (
                                            userMonthHistory.map(rec => (
                                                <div key={rec.id} className="bg-white/5 hover:bg-white/10 rounded-xl p-2 flex items-center justify-between border border-white/5 transition text-xs">
                                                    <div className="flex items-center gap-2">
                                                        <span className={`w-2 h-2 rounded-full ${
                                                            rec.type === 'annual' ? 'bg-green-400' :
                                                            rec.type === 'casual' ? 'bg-yellow-400' :
                                                            rec.type === 'official' ? 'bg-blue-400' :
                                                            rec.type === 'sick' ? 'bg-red-400' :
                                                            rec.type === 'exams' ? 'bg-purple-400' :
                                                            rec.type === 'unpaid' ? 'bg-orange-400' :
                                                            rec.type === 'penalty' ? 'bg-rose-500' :
                                                            rec.type === 'summer' ? 'bg-teal-400' : 'bg-cyan-400'
                                                        }`}></span>
                                                        <div>
                                                            <div className="font-bold text-[11px] text-white">
                                                                {formatLeaveTitle(rec)}
                                                            </div>
                                                            <div className="text-[9px] text-gray-400 font-mono">{rec.date}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-xs text-white bg-white/10 px-2 py-0.5 rounded-lg">{rec.days} يوم</span>
                                                        {user.role === 'admin' && (
                                                            <div className="flex items-center gap-1">
                                                                <button 
                                                                    onClick={() => handleStartEditRecord(rec)}
                                                                    className="text-blue-400 hover:text-blue-300 p-1 hover:bg-blue-500/10 rounded-lg transition"
                                                                    title="تعديل الإجازة"
                                                                >
                                                                    <Edit size={12}/>
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDeleteRecord(rec.id, rec)}
                                                                    className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded-lg transition"
                                                                    title="حذف"
                                                                >
                                                                    <Trash2 size={12}/>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                            </div>
                        </div>
                    );
                })}
            </div>

            {/* مودال التاريخ والسجل الكلي */}
            {showHistoryDetailsModal && historyUserView && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="w-full max-w-2xl p-6 rounded-3xl border border-white/10 bg-gray-900 text-white flex flex-col max-h-[90vh] shadow-2xl animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-2">
                                <UserIcon className="text-blue-500" size={20}/>
                                <div>
                                    <h3 className="text-xl font-bold text-white">{historyUserView.name}</h3>
                                    <div className="text-xs text-gray-400">السجل الكامل للإجازات والغياب</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleExportFullLeavePDF}
                                    disabled={isExportingFullLeavePDF}
                                    className="px-3.5 py-2 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 font-bold text-xs flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50 cursor-pointer shadow-md"
                                    title="تصدير السجل الكامل كملف PDF"
                                >
                                    {isExportingFullLeavePDF ? (
                                        <Loader2 size={15} className="animate-spin text-red-300" />
                                    ) : (
                                        <FileDown size={15} className="text-red-400" />
                                    )}
                                    <span>{isExportingFullLeavePDF ? 'جاري التصدير...' : 'تصدير PDF'}</span>
                                </button>
                                <button onClick={() => setShowHistoryDetailsModal(false)} className="p-2 hover:bg-white/10 rounded-full text-white"><X/></button>
                            </div>
                        </div>

                        {(() => {
                            const userAllRecords = allHistory
                                .filter(r => r.userId === historyUserView.userId)
                                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                            // إحصائيات السجلات للموظف في صف واحد أسفل الاسم (بدون مسطرة تمرير)
                            let annualCount = 0;
                            let casualCount = 0;
                            let unpaidCount = 0;
                            let officialCount = 0;
                            let penaltyCount = 0;

                            userAllRecords.forEach(r => {
                                const days = Number(r.days) || 1;
                                if (r.type === 'annual' || (r.deductedFromAnnual && r.deductedFromAnnual > 0)) {
                                    annualCount += r.deductedFromAnnual || days;
                                } else if (r.type === 'casual' || (r.deductedFromCasual && r.deductedFromCasual > 0)) {
                                    casualCount += r.deductedFromCasual || days;
                                } else if (r.type === 'unpaid' || (r.deductedFromUnpaid && r.deductedFromUnpaid > 0) || r.title?.includes('إذن') || r.title?.includes('أذن') || r.title?.includes('اذن')) {
                                    unpaidCount += r.deductedFromUnpaid || days;
                                } else if (r.type === 'official') {
                                    officialCount += days;
                                } else if (r.type === 'penalty') {
                                    penaltyCount += days;
                                }
                            });

                            // مجموع الأيام الكلية: يظهر بها أيام السنوي والعارضة والامتحانات والمرضي (ولا يتم احتساب الإجازات الرسمية أو الجزاءات)
                            const totalAllDays = userAllRecords
                                .filter(r => 
                                    r.type === 'annual' || 
                                    (r.deductedFromAnnual && r.deductedFromAnnual > 0) ||
                                    r.type === 'casual' || 
                                    (r.deductedFromCasual && r.deductedFromCasual > 0) ||
                                    r.type === 'exams' || 
                                    r.type === 'sick'
                                )
                                .reduce((s, r) => {
                                    let d = Number(r.days) || 1;
                                    if (r.deductedFromAnnual) d = r.deductedFromAnnual;
                                    else if (r.deductedFromCasual) d = r.deductedFromCasual;
                                    return s + d;
                                }, 0);

                            // تصفية السجلات حسب القائمة المنسدلة المختارة لحظياً
                            const filteredRecords = userAllRecords.filter(r => {
                                if (historyFilterType === 'all') return true;
                                if (historyFilterType === 'annual') return r.type === 'annual' || (r.deductedFromAnnual && r.deductedFromAnnual > 0);
                                if (historyFilterType === 'casual') return r.type === 'casual' || (r.deductedFromCasual && r.deductedFromCasual > 0);
                                if (historyFilterType === 'sick') return r.type === 'sick';
                                if (historyFilterType === 'summer') return r.type === 'summer';
                                if (historyFilterType === 'unpaid') return r.type === 'unpaid' || (r.deductedFromUnpaid && r.deductedFromUnpaid > 0) || r.title?.includes('إذن') || r.title?.includes('أذن') || r.title?.includes('اذن');
                                if (historyFilterType === 'penalty') return r.type === 'penalty';
                                return true;
                            });

                            const selectedFilteredDays = filteredRecords.reduce((s, r) => {
                                let d = Number(r.days) || 1;
                                if (historyFilterType === 'annual' && r.deductedFromAnnual) d = r.deductedFromAnnual;
                                else if (historyFilterType === 'casual' && r.deductedFromCasual) d = r.deductedFromCasual;
                                else if (historyFilterType === 'unpaid' && r.deductedFromUnpaid) d = r.deductedFromUnpaid;
                                return s + d;
                            }, 0);

                            return (
                                <div className="flex flex-col flex-1 overflow-hidden space-y-3">
                                    {/* شريط الإحصائيات في صف واحد في سطر واحد بدون مسطرة تحريك */}
                                    <div className="grid grid-cols-5 gap-1 text-center bg-black/40 p-2 rounded-2xl border border-white/5 w-full">
                                        <div className="bg-emerald-950/40 border border-emerald-500/20 py-1 px-0.5 rounded-xl">
                                            <div className="text-[10px] text-emerald-300 font-bold leading-tight">سنوي</div>
                                            <div className="text-xs sm:text-sm font-black text-white">{annualCount}</div>
                                        </div>
                                        <div className="bg-amber-950/40 border border-amber-500/20 py-1 px-0.5 rounded-xl">
                                            <div className="text-[10px] text-amber-300 font-bold leading-tight">عارض</div>
                                            <div className="text-xs sm:text-sm font-black text-white">{casualCount}</div>
                                        </div>
                                        <div className="bg-orange-950/40 border border-orange-500/20 py-1 px-0.5 rounded-xl">
                                            <div className="text-[10px] text-orange-300 font-bold leading-tight truncate">غياب بإذن</div>
                                            <div className="text-xs sm:text-sm font-black text-white">{unpaidCount}</div>
                                        </div>
                                        <div className="bg-blue-950/40 border border-blue-500/20 py-1 px-0.5 rounded-xl">
                                            <div className="text-[10px] text-blue-300 font-bold leading-tight truncate">إجازات رسمية</div>
                                            <div className="text-xs sm:text-sm font-black text-white">{officialCount}</div>
                                        </div>
                                        <div className="bg-red-950/40 border border-red-500/20 py-1 px-0.5 rounded-xl">
                                            <div className="text-[10px] text-red-300 font-bold leading-tight">جزاءات</div>
                                            <div className="text-xs sm:text-sm font-black text-white">{penaltyCount}</div>
                                        </div>
                                    </div>

                                    {/* شريط القائمة المنسدلة ومجموع الأيام الكلية */}
                                    <div className="bg-black/30 p-2 sm:p-2.5 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex-1 min-w-[160px] max-w-[220px] sm:max-w-xs">
                                            <select 
                                                value={historyFilterType}
                                                onChange={(e) => setHistoryFilterType(e.target.value)}
                                                className="w-full bg-gray-800 text-white text-[11px] sm:text-xs font-bold py-1.5 px-2 rounded-xl border border-white/10 outline-none cursor-pointer"
                                            >
                                                <option value="all">إظهار الكل</option>
                                                <option value="annual">إجازات السنوي</option>
                                                <option value="casual">إجازات العارضة</option>
                                                <option value="sick">إجازات مرضي</option>
                                                <option value="summer">إجازات المصيف</option>
                                                <option value="unpaid">غياب بإذن</option>
                                                <option value="penalty">الجزاءات</option>
                                            </select>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {historyFilterType !== 'all' && (
                                                <div className="text-[10px] sm:text-xs font-bold text-cyan-400 whitespace-nowrap shrink-0">
                                                    الأيام المختارة: <span className="font-black text-xs sm:text-sm text-white bg-cyan-500/20 px-2 py-0.5 rounded-lg border border-cyan-500/30">{selectedFilteredDays} يوم</span>
                                                </div>
                                            )}
                                            <div className="text-[10px] sm:text-xs font-bold text-amber-400 whitespace-nowrap shrink-0">
                                                مجموع الأيام الكلية: <span className="font-black text-xs sm:text-sm text-white bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30">{totalAllDays} يوم</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* قائمة السجلات المصفاة */}
                                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                        {filteredRecords.length === 0 ? (
                                            <div className="text-center py-16 opacity-40 italic text-xs sm:text-sm">لا توجد سجلات مسجلة مطابقة لهذا الاختيار</div>
                                        ) : (
                                            filteredRecords.map(rec => (
                                                <div key={rec.id} className="p-3 sm:p-3.5 rounded-2xl border bg-black/20 border-white/5 flex justify-between items-center group hover:border-white/20 transition">
                                                    <div className="flex items-center gap-2.5 sm:gap-3">
                                                        <div className={`p-2 rounded-xl bg-white/5 ${typeColors[rec.type] || 'text-white'}`}><CheckCircle2 size={18} /></div>
                                                        <div>
                                                            <div className="font-bold text-xs sm:text-sm text-white flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                                                <span>{formatLeaveTitle(rec)}</span>
                                                                {rec.deductedFromAnnual ? (
                                                                    <span className="text-[9px] bg-green-500/20 text-green-300 px-1.5 py-0.5 rounded font-bold">خصم سنوي</span>
                                                                ) : null}
                                                                {rec.deductedFromCasual ? (
                                                                    <span className="text-[9px] bg-yellow-500/20 text-yellow-300 px-1.5 py-0.5 rounded font-bold">خصم عارضة</span>
                                                                ) : null}
                                                                {rec.deductedFromUnpaid || rec.type === 'unpaid' || formatLeaveTitle(rec).includes('إذن') || formatLeaveTitle(rec).includes('أذن') || formatLeaveTitle(rec).includes('اذن') ? (
                                                                    <span className="text-[9px] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded font-bold">تخصم من الراتب</span>
                                                                ) : null}
                                                            </div>
                                                            <div className="text-[10px] opacity-50 text-white font-mono mt-0.5">{rec.date}</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                                        <div className="font-black text-xs sm:text-base text-white bg-white/10 px-2.5 py-1 rounded-xl">{rec.days} يوم</div>
                                                        {user.role === 'admin' && (
                                                            <div className="flex items-center gap-1">
                                                                <button 
                                                                    onClick={() => handleStartEditRecord(rec)} 
                                                                    className="p-1.5 sm:p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition" 
                                                                    title="تعديل السجل"
                                                                >
                                                                    <Edit size={14}/>
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleDeleteRecord(rec.id, rec)} 
                                                                    className="p-1.5 sm:p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition" 
                                                                    title="حذف السجل"
                                                                >
                                                                    <Trash2 size={14}/>
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* مودال تصدير إكسيل */}
            {showExportModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="bg-gray-900 border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><FileSpreadsheet className="text-green-500"/> تصدير التقارير</h3>
                            <button onClick={() => setShowExportModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold mb-2 opacity-60 text-white uppercase tracking-widest">اختر الموظف</label>
                                <select 
                                    className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold outline-none"
                                    value={selectedEmployeeForExport}
                                    onChange={(e) => setSelectedEmployeeForExport(e.target.value)}
                                >
                                    <option value="all">طباعة الكل (تقرير شامل)</option>
                                    {activeUsersList.map(u => (
                                        <option key={u.key} value={u.key}>{u.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold mb-2 opacity-60 text-white">من</label>
                                    <input 
                                        type="date"
                                        className="w-full p-3 rounded-xl bg-gray-700 text-white border border-white/10 font-bold"
                                        value={exportStartDate}
                                        onChange={(e) => setExportStartDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold mb-2 opacity-60 text-white">إلى</label>
                                    <input 
                                        type="date"
                                        className="w-full p-3 rounded-xl bg-gray-700 text-white border border-white/10 font-bold"
                                        value={exportEndDate}
                                        onChange={(e) => setExportEndDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button 
                                onClick={handleExportExcel}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition shadow-xl active:scale-95 mt-4"
                            >
                                <Printer size={20}/> 
                                {selectedEmployeeForExport === 'all' ? 'تحميل التقرير الشامل' : 'طباعة إجازات الموظف المختار'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* مودال تعديل الرصيد (Admin Only) */}
            {showEditBalanceModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="bg-gray-900 border border-white/10 w-full max-w-md rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2"><Edit className="text-blue-500"/> تعديل رصيد: {showEditBalanceModal.employeeName}</h3>
                            <button onClick={() => setShowEditBalanceModal(null)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            {Object.entries(typeLabels).map(([key, label]) => (
                                <div key={key}>
                                    <label className="block text-[10px] font-bold opacity-40 mb-1">{label}</label>
                                    <input 
                                        type="number"
                                        className="w-full p-3 rounded-xl bg-gray-700 text-white border border-white/10 text-center font-black"
                                        value={(showEditBalanceModal as any)[key] || 0}
                                        onChange={(e) => setShowEditBalanceModal({...showEditBalanceModal, [key]: Number(e.target.value)})}
                                    />
                                </div>
                            ))}
                        </div>
                        <button 
                            onClick={handleUpdateBalance}
                            className="w-full mt-6 bg-blue-600 text-white py-4 rounded-2xl font-bold shadow-xl flex items-center justify-center gap-2 active:scale-95 transition"
                        >
                            <Save size={20}/> حفظ التعديلات
                        </button>
                    </div>
                </div>
            )}

            {/* مودال الإضافة (للآدمن فقط) */}
            {showAddLeaveModal && user.role === 'admin' && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="w-full max-w-md p-6 rounded-3xl border border-white/10 bg-gray-900 text-white shadow-2xl animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">تسجيل إجازة / غياب</h3>
                            <button onClick={() => setShowAddLeaveModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold mb-1 opacity-60 text-white">الموظف</label>
                                <select 
                                    className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold outline-none" 
                                    value={selectedUser} 
                                    onChange={e => setSelectedUser(e.target.value)}
                                >
                                    <option value="">-- اختر الموظف --</option>
                                    {activeUsersList.map(u => <option key={u.key} value={u.key}>{u.name}</option>)}
                                </select>

                                {/* بخط صغير المتبقي من السنوي و المتبقي من العارضة بجانب بعض */}
                                <div className="flex items-center justify-between gap-2 mt-2 px-1 text-[11px] font-bold">
                                    <div className="flex-1 flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl text-emerald-400">
                                        <span className="text-[10px] sm:text-[11px] text-gray-300">المتبقي من السنوي:</span>
                                        <span className="font-mono font-black text-white text-xs">
                                            {selectedUser 
                                                ? `${balances[selectedUser]?.annual != null ? Number(balances[selectedUser].annual) : 21} يوم` 
                                                : '—'}
                                        </span>
                                    </div>
                                    <div className="flex-1 flex items-center justify-between bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-xl text-amber-400">
                                        <span className="text-[10px] sm:text-[11px] text-gray-300">المتبقي من العارضة:</span>
                                        <span className="font-mono font-black text-white text-xs">
                                            {selectedUser 
                                                ? `${balances[selectedUser]?.casual != null ? Number(balances[selectedUser].casual) : 7} يوم` 
                                                : '—'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1 opacity-60 text-white">التاريخ</label>
                                <input type="date" className="w-full p-4 rounded-2xl bg-gray-700 text-white border border-white/10" value={leaveDate} onChange={e => setLeaveDate(e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {leaveType !== 'official' && (
                                    <div>
                                        <label className="block text-xs font-bold mb-1 opacity-60 text-white">عدد الأيام</label>
                                        <input 
                                            type="number" 
                                            min={leaveType === 'penalty' ? "0.25" : "0.5"} 
                                            step={leaveType === 'penalty' ? "0.25" : "0.5"} 
                                            className="w-full p-4 rounded-2xl bg-gray-700 text-white border border-white/10 text-center font-black" 
                                            value={leaveDays} 
                                            onChange={e => setLeaveDays(parseFloat(e.target.value) || 0)} 
                                            max={leaveType === 'penalty' ? 30 : undefined} 
                                        />
                                    </div>
                                )}
                                <div className={leaveType === 'official' ? 'col-span-2' : ''}>
                                    <label className="block text-xs font-bold mb-1 opacity-60 text-white">النوع</label>
                                    <div className="flex gap-2">
                                        <select 
                                            className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold outline-none" 
                                            value={leaveType} 
                                            onChange={e => {
                                                const val = e.target.value as any;
                                                setLeaveType(val);
                                                if (val === 'official' && leaveDays < 1) setLeaveDays(1);
                                                if (val !== 'penalty' && val !== 'official' && leaveDays < 0.5) setLeaveDays(0.5);
                                            }}
                                        >
                                            {Object.entries(typeLabels).map(([k,v]) => <option key={k} value={k as string}>{v as string}</option>)}
                                        </select>
                                        <button 
                                            type="button" 
                                            onClick={() => setLeaveType('custom')}
                                            className="bg-blue-600/30 text-blue-400 p-4 rounded-2xl hover:bg-blue-600/50 transition font-bold"
                                            title="نوع مخصص"
                                        >+</button>
                                    </div>
                                </div>
                            </div>

                            {leaveType === 'penalty' && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2">
                                    <span className="block text-xs font-bold text-rose-300">خيارات سريعة للجزاء:</span>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setLeaveDays(0.25)}
                                            className={`py-2 px-2 text-xs font-bold rounded-xl transition border text-center ${leaveDays === 0.25 ? 'bg-rose-600 text-white border-rose-500 shadow-md' : 'bg-gray-800 text-gray-200 border-white/10 hover:bg-gray-700'}`}
                                        >
                                            ربع
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLeaveDays(0.5)}
                                            className={`py-2 px-2 text-xs font-bold rounded-xl transition border text-center ${leaveDays === 0.5 ? 'bg-rose-600 text-white border-rose-500 shadow-md' : 'bg-gray-800 text-gray-200 border-white/10 hover:bg-gray-700'}`}
                                        >
                                            نصف
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setLeaveDays(1)}
                                            className={`py-2 px-2 text-xs font-bold rounded-xl transition border text-center ${leaveDays === 1 ? 'bg-rose-600 text-white border-rose-500 shadow-md' : 'bg-gray-800 text-gray-200 border-white/10 hover:bg-gray-700'}`}
                                        >
                                            يوم
                                        </button>
                                    </div>
                                </div>
                            )}
                            
                            {leaveType === 'custom' && (
                                <div>
                                    <label className="block text-xs font-bold mb-1 opacity-60 text-white">اسم الإجازة المخصصة (تخصم من السنوي)</label>
                                    <input type="text" className="w-full p-4 rounded-2xl bg-gray-700 text-white border border-white/10" value={customLeaveName} onChange={e => setCustomLeaveName(e.target.value)} placeholder="اكتب نوع الإجازة هنا..." />
                                </div>
                            )}

                            {leaveType === 'official' && (
                                <div>
                                    <label className="block text-xs font-bold mb-1 opacity-60 text-white">المناسبة</label>
                                    <input type="text" className="w-full p-4 rounded-2xl bg-gray-700 text-white border border-white/10" value={officialOccasion} onChange={e => setOfficialOccasion(e.target.value)} placeholder="مثال: عيد الفطر" />
                                </div>
                            )}
                            <button onClick={handleAddLeave} className="w-full bg-red-600 text-white font-bold py-4 rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2 mt-4">
                                <Save size={20}/> حفظ الإجازة
                            </button>
                        </div>
                    </div>
                </div>
            )}
        
            {showWeeklyModal && user.role === 'admin' && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="w-full max-w-md p-6 rounded-3xl border border-white/10 bg-gray-900 text-white shadow-2xl animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">تسجيل إجازات أسبوعية</h3>
                            <button onClick={() => setShowWeeklyModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold mb-1 opacity-60 text-white">الموظف</label>
                                <select 
                                    className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold outline-none" 
                                    value={weeklyUser} 
                                    onChange={e => setWeeklyUser(e.target.value)}
                                >
                                    <option value="">-- اختر الموظف --</option>
                                    {activeUsersList.filter(u => u.role !== 'admin').map(u => <option key={u.key} value={u.key}>{u.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-bold mb-1 opacity-60 text-white">اليوم</label>
                                <select 
                                    className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold outline-none" 
                                    value={weeklyDay} 
                                    onChange={e => setWeeklyDay(e.target.value)}
                                >
                                    <option value="">-- اختر اليوم --</option>
                                    {['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'].map(d => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </div>
                            <button onClick={handleSaveWeekly} className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2 mt-4">
                                <Save size={20}/> حفظ الإعداد
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* مودال تعديل إجازة محددة (للآدمن) */}
            {editingRecord && user.role === 'admin' && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="w-full max-w-md p-6 rounded-3xl border border-white/10 bg-gray-900 text-white shadow-2xl animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-2">
                                <Edit className="text-blue-400" size={20}/>
                                <div>
                                    <h3 className="text-xl font-bold text-white">تعديل الإجازة</h3>
                                    <div className="text-xs text-blue-300 font-bold">{editingRecord.employeeName}</div>
                                </div>
                            </div>
                            <button onClick={() => setEditingRecord(null)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold mb-1 opacity-60 text-white">التاريخ</label>
                                <input 
                                    type="date" 
                                    className="w-full p-4 rounded-2xl bg-gray-700 text-white border border-white/10 font-bold" 
                                    value={editDate} 
                                    onChange={e => setEditDate(e.target.value)} 
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                {editType !== 'official' && (
                                    <div>
                                        <label className="block text-xs font-bold mb-1 opacity-60 text-white">عدد الأيام</label>
                                        <input 
                                            type="number" 
                                            min={editType === 'penalty' ? "0.25" : "0.5"} 
                                            step={editType === 'penalty' ? "0.25" : "0.5"} 
                                            className="w-full p-4 rounded-2xl bg-gray-700 text-white border border-white/10 text-center font-black" 
                                            value={editDays} 
                                            onChange={e => setEditDays(parseFloat(e.target.value) || 0)} 
                                            max={editType === 'penalty' ? 30 : undefined} 
                                        />
                                    </div>
                                )}
                                <div className={editType === 'official' ? 'col-span-2' : ''}>
                                    <label className="block text-xs font-bold mb-1 opacity-60 text-white">نوع الإجازة</label>
                                    <select 
                                        className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold outline-none" 
                                        value={editType} 
                                        onChange={e => {
                                            const val = e.target.value as any;
                                            setEditType(val);
                                            if (val === 'official' && editDays < 1) setEditDays(1);
                                            if (val !== 'penalty' && val !== 'official' && editDays < 0.5) setEditDays(0.5);
                                        }}
                                    >
                                        {Object.entries(typeLabels).map(([k,v]) => <option key={k} value={k as string}>{v as string}</option>)}
                                    </select>
                                </div>
                            </div>

                            {editType === 'penalty' && (
                                <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2">
                                    <span className="block text-xs font-bold text-rose-300">خيارات سريعة للجزاء:</span>
                                    <div className="grid grid-cols-3 gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setEditDays(0.25)}
                                            className={`py-2 px-2 text-xs font-bold rounded-xl transition border text-center ${editDays === 0.25 ? 'bg-rose-600 text-white border-rose-500 shadow-md' : 'bg-gray-800 text-gray-200 border-white/10 hover:bg-gray-700'}`}
                                        >
                                            ربع
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditDays(0.5)}
                                            className={`py-2 px-2 text-xs font-bold rounded-xl transition border text-center ${editDays === 0.5 ? 'bg-rose-600 text-white border-rose-500 shadow-md' : 'bg-gray-800 text-gray-200 border-white/10 hover:bg-gray-700'}`}
                                        >
                                            نصف
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditDays(1)}
                                            className={`py-2 px-2 text-xs font-bold rounded-xl transition border text-center ${editDays === 1 ? 'bg-rose-600 text-white border-rose-500 shadow-md' : 'bg-gray-800 text-gray-200 border-white/10 hover:bg-gray-700'}`}
                                        >
                                            يوم
                                        </button>
                                    </div>
                                </div>
                            )}

                            {editType === 'custom' && (
                                <div>
                                    <label className="block text-xs font-bold mb-1 opacity-60 text-white">اسم الإجازة المخصصة</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-4 rounded-2xl bg-gray-700 text-white border border-white/10" 
                                        value={editLabel} 
                                        onChange={e => setEditLabel(e.target.value)} 
                                        placeholder="اكتب نوع الإجازة هنا..." 
                                    />
                                </div>
                            )}

                            {editType === 'official' && (
                                <div>
                                    <label className="block text-xs font-bold mb-1 opacity-60 text-white">المناسبة</label>
                                    <input 
                                        type="text" 
                                        className="w-full p-4 rounded-2xl bg-gray-700 text-white border border-white/10" 
                                        value={editLabel} 
                                        onChange={e => setEditLabel(e.target.value)} 
                                        placeholder="مثال: عيد الفطر" 
                                    />
                                </div>
                            )}

                            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-[11px] text-blue-300">
                                ℹ️ عند حفظ التعديل سيتم إعادة احتساب الخصم وتحديث رصيد الموظف لحظياً وبشكل تلقائي.
                            </div>

                            <button 
                                onClick={handleSaveEditRecord} 
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2 mt-4"
                            >
                                <Save size={20}/> حفظ التعديل وتحديث الرصيد
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showRouteModal && user.role === 'admin' && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="w-full max-w-2xl p-6 rounded-3xl border border-white/10 bg-gray-900 text-white shadow-2xl animate-in zoom-in-95 my-auto max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-white flex items-center gap-2">
                                <CalendarIcon className="text-indigo-500" /> خط السير
                            </h3>
                            <div className="flex items-center gap-2">
                                <button 
                                    type="button"
                                    onClick={() => {
                                        setShowScheduleModal(true);
                                        if (selectedRouteUser && selectedRouteUser !== 'all') {
                                            handleSelectScheduleUser(selectedRouteUser);
                                        }
                                    }}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs sm:text-sm font-bold py-2 px-3.5 rounded-xl transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer border border-indigo-400/30"
                                    title="فتح جدول سير الموظفين"
                                >
                                    <CalendarIcon size={16} />
                                    <span>جدول سير</span>
                                </button>
                                <button onClick={() => setShowRouteModal(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition">
                                    <X size={20} />
                                </button>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-xs font-bold opacity-60 text-white">اختر الاسم (اسم محدد أو الكل)</label>
                                    {selectedRouteUser && (
                                        <span className="text-[11px] font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-lg border border-indigo-500/20">
                                            {selectedRouteUser === 'all' ? 'المحدد: الكل' : `المحدد: ${selectedRouteUserName}`}
                                        </span>
                                    )}
                                </div>
                                <select 
                                    className="w-full p-4 rounded-2xl bg-[#808080] text-white border border-white/10 font-bold outline-none" 
                                    value={selectedRouteUser} 
                                    onChange={e => {
                                        const v = e.target.value;
                                        setSelectedRouteUser(v);
                                        if (v !== '' && v !== 'all') {
                                            const branches = allRoutes[v];
                                            setRouteBranches(branches && branches.length > 0 ? branches : ['', '', '', '', '']);
                                        }
                                    }}
                                >
                                    <option value="">-- اختر الاسم --</option>
                                    <option value="all">الكل (عرض وتصدير جميع الموظفين)</option>
                                    {activeUsersList
                                        .filter(u => u.name !== 'المدير العام' && u.name !== 'Mr. Khaled attef' && !(u.name && u.name.includes('@')))
                                        .map(u => <option key={u.key} value={u.key}>{u.name}</option>)
                                    }
                                </select>
                            </div>

                            {/* شريط أزرار التصدير والطباعة (إكسيل - PDF - طباعة) */}
                            <div className="bg-black/40 p-3 sm:p-3.5 rounded-2xl border border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div className="text-xs font-bold text-gray-300">
                                    {selectedRouteUser === 'all' 
                                        ? 'تصدير وطباعة خطوط السير (لجميع الموظفين):' 
                                        : selectedRouteUser 
                                        ? `تصدير وطباعة خط السير للموظف (${selectedRouteUserName}):` 
                                        : 'تصدير وطباعة خطوط السير (المحدد / الكل):'}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                    <button 
                                        onClick={() => handleExportRouteExcel()} 
                                        className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 px-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer"
                                        title="تصدير إكسيل"
                                    >
                                        <FileSpreadsheet size={15}/> 
                                        <span>تصدير إكسيل</span>
                                    </button>
                                    <button 
                                        onClick={() => handleExportRoutePDF()} 
                                        disabled={isExportingRoutePDF}
                                        className="flex-1 sm:flex-none bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-2.5 px-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                                        title="تصدير PDF"
                                    >
                                        {isExportingRoutePDF ? <Loader2 size={15} className="animate-spin"/> : <FileDown size={15}/>} 
                                        <span>تصدير PDF</span>
                                    </button>
                                    <button 
                                        onClick={() => handlePrintRoute()} 
                                        className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 px-3.5 rounded-xl transition flex items-center justify-center gap-2 shadow-md active:scale-95 cursor-pointer"
                                        title="طباعة مباشرة"
                                    >
                                        <Printer size={15}/> 
                                        <span>طباعة</span>
                                    </button>
                                </div>
                            </div>

                            {selectedRouteUser && selectedRouteUser !== 'all' && (
                                <div className="space-y-3 mt-4">
                                    <div className="flex justify-between items-center">
                                        <label className="block text-xs font-bold opacity-60 text-white">الفروع المسجلة للموظف ({selectedRouteUserName})</label>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => handleExportRouteExcel(selectedRouteUser)}
                                                className="text-xs bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white px-2.5 py-1 rounded-lg transition flex items-center gap-1 font-bold cursor-pointer"
                                                title="تصدير إكسيل لهذا الموظف"
                                            >
                                                <FileSpreadsheet size={13}/> إكسيل
                                            </button>
                                            <button 
                                                onClick={() => handleExportRoutePDF(selectedRouteUser)}
                                                disabled={isExportingRoutePDF}
                                                className="text-xs bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600 hover:text-white px-2.5 py-1 rounded-lg transition flex items-center gap-1 font-bold disabled:opacity-50 cursor-pointer"
                                                title="تصدير PDF لهذا الموظف"
                                            >
                                                <FileDown size={13}/> PDF
                                            </button>
                                            <button 
                                                onClick={() => handlePrintRoute(selectedRouteUser)}
                                                className="text-xs bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white px-2.5 py-1 rounded-lg transition flex items-center gap-1 font-bold cursor-pointer"
                                                title="طباعة خط سير هذا الموظف"
                                            >
                                                <Printer size={13}/> طباعة
                                            </button>
                                        </div>
                                    </div>
                                    {routeBranches.map((branch, idx) => (
                                        <input 
                                            key={idx}
                                            type="text" 
                                            placeholder={`اسم الفرع ${idx + 1}`}
                                            className="w-full p-4 rounded-2xl bg-gray-700 text-white border border-white/10 focus:border-indigo-500 outline-none" 
                                            value={branch} 
                                            onChange={e => {
                                                const newB = [...routeBranches];
                                                newB[idx] = e.target.value;
                                                setRouteBranches(newB);
                                            }} 
                                        />
                                    ))}
                                    <div className="flex gap-3 mt-4">
                                        <button 
                                            onClick={() => setRouteBranches([...routeBranches, ''])} 
                                            className="bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 font-bold py-3 px-4 rounded-2xl transition hover:bg-indigo-600 hover:text-white flex items-center justify-center gap-2 flex-1"
                                        >
                                            <CalendarPlus size={18}/> اضف فرع
                                        </button>
                                        <button 
                                            onClick={async () => {
                                                await set(ref(db, `routes/${selectedRouteUser}`), routeBranches);
                                                alert("تم الحفظ بنجاح");
                                            }} 
                                            className="bg-green-600 text-white font-bold py-3 px-4 rounded-2xl transition hover:bg-green-500 flex items-center justify-center gap-2 flex-1 shadow-lg"
                                        >
                                            <Save size={18}/> حفظ
                                        </button>
                                    </div>
                                </div>
                            )}

                            {selectedRouteUser === 'all' && (
                                <div className="mt-6">
                                    <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                                        <h4 className="font-bold text-white">خطوط السير المسجلة لجميع الموظفين</h4>
                                        <div className="flex items-center gap-2">
                                            <button 
                                                onClick={() => handleExportRouteExcel('all')}
                                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-3 rounded-xl transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                                                title="تصدير جميع خطوط السير إلى إكسيل"
                                            >
                                                <FileSpreadsheet size={14}/> تصدير إكسيل
                                            </button>
                                            <button 
                                                onClick={() => handleExportRoutePDF('all')}
                                                disabled={isExportingRoutePDF}
                                                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold py-2 px-3 rounded-xl transition flex items-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                                                title="تصدير جميع خطوط السير كملف PDF"
                                            >
                                                {isExportingRoutePDF ? <Loader2 size={14} className="animate-spin"/> : <FileDown size={14}/>} تصدير PDF
                                            </button>
                                            <button 
                                                onClick={() => handlePrintRoute('all')}
                                                className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 px-3 rounded-xl transition flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                                                title="طباعة جميع خطوط السير"
                                            >
                                                <Printer size={14}/> طباعة
                                            </button>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {activeUsersList
                                            .filter(u => u.name !== 'المدير العام' && u.name !== 'Mr. Khaled attef' && !(u.name && u.name.includes('@')))
                                            .filter(u => {
                                                const b = allRoutes[u.key!] || [];
                                                return b.filter(x => x.trim() !== '').length > 0;
                                            })
                                            .map(u => {
                                                const branches = allRoutes[u.key!] || [];
                                                const cleanBranches = branches.filter(b => b.trim() !== '');
                                                return (
                                                    <div key={u.key} className="bg-gray-800 border border-white/5 p-4 rounded-2xl shadow-sm">
                                                        <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2">
                                                            <div className="font-black text-indigo-400">{u.name}</div>
                                                            <div className="flex items-center gap-1.5">
                                                                <button 
                                                                    onClick={() => handleExportRouteExcel(u.key)}
                                                                    className="text-[11px] bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-600 hover:text-white px-2 py-0.5 rounded-lg transition flex items-center gap-1 font-bold cursor-pointer"
                                                                    title="تصدير إكسيل للموظف"
                                                                >
                                                                    <FileSpreadsheet size={12}/> إكسيل
                                                                </button>
                                                                <button 
                                                                    onClick={() => handleExportRoutePDF(u.key)}
                                                                    disabled={isExportingRoutePDF}
                                                                    className="text-[11px] bg-rose-600/20 text-rose-400 border border-rose-500/30 hover:bg-rose-600 hover:text-white px-2 py-0.5 rounded-lg transition flex items-center gap-1 font-bold disabled:opacity-50 cursor-pointer"
                                                                    title="تصدير PDF للموظف"
                                                                >
                                                                    <FileDown size={12}/> PDF
                                                                </button>
                                                                <button 
                                                                    onClick={() => handlePrintRoute(u.key)}
                                                                    className="text-[11px] bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white px-2 py-0.5 rounded-lg transition flex items-center gap-1 font-bold cursor-pointer"
                                                                    title="طباعة خط سير الموظف"
                                                                >
                                                                    <Printer size={12}/> طباعة
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <ul className="space-y-1 list-disc list-inside text-sm text-gray-300 pr-2">
                                                            {cleanBranches.map((b, i) => <li key={i}>{b}</li>)}
                                                        </ul>
                                                    </div>
                                                );
                                            })
                                        }
                                        {activeUsersList
                                            .filter(u => u.name !== 'المدير العام' && u.name !== 'Mr. Khaled attef' && !(u.name && u.name.includes('@')))
                                            .filter(u => {
                                                const b = allRoutes[u.key!] || [];
                                                return b.filter(x => x.trim() !== '').length === 0;
                                            }).length === activeUsersList.filter(u => u.name !== 'المدير العام' && u.name !== 'Mr. Khaled attef' && !(u.name && u.name.includes('@'))).length && (
                                                <div className="text-center py-8 text-gray-500 text-sm">لا توجد أي فروع مسجلة بعد</div>
                                            )
                                        }
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}

            {/* نافذة جدول سير الموظفين الأسبوعي */}
            {showScheduleModal && user.role === 'admin' && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] flex items-center justify-center p-2 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="w-full max-w-5xl p-4 sm:p-6 rounded-3xl border border-white/10 bg-gray-900 text-white shadow-2xl animate-in zoom-in-95 my-auto max-h-[92vh] overflow-y-auto">
                        {/* ترويسة النافذة */}
                        <div className="flex justify-between items-center mb-5 pb-4 border-b border-white/10">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2.5 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                                    <CalendarIcon size={22} />
                                </div>
                                <div>
                                    <h3 className="text-lg sm:text-xl font-black text-white">جدول سير الموظفين الأسبوعي</h3>
                                    <p className="text-[11px] text-gray-400">توزيع زيارات الفروع من السبت إلى الخميس (معدل 3 زيارات لكل فرع أسبوعياً)</p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setShowScheduleModal(false)} 
                                className="p-2 bg-white/5 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
                                title="إغلاق"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* اختيار الموظف أو الكل */}
                        <div className="mb-5 bg-gray-800/80 p-3.5 sm:p-4 rounded-2xl border border-white/10 space-y-3">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                <label className="text-xs sm:text-sm font-bold text-gray-200 flex items-center gap-2">
                                    <UserIcon size={16} className="text-indigo-400" />
                                    <span>اختيار الموظف:</span>
                                </label>
                                {selectedScheduleUser && selectedScheduleUser !== 'all' && (
                                    <span className="text-[11px] font-bold text-indigo-300 bg-indigo-500/15 px-3 py-1 rounded-xl border border-indigo-500/30">
                                        الموظف المختار: {activeUsersList.find(u => u.key === selectedScheduleUser)?.name || ''}
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                                <select
                                    className="flex-1 p-3.5 rounded-xl bg-gray-700 text-white border border-white/10 font-bold outline-none text-sm focus:border-indigo-500 transition cursor-pointer"
                                    value={selectedScheduleUser}
                                    onChange={e => handleSelectScheduleUser(e.target.value)}
                                >
                                    <option value="">-- اختر الموظف --</option>
                                    <option value="all">الكل (عرض وتصدير جدول جميع الموظفين)</option>
                                    {activeUsersList
                                        .filter(u => u.name !== 'المدير العام' && u.name !== 'Mr. Khaled attef' && !(u.name && u.name.includes('@')))
                                        .map(u => (
                                            <option key={u.key} value={u.key}>{u.name}</option>
                                        ))
                                    }
                                </select>

                                {/* زر التبديل السريع لعرض جميع الموظفين */}
                                <button
                                    type="button"
                                    onClick={() => handleSelectScheduleUser(selectedScheduleUser === 'all' ? '' : 'all')}
                                    className={`py-3 px-4 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                                        selectedScheduleUser === 'all'
                                            ? 'bg-indigo-600 text-white shadow-lg'
                                            : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10'
                                    }`}
                                >
                                    <CalendarIcon size={15} />
                                    <span>{selectedScheduleUser === 'all' ? 'الرجوع لاختيار موظف' : 'جدول جميع الموظفين'}</span>
                                </button>
                            </div>
                        </div>

                        {/* في حال اختيار موظف محدد */}
                        {selectedScheduleUser && selectedScheduleUser !== 'all' && (
                            <div className="space-y-5 animate-in fade-in duration-200">
                                {/* شريط الإجراءات: حفظ - تصدير إكسيل - تصدير PDF - طباعة - توزيع تلقائي */}
                                <div className="bg-gradient-to-r from-gray-800/90 to-gray-800/60 p-3 sm:p-4 rounded-2xl border border-white/10 flex flex-wrap items-center justify-between gap-2.5">
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={handleSaveSchedule}
                                            disabled={isSavingSchedule}
                                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold py-2.5 px-4 rounded-xl transition flex items-center gap-2 shadow-lg active:scale-95 disabled:opacity-50 cursor-pointer"
                                            title="حفظ جدول خط السير لهذا الموظف"
                                        >
                                            {isSavingSchedule ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                            <span>حفظ الجدول</span>
                                        </button>
                                        <button
                                            onClick={handleAutoDistributeSchedule}
                                            className="bg-indigo-600/30 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 text-xs sm:text-sm font-bold py-2.5 px-3.5 rounded-xl transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                            title="إعادة التوزيع التلقائي للفروع بمعدل 3 زيارات لكل فرع أسبوعياً"
                                        >
                                            <RotateCcw size={15} />
                                            <span className="hidden sm:inline">توزيع تلقائي (3 زيارات)</span>
                                            <span className="sm:hidden">توزيع تلقائي</span>
                                        </button>
                                    </div>

                                    {/* أزرار التصدير والطباعة للموظف المختار */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            onClick={() => handleExportSingleScheduleExcel(selectedScheduleUser)}
                                            className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/30 text-xs sm:text-sm font-bold py-2.5 px-3 rounded-xl transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                            title="تصدير جدول خط السير إكسيل"
                                        >
                                            <FileSpreadsheet size={15} />
                                            <span>تصدير Excel</span>
                                        </button>
                                        <button
                                            onClick={() => handleExportSingleSchedulePDF(selectedScheduleUser)}
                                            disabled={isExportingSchedulePDF}
                                            className="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 text-xs sm:text-sm font-bold py-2.5 px-3 rounded-xl transition flex items-center gap-1.5 active:scale-95 disabled:opacity-50 cursor-pointer"
                                            title="تصدير جدول خط السير PDF"
                                        >
                                            {isExportingSchedulePDF ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
                                            <span>تصدير PDF</span>
                                        </button>
                                        <button
                                            onClick={() => handlePrintSingleSchedule(selectedScheduleUser)}
                                            className="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 text-xs sm:text-sm font-bold py-2.5 px-3 rounded-xl transition flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                            title="طباعة مباشرة"
                                        >
                                            <Printer size={15} />
                                            <span>طباعة</span>
                                        </button>
                                    </div>
                                </div>

                                {/* جدول أيام الأسبوع: من السبت وحتى الخميس */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="font-bold text-sm text-gray-300">
                                            جدول أيام الأسبوع (السبت - الخميس):
                                        </h4>
                                        <span className="text-[11px] text-gray-400">
                                            الفروع المسجلة للموظف: {(allRoutes[selectedScheduleUser] || []).filter(b => b.trim() !== '').length} فرع
                                        </span>
                                    </div>

                                    {/* بطاقات / أعمدة الأيام الستة */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                                        {WEEK_DAYS.map((day) => {
                                            const dayBranches = currentSchedule[day] || [];
                                            const registeredBranches = (allRoutes[selectedScheduleUser] || []).filter(b => b && b.trim() !== '');

                                            return (
                                                <div 
                                                    key={day}
                                                    className="bg-gray-800/90 border border-white/10 rounded-2xl p-3 flex flex-col justify-between min-h-[180px] shadow-sm hover:border-indigo-500/40 transition"
                                                >
                                                    <div>
                                                        {/* اسم اليوم */}
                                                        <div className="text-center font-black text-sm text-indigo-300 pb-2 mb-2.5 border-b border-white/10 bg-white/5 rounded-xl py-1.5">
                                                            {day}
                                                        </div>

                                                        {/* تفاصيل الفروع لهذا اليوم */}
                                                        <div className="space-y-1.5 min-h-[70px]">
                                                            {dayBranches.length === 0 ? (
                                                                <div className="text-center text-[11px] text-gray-500 italic py-4">
                                                                    لا توجد فروع
                                                                </div>
                                                            ) : (
                                                                dayBranches.map((branch, idx) => (
                                                                    <div 
                                                                        key={idx}
                                                                        className="group bg-gray-700/80 hover:bg-gray-700 p-2 rounded-xl border border-white/5 flex items-center justify-between gap-1.5 transition"
                                                                    >
                                                                        {/* شرط أساسي: اسم الفرع فقط داخل الخانة بدون أي نص لوصف الزيارات */}
                                                                        <span className="font-bold text-xs text-gray-100 truncate" title={branch}>
                                                                            {branch}
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleRemoveBranchFromDay(day, idx)}
                                                                            className="text-gray-400 hover:text-red-400 p-1 rounded-lg hover:bg-red-500/10 transition shrink-0 cursor-pointer"
                                                                            title="حذف هذا الفرع من هذا اليوم"
                                                                        >
                                                                            <X size={13} />
                                                                        </button>
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* إضافة فرع لهذا اليوم */}
                                                    <div className="mt-2.5 pt-2 border-t border-white/10">
                                                        <select
                                                            className="w-full p-1.5 bg-gray-900 text-xs text-gray-300 rounded-lg border border-white/10 outline-none cursor-pointer hover:border-indigo-400/40 transition"
                                                            value=""
                                                            onChange={e => {
                                                                if (e.target.value) {
                                                                    handleAddBranchToDay(day, e.target.value);
                                                                }
                                                            }}
                                                        >
                                                            <option value="">+ إضافة فرع...</option>
                                                            {registeredBranches
                                                                .filter(b => !dayBranches.includes(b))
                                                                .map((b, i) => (
                                                                    <option key={i} value={b}>{b}</option>
                                                                ))
                                                            }
                                                        </select>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* مصفوفة التوزيع الأسبوعي السريع (تحديد أيام كل فرع بنقرة واحدة) */}
                                {(allRoutes[selectedScheduleUser] || []).filter(b => b && b.trim() !== '').length > 0 && (
                                    <div className="bg-gray-800/60 p-4 rounded-2xl border border-white/10 space-y-3">
                                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                                            <h4 className="font-bold text-xs sm:text-sm text-gray-300">
                                                مصفوفة أيام الزيارة لكل فرع (اضغط لتفعيل أو إلغاء اليوم):
                                            </h4>
                                            <span className="text-[11px] text-gray-400">
                                                المعدل المطلوب: 3 أيام في الأسبوع لكل فرع
                                            </span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs text-right border-collapse">
                                                <thead>
                                                    <tr className="bg-white/5 border-b border-white/10 text-gray-300">
                                                        <th className="p-2.5 font-bold">اسم الفرع</th>
                                                        {WEEK_DAYS.map(d => (
                                                            <th key={d} className="p-2.5 text-center font-bold text-indigo-300">{d}</th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {(allRoutes[selectedScheduleUser] || [])
                                                        .filter(b => b && b.trim() !== '')
                                                        .map((branch, bIdx) => {
                                                            return (
                                                                <tr key={bIdx} className="hover:bg-white/5 transition">
                                                                    <td className="p-2.5 font-bold text-gray-200">{branch}</td>
                                                                    {WEEK_DAYS.map(day => {
                                                                        const isAssigned = (currentSchedule[day] || []).includes(branch);
                                                                        return (
                                                                            <td key={day} className="p-2.5 text-center">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => handleToggleBranchDay(branch, day)}
                                                                                    className={`w-7 h-7 rounded-lg font-bold text-xs transition inline-flex items-center justify-center cursor-pointer ${
                                                                                        isAssigned 
                                                                                            ? 'bg-indigo-600 text-white shadow-md' 
                                                                                            : 'bg-white/5 hover:bg-white/10 text-gray-500 border border-white/10'
                                                                                    }`}
                                                                                    title={`${isAssigned ? 'إلغاء زيارة' : 'إضافة زيارة'} ${branch} يوم ${day}`}
                                                                                >
                                                                                    {isAssigned ? '✓' : ''}
                                                                                </button>
                                                                            </td>
                                                                        );
                                                                    })}
                                                                </tr>
                                                            );
                                                        })
                                                    }
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* في حال اختيار عرض جدول جميع الموظفين (الكل) */}
                        {selectedScheduleUser === 'all' && (
                            <div className="space-y-4 animate-in fade-in duration-200">
                                {/* شريط أزرار تصدير جدول جميع الموظفين */}
                                <div className="bg-gradient-to-r from-gray-800/90 to-gray-800/60 p-3.5 sm:p-4 rounded-2xl border border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                                    <div className="text-xs sm:text-sm font-bold text-gray-200">
                                        جدول خطوط السير الأسبوعية (المسجل لهم جدول خط السير فقط):
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                                        <button
                                            onClick={handleExportAllSchedulesExcel}
                                            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold py-2.5 px-3.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                                            title="تصدير جدول جميع الموظفين إلى إكسيل"
                                        >
                                            <FileSpreadsheet size={15} />
                                            <span>تصدير Excel (الكل)</span>
                                        </button>
                                        <button
                                            onClick={handleExportAllSchedulesPDF}
                                            disabled={isExportingSchedulePDF}
                                            className="flex-1 sm:flex-none bg-rose-600 hover:bg-rose-500 text-white text-xs sm:text-sm font-bold py-2.5 px-3.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
                                            title="تصدير جدول جميع الموظفين إلى PDF"
                                        >
                                            {isExportingSchedulePDF ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}
                                            <span>تصدير PDF (الكل)</span>
                                        </button>
                                        <button
                                            onClick={handlePrintAllSchedules}
                                            className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-bold py-2.5 px-3.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
                                            title="طباعة مباشرة لجدول جميع الموظفين"
                                        >
                                            <Printer size={15} />
                                            <span>طباعة (الكل)</span>
                                        </button>
                                    </div>
                                </div>

                                {/* جدول شامل لجميع الموظفين */}
                                {(() => {
                                    const eligibleUsers = activeUsersList
                                        .filter(u => u.name !== 'المدير العام' && u.name !== 'Mr. Khaled attef' && !(u.name && u.name.includes('@')))
                                        .filter(u => {
                                            const sched = getEffectiveSchedule(u.key!);
                                            const total = WEEK_DAYS.reduce((sum, d) => sum + (sched[d]?.length || 0), 0);
                                            return total > 0;
                                        });

                                    if (eligibleUsers.length === 0) {
                                        return (
                                            <div className="text-center py-12 text-gray-500 text-sm bg-gray-800/40 rounded-2xl border border-white/5">
                                                لا توجد جداول خطوط سير مسجلة لأي موظف حالياً
                                            </div>
                                        );
                                    }

                                    return (
                                        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-gray-800/80 shadow-md">
                                            <table className="w-full text-xs text-right border-collapse">
                                                <thead>
                                                    <tr className="bg-gray-900 border-b border-white/10 text-gray-200">
                                                        <th className="p-3 text-center w-12 font-black">م</th>
                                                        <th className="p-3 font-black text-indigo-400 min-w-[140px]">اسم الموظف</th>
                                                        {WEEK_DAYS.map(day => (
                                                            <th key={day} className="p-3 text-center font-black min-w-[130px] border-r border-white/5">
                                                                {day}
                                                            </th>
                                                        ))}
                                                        <th className="p-3 text-center w-28">إجراءات</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {eligibleUsers.map((u, idx) => {
                                                        const sched = getEffectiveSchedule(u.key!);
                                                        return (
                                                            <tr key={u.key} className="hover:bg-white/5 transition">
                                                                <td className="p-3 text-center text-gray-400 font-bold">{idx + 1}</td>
                                                                <td className="p-3 font-black text-white">{u.name}</td>
                                                                {WEEK_DAYS.map(day => {
                                                                    const dayBranches = sched[day] || [];
                                                                    return (
                                                                        <td key={day} className="p-2.5 text-center border-r border-white/5 align-top">
                                                                            {dayBranches.length === 0 ? (
                                                                                <span className="text-gray-600">-</span>
                                                                            ) : (
                                                                                <div className="flex flex-col gap-1 items-center">
                                                                                    {dayBranches.map((b, bi) => (
                                                                                        <span 
                                                                                            key={bi} 
                                                                                            className="bg-indigo-500/15 text-indigo-200 px-2 py-0.5 rounded-lg text-[11px] font-bold border border-indigo-500/20 max-w-full truncate"
                                                                                            title={b}
                                                                                        >
                                                                                            {b}
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )}
                                                                        </td>
                                                                    );
                                                                })}
                                                                <td className="p-3 text-center align-middle">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleSelectScheduleUser(u.key!)}
                                                                        className="bg-indigo-600/20 hover:bg-indigo-600 text-indigo-400 hover:text-white px-2.5 py-1 rounded-lg text-[11px] font-bold border border-indigo-500/30 transition cursor-pointer"
                                                                        title="تعديل جدول سير هذا الموظف"
                                                                    >
                                                                        تعديل
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}

                        {/* عند عدم اختيار موظف */}
                        {!selectedScheduleUser && (
                            <div className="text-center py-16 text-gray-400 space-y-2 bg-gray-800/40 rounded-2xl border border-white/5">
                                <CalendarIcon size={36} className="mx-auto text-indigo-400/60 mb-2" />
                                <div className="font-bold text-sm text-gray-300">يرجى اختيار اسم الموظف من القائمة أعلاه</div>
                                <div className="text-xs text-gray-500">أو اختيار "الكل" لعرض وتصدير جدول خطوط السير لجميع الموظفين</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* حاوية طباعة وتصدير PDF لجدول سير الموظف المختار */}
            <div
                ref={schedulePrintContainerRef}
                style={{
                    display: 'none',
                    width: '1300px',
                    boxSizing: 'border-box',
                    fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif"
                }}
                dir="rtl"
                className="bg-white text-gray-900 p-6 font-sans flex flex-col justify-start"
            >
                {(() => {
                    const targetKey = scheduleExportTarget || selectedScheduleUser;
                    const userObj = activeUsersList.find(u => u.key === targetKey);
                    const userName = userObj?.name || 'الموظف';
                    const schedule = targetKey ? getEffectiveSchedule(targetKey) : null;

                    return (
                        <div className="w-full space-y-4">
                            {/* ترويسة التقرير */}
                            <div className="flex justify-between items-center border-b-2 border-indigo-600 pb-3">
                                <div>
                                    <h1 className="text-2xl font-black text-indigo-900">شركة سوفت روز (Soft Rose)</h1>
                                    <h2 className="text-lg font-bold text-gray-700">جدول خط السير الأسبوعي للموظف: <span className="text-indigo-700 font-black">{userName}</span></h2>
                                </div>
                                <div className="text-left text-xs font-bold text-gray-500 space-y-1">
                                    <div>تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}</div>
                                    <div>الساعة: {new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                            </div>

                            {/* جدول الأيام الستة */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#4f46e5', color: '#ffffff' }}>
                                        {WEEK_DAYS.map(day => (
                                            <th key={day} style={{ padding: '10px', border: '1px solid #4338ca', fontSize: '15px', fontWeight: 'bold' }}>
                                                {day}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {(() => {
                                        if (!schedule) return null;
                                        const maxBranches = Math.max(1, ...WEEK_DAYS.map(d => (schedule[d] || []).length));
                                        const rows = [];
                                        for (let r = 0; r < maxBranches; r++) {
                                            rows.push(
                                                <tr key={r} style={{ backgroundColor: r % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                                                    {WEEK_DAYS.map(day => {
                                                        const branch = (schedule[day] || [])[r];
                                                        return (
                                                            <td key={day} style={{ padding: '10px 6px', border: '1px solid #d1d5db', textAlign: 'center', fontSize: '13px', fontWeight: 'bold', color: '#1f2937' }}>
                                                                {branch || '-'}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        }
                                        return rows;
                                    })()}
                                </tbody>
                            </table>
                            <div className="text-center text-[11px] font-bold text-gray-400 pt-2 border-t border-gray-200">
                                نظام سوفت روز لإدارة المبيعات والمخزون - جدول خط السير الأسبوعي
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* حاوية طباعة وتصدير PDF لجدول جميع الموظفين */}
            <div
                ref={allSchedulePrintContainerRef}
                style={{
                    display: 'none',
                    width: '1300px',
                    boxSizing: 'border-box',
                    fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif"
                }}
                dir="rtl"
                className="bg-white text-gray-900 p-6 font-sans flex flex-col justify-start"
            >
                {(() => {
                    const eligibleUsers = activeUsersList
                        .filter(u => u.name !== 'المدير العام' && u.name !== 'Mr. Khaled attef' && !(u.name && u.name.includes('@')))
                        .filter(u => {
                            const sched = getEffectiveSchedule(u.key!);
                            const count = WEEK_DAYS.reduce((sum, d) => sum + (sched[d]?.length || 0), 0);
                            return count > 0;
                        });

                    return (
                        <div className="w-full space-y-4">
                            {/* ترويسة التقرير */}
                            <div className="flex justify-between items-center border-b-2 border-indigo-600 pb-3">
                                <div>
                                    <h1 className="text-2xl font-black text-indigo-900">شركة سوفت روز (Soft Rose)</h1>
                                    <h2 className="text-lg font-bold text-gray-700">جدول خطوط السير الأسبوعية لكافة الموظفين</h2>
                                </div>
                                <div className="text-left text-xs font-bold text-gray-500 space-y-1">
                                    <div>تاريخ الاستخراج: {new Date().toLocaleDateString('ar-EG')}</div>
                                    <div>عدد الموظفين: {eligibleUsers.length}</div>
                                </div>
                            </div>

                            {/* جدول خطوط سير كافة الموظفين */}
                            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                                <thead>
                                    <tr style={{ backgroundColor: '#4f46e5', color: '#ffffff' }}>
                                        <th style={{ padding: '8px', border: '1px solid #4338ca', width: '40px', fontSize: '13px' }}>م</th>
                                        <th style={{ padding: '8px', border: '1px solid #4338ca', width: '150px', fontSize: '14px', textAlign: 'right' }}>اسم الموظف</th>
                                        {WEEK_DAYS.map(day => (
                                            <th key={day} style={{ padding: '8px', border: '1px solid #4338ca', fontSize: '13px' }}>
                                                {day}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {eligibleUsers.map((u, idx) => {
                                        const sched = getEffectiveSchedule(u.key!);
                                        return (
                                            <tr key={u.key} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                                                <td style={{ padding: '6px', border: '1px solid #d1d5db', textAlign: 'center', fontSize: '12px', fontWeight: 'bold' }}>{idx + 1}</td>
                                                <td style={{ padding: '6px 8px', border: '1px solid #d1d5db', fontSize: '13px', fontWeight: 'bold', textAlign: 'right', color: '#111827' }}>{u.name}</td>
                                                {WEEK_DAYS.map(day => {
                                                    const dayBranches = sched[day] || [];
                                                    return (
                                                        <td key={day} style={{ padding: '6px', border: '1px solid #d1d5db', textAlign: 'center', fontSize: '12px', color: '#1f2937' }}>
                                                            {dayBranches.length === 0 ? '-' : dayBranches.join(' - ')}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            <div className="text-center text-[11px] font-bold text-gray-400 pt-2 border-t border-gray-200">
                                نظام سوفت روز لإدارة المبيعات والمخزون - جدول خطوط السير الشامل
                            </div>
                        </div>
                    );
                })()}
            </div>

            {/* الحاوية المخصصة لتصدير PDF والطباعة بالعرض في ورقة واحدة واخذة مساحة الورقة حتى الحواف */}
            <div
                ref={routePrintContainerRef}
                style={{
                    display: 'none',
                    width: '1300px',
                    boxSizing: 'border-box',
                    fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif"
                }}
                dir="rtl"
                className="bg-white text-gray-900 p-4 font-sans flex flex-col justify-start"
            >
                {(() => {
                    const eligible = activeUsersList.filter(
                        u => u.name !== 'المدير العام' && u.name !== 'Mr. Khaled attef' && !(u.name && u.name.includes('@'))
                    );
                    const target = routeExportTarget || selectedRouteUser || 'all';
                    const usersToShow = target === 'all'
                        ? eligible.filter(u => {
                            const b = allRoutes[u.key!] || [];
                            return b.some(x => x && x.trim() !== '');
                        })
                        : eligible.filter(u => u.key === target);

                    if (usersToShow.length === 0) {
                        return (
                            <div className="flex-1 flex items-center justify-center text-gray-500 font-bold text-lg">
                                لا توجد أي فروع مسجلة
                            </div>
                        );
                    }

                    // تجهيز فروع كل موظف
                    const userBranchesMap: Record<string, string[]> = {};
                    usersToShow.forEach(u => {
                        let branches = allRoutes[u.key!] || [];
                        if (target === u.key && routeBranches && routeBranches.length > 0) {
                            const nonEmpty = routeBranches.filter(b => b && b.trim() !== '');
                            if (nonEmpty.length > 0) branches = routeBranches;
                        }
                        userBranchesMap[u.key!] = branches.filter(b => b && b.trim() !== '');
                    });

                    // ترتيب الأسماء: الأكثر فروعاً بالأعلى، والأقل فروعاً (فرع واحد) بالأسفل
                    const sortedUsers = [...usersToShow].sort((a, b) => {
                        const countA = userBranchesMap[a.key!]?.length || 0;
                        const countB = userBranchesMap[b.key!]?.length || 0;
                        return countB - countA;
                    });

                    // تقسيم الأسماء في صفوف: كل صف 5 أسماء
                    const chunks: (typeof sortedUsers)[] = [];
                    for (let i = 0; i < sortedUsers.length; i += 5) {
                        chunks.push(sortedUsers.slice(i, i + 5));
                    }

                    const targetUserName = target === 'all'
                        ? 'تقرير شامل (جميع الموظفين)'
                        : `الموظف: ${activeUsersList.find(u => u.key === target)?.name || 'الموظف المحدد'}`;

                    return (
                        <>
                            {/* ترويسة التقرير في سطر واحد مضغوط */}
                            <div className="border-b-2 border-indigo-700 pb-2 mb-2 flex justify-between items-center shrink-0">
                                <div className="flex items-center gap-3">
                                    <div className="bg-indigo-700 text-white font-black text-sm px-3 py-1 rounded-lg">
                                        شركة سوفت روز للتجارة الحديثة
                                    </div>
                                    <h2 className="text-base font-extrabold text-gray-900">
                                        جدول خطوط السير والفروع المسجلة
                                    </h2>
                                </div>
                                <div className="flex items-center gap-4 text-xs font-semibold text-gray-600">
                                    <div>نطاق التقرير: <span className="text-indigo-700 font-bold">{targetUserName}</span></div>
                                    <div>التاريخ: <span className="font-bold">{new Date().toLocaleDateString('ar-EG')}</span></div>
                                    <div>الوقت: <span className="font-bold">{new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span></div>
                                </div>
                            </div>

                            {/* شبكة الجداول: في كل سطر 5 أسماء وأسفلها الفروع */}
                            <div className="flex-1 w-full flex flex-col justify-start gap-4 overflow-visible">
                                {chunks.map((chunk, chunkIdx) => {
                                    const maxBranchesInChunk = Math.max(1, ...chunk.map(u => (userBranchesMap[u.key!] || []).length));
                                    const columns = target !== 'all' ? [chunk[0]] : [0, 1, 2, 3, 4].map(colIdx => chunk[colIdx]);
                                    const colWidth = target !== 'all' ? '100%' : '20%';

                                    return (
                                        <div key={chunkIdx} className="w-full border-2 border-slate-700 rounded-md overflow-visible bg-white shadow-sm">
                                            <table className="w-full table-fixed border-collapse text-center">
                                                <thead>
                                                    <tr className="bg-slate-900 text-white">
                                                        {columns.map((u, colIdx) => {
                                                            if (!u) {
                                                                return (
                                                                    <th
                                                                        key={`empty-h-${colIdx}`}
                                                                        style={{ width: colWidth }}
                                                                        className="bg-slate-950/40 border border-slate-700"
                                                                    />
                                                                );
                                                            }
                                                            return (
                                                                <th
                                                                    key={u.key}
                                                                    style={{ width: colWidth }}
                                                                    className="bg-slate-900 text-white font-black py-3 px-2 border-2 border-slate-700 text-center align-middle"
                                                                >
                                                                    <div
                                                                        style={{
                                                                            fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
                                                                            fontSize: target !== 'all' ? '18px' : '15px',
                                                                            fontWeight: '900',
                                                                            lineHeight: '1.4',
                                                                            color: '#ffffff',
                                                                            wordBreak: 'keep-all',
                                                                            overflowWrap: 'normal',
                                                                            whiteSpace: 'normal',
                                                                            textAlign: 'center',
                                                                            minHeight: '44px',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            letterSpacing: '0px'
                                                                        }}
                                                                    >
                                                                        {u.name}
                                                                    </div>
                                                                </th>
                                                            );
                                                        })}
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {Array.from({ length: maxBranchesInChunk }).map((_, rIdx) => (
                                                        <tr key={rIdx} className={rIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                                                            {columns.map((u, colIdx) => {
                                                                if (!u) {
                                                                    return (
                                                                        <td
                                                                            key={`empty-c-${colIdx}`}
                                                                            style={{ width: colWidth }}
                                                                            className="bg-slate-50/30 border border-slate-200"
                                                                        />
                                                                    );
                                                                }
                                                                const branches = userBranchesMap[u.key!] || [];
                                                                const branchName = branches[rIdx];

                                                                return (
                                                                    <td
                                                                        key={u.key}
                                                                        style={{ width: colWidth }}
                                                                        className="border border-slate-300 p-1.5 text-center align-middle bg-white"
                                                                    >
                                                                        {branchName ? (
                                                                            <div
                                                                                style={{
                                                                                    fontFamily: "'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif",
                                                                                    fontSize: target !== 'all' ? '14px' : '12px',
                                                                                    fontWeight: '700',
                                                                                    lineHeight: '1.4',
                                                                                    color: '#0f172a',
                                                                                    backgroundColor: '#eef2ff',
                                                                                    border: '1px solid #c7d2fe',
                                                                                    borderRadius: '4px',
                                                                                    padding: '6px 8px',
                                                                                    wordBreak: 'keep-all',
                                                                                    overflowWrap: 'normal',
                                                                                    whiteSpace: 'normal',
                                                                                    textAlign: 'center'
                                                                                }}
                                                                            >
                                                                                {branchName}
                                                                            </div>
                                                                        ) : (
                                                                            <span className="text-slate-300 font-light text-xs">-</span>
                                                                        )}
                                                                    </td>
                                                                );
                                                            })}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* تذييل الصفحة في سطر واحد مضغوط */}
                            <div className="pt-2 mt-1 border-t border-gray-300 flex justify-between items-center text-[10px] text-gray-500 shrink-0 font-medium">
                                <span>نظام إدارة الموارد البشرية - رصيد الإجازات والغياب</span>
                                <span>بيان خطوط السير - تم الاستخراج بتاريخ {new Date().toLocaleDateString('ar-EG')}</span>
                                <span>المستخدم: {user.name || 'الإدارة'}</span>
                            </div>
                        </>
                    );
                })()}
            </div>

            {/* الحاوية المخصصة لتصدير PDF للسجل الكامل للإجازات والغياب للموظف */}
            {historyUserView && (
                <div
                    ref={fullHistoryPrintContainerRef}
                    style={{
                        display: 'none',
                        width: '1050px',
                        backgroundColor: '#ffffff',
                        boxSizing: 'border-box',
                        direction: 'rtl',
                        fontFamily: "'Cairo', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                    }}
                >
                    {(() => {
                        const targetUser = usersList.find(u => u.key === historyUserView.userId || u.username === historyUserView.userId);
                        const userBal = balances[historyUserView.userId] || {
                            userId: historyUserView.userId,
                            employeeName: historyUserView.name,
                            annual: 21,
                            casual: 7,
                            sick: 0,
                            exams: 0,
                            unpaid: 0
                        };

                        const userAllRecords = allHistory
                            .filter(r => r.userId === historyUserView.userId)
                            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                        const totalAnnualTaken = userAllRecords
                            .filter(r => r.type === 'annual' || (r.deductedFromAnnual && r.deductedFromAnnual > 0))
                            .reduce((sum, r) => sum + (Number(r.deductedFromAnnual || r.days) || 0), 0);

                        const totalCasualTaken = userAllRecords
                            .filter(r => r.type === 'casual' || (r.deductedFromCasual && r.deductedFromCasual > 0))
                            .reduce((sum, r) => sum + (Number(r.deductedFromCasual || r.days) || 0), 0);

                        const totalSickTaken = userAllRecords
                            .filter(r => r.type === 'sick')
                            .reduce((sum, r) => sum + (Number(r.days) || 0), 0);

                        const totalSummerTaken = userAllRecords
                            .filter(r => r.type === 'summer')
                            .reduce((sum, r) => sum + (Number(r.days) || 0), 0) || Number((userBal as any).summer || 0);

                        const totalExamsTaken = userAllRecords
                            .filter(r => r.type === 'exams')
                            .reduce((sum, r) => sum + (Number(r.days) || 0), 0) || Number(userBal.exams || 0);

                        const totalUnpaidTaken = userAllRecords
                            .filter(r => r.type === 'unpaid' || (r.deductedFromUnpaid && r.deductedFromUnpaid > 0))
                            .reduce((sum, r) => sum + (Number(r.days) || 0), 0);

                        const totalPenaltyTaken = userAllRecords
                            .filter(r => r.type === 'penalty')
                            .reduce((sum, r) => sum + (Number(r.days) || 0), 0) || Number((userBal as any).penalty || 0);

                        const totalConsumedDays = userAllRecords
                            .filter(r => r.type !== 'official')
                            .reduce((s, r) => s + (Number(r.days) || 0), 0);

                        const remainingAnnual = userBal.annual ?? 21;
                        const remainingCasual = userBal.casual ?? 7;
                        const totalRemaining = remainingAnnual + remainingCasual;

                        const exportDate = pdfExportTime || new Date();
                        const exportDay = exportDate.toLocaleDateString('ar-EG', { weekday: 'long' });
                        const exportDateStr = formatToDDMMYYYY(exportDate);
                        const exportDateIso = exportDate.toISOString().split('T')[0];
                        const exportTimeStr = exportDate.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

                        const empArabicName = historyUserView.name || targetUser?.name || '-';
                        const empEnglishName = (targetUser as any)?.englishName || (targetUser as any)?.nameEn || targetUser?.username || '-';
                        const empJobTitle = getRoleTitle(targetUser?.role || (targetUser as any)?.jobTitle);

                        const renderTableHeader = () => (
                            <thead>
                                <tr style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}>
                                    <th style={{ padding: '10px', border: '1px solid #1e3a8a', width: '45px', textAlign: 'center' }}>م</th>
                                    <th style={{ padding: '10px', border: '1px solid #1e3a8a', width: '130px', textAlign: 'center' }}>يوم الإجازة</th>
                                    <th style={{ padding: '10px', border: '1px solid #1e3a8a', width: '130px', textAlign: 'center' }}>التاريخ</th>
                                    <th style={{ padding: '10px', border: '1px solid #1e3a8a', width: '100px', textAlign: 'center' }}>عدد الأيام</th>
                                    <th style={{ padding: '10px', border: '1px solid #1e3a8a', textAlign: 'right' }}>نوع الإجازة والبيان</th>
                                    <th style={{ padding: '10px', border: '1px solid #1e3a8a', width: '160px', textAlign: 'center' }}>حالة الخصم</th>
                                </tr>
                            </thead>
                        );

                        const renderLeaveRow = (rec: LeaveRecord, idx: number) => {
                            const dayOfWeek = getDayOfWeekName(rec);
                            const deduction = getDeductionBadgeInfo(rec);
                            const displayDate = getDisplayDate(rec);

                            return (
                                <tr 
                                    key={`full-leave-row-${rec.id || idx}`}
                                    style={{ 
                                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                                        borderBottom: '1px solid #cbd5e1'
                                    }}
                                >
                                    <td style={{ padding: '10px 12px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold', color: '#64748b', fontSize: '12px' }}>
                                        {idx + 1}
                                    </td>
                                    <td style={{ padding: '10px 12px', border: '1px solid #cbd5e1', fontWeight: 'bold', color: '#0f172a', textAlign: 'center', fontSize: '12px' }}>
                                        {dayOfWeek}
                                    </td>
                                    <td style={{ padding: '10px 12px', border: '1px solid #cbd5e1', textAlign: 'center', fontSize: '12px', fontWeight: '900', color: '#0f172a', direction: 'ltr', unicodeBidi: 'isolate' }}>
                                        <span style={{ color: '#0f172a', fontWeight: '900', display: 'inline-block', direction: 'ltr', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, Arial, sans-serif" }}>
                                            {displayDate}
                                        </span>
                                    </td>
                                    <td style={{ padding: '10px 12px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '900', color: '#0f172a', fontSize: '12px' }}>
                                        {rec.days} {rec.days === 1 ? 'يوم' : rec.days === 2 ? 'يومان' : 'أيام'}
                                    </td>
                                    <td style={{ padding: '10px 12px', border: '1px solid #cbd5e1', fontWeight: '700', color: '#1e293b', fontSize: '12px' }}>
                                        {formatLeaveTitle(rec)}
                                    </td>
                                    <td style={{ padding: '10px 12px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                        <span style={{ 
                                            display: 'inline-block',
                                            padding: '4px 12px', 
                                            borderRadius: '6px', 
                                            fontSize: '11px', 
                                            fontWeight: 'bold',
                                            backgroundColor: deduction.bg,
                                            color: deduction.color
                                        }}>
                                            {deduction.badge}
                                        </span>
                                    </td>
                                </tr>
                            );
                        };

                        const renderSummarySection = () => (
                            <div style={{ 
                                border: '2px solid #cbd5e1', 
                                borderRadius: '16px', 
                                padding: '18px 22px', 
                                backgroundColor: '#f8fafc',
                                marginBottom: '24px'
                            }}>
                                <h4 style={{ fontSize: '14px', fontWeight: '900', color: '#1e3a8a', margin: '0 0 14px 0' }}>
                                    ملخص استهلاك الإجازات وأرصدة الموظف المتبقية
                                </h4>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                                    {/* عدد أيام السنوي */}
                                    <div style={{ border: '1px solid #bbf7d0', backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '11px', color: '#15803d', fontWeight: 'bold' }}>أيام السنوي المستهلكة</div>
                                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#166534', marginTop: '4px' }}>{totalAnnualTaken} <span style={{ fontSize: '10px' }}>يوم</span></div>
                                    </div>

                                    {/* عدد أيام العارضة */}
                                    <div style={{ border: '1px solid #fef08a', backgroundColor: '#fefce8', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '11px', color: '#854d0e', fontWeight: 'bold' }}>أيام العارضة المستهلكة</div>
                                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#713f12', marginTop: '4px' }}>{totalCasualTaken} <span style={{ fontSize: '10px' }}>يوم</span></div>
                                    </div>

                                    {/* عدد أيام المرضي */}
                                    <div style={{ border: '1px solid #fecaca', backgroundColor: '#fef2f2', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 'bold' }}>أيام المرضي</div>
                                        <div style={{ fontSize: '20px', fontWeight: '900', color: '#991b1b', marginTop: '4px' }}>{totalSickTaken} <span style={{ fontSize: '10px' }}>يوم</span></div>
                                    </div>

                                    {/* عدد أيام المصيف أو الامتحانات على حسب */}
                                    {totalSummerTaken > 0 ? (
                                        <div style={{ border: '1px solid #99f6e4', backgroundColor: '#f0fdfa', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '11px', color: '#0f766e', fontWeight: 'bold' }}>أيام المصيف</div>
                                            <div style={{ fontSize: '20px', fontWeight: '900', color: '#115e59', marginTop: '4px' }}>{totalSummerTaken} <span style={{ fontSize: '10px' }}>يوم</span></div>
                                        </div>
                                    ) : totalExamsTaken > 0 ? (
                                        <div style={{ border: '1px solid #e9d5ff', backgroundColor: '#faf5ff', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '11px', color: '#7e22ce', fontWeight: 'bold' }}>أيام الامتحانات</div>
                                            <div style={{ fontSize: '20px', fontWeight: '900', color: '#6b21a8', marginTop: '4px' }}>{totalExamsTaken} <span style={{ fontSize: '10px' }}>يوم</span></div>
                                        </div>
                                    ) : (
                                        <div style={{ border: '1px solid #fed7aa', backgroundColor: '#fff7ed', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                                            <div style={{ fontSize: '11px', color: '#c2410c', fontWeight: 'bold' }}>تخصم من الراتب / بإذن</div>
                                            <div style={{ fontSize: '20px', fontWeight: '900', color: '#9a3412', marginTop: '4px' }}>{totalUnpaidTaken} <span style={{ fontSize: '10px' }}>يوم</span></div>
                                        </div>
                                    )}
                                </div>

                                {/* تفاصيل إضافية للمصيف والامتحانات والجزاءات إن وجدت */}
                                {((totalSummerTaken > 0 && totalExamsTaken > 0) || totalPenaltyTaken > 0 || (totalUnpaidTaken > 0 && (totalSummerTaken > 0 || totalExamsTaken > 0))) && (
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px', fontSize: '11px' }}>
                                        {totalSummerTaken > 0 && totalExamsTaken > 0 && (
                                            <span style={{ backgroundColor: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe', padding: '4px 10px', borderRadius: '8px', fontWeight: 'bold' }}>
                                                امتحانات: {totalExamsTaken} يوم
                                            </span>
                                        )}
                                        {totalUnpaidTaken > 0 && (
                                            <span style={{ backgroundColor: '#ffedd5', color: '#9a3412', border: '1px solid #fed7aa', padding: '4px 10px', borderRadius: '8px', fontWeight: 'bold' }}>
                                                خصم من الراتب / غياب بإذن: {totalUnpaidTaken} يوم
                                            </span>
                                        )}
                                        {totalPenaltyTaken > 0 && (
                                            <span style={{ backgroundColor: '#ffe4e6', color: '#9f1239', border: '1px solid #fecdd3', padding: '4px 10px', borderRadius: '8px', fontWeight: 'bold' }}>
                                                جزاءات: {totalPenaltyTaken} يوم
                                            </span>
                                        )}
                                    </div>
                                )}

                                {/* المتبقي من الرصيد */}
                                <div style={{ 
                                    borderTop: '2px dashed #cbd5e1', 
                                    paddingTop: '16px', 
                                    display: 'grid', 
                                    gridTemplateColumns: 'repeat(3, 1fr)', 
                                    gap: '14px' 
                                }}>
                                    <div style={{ backgroundColor: '#ecfdf5', border: '2px solid #10b981', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '900', color: '#047857' }}>المتبقي من رصيد السنوي</div>
                                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#065f46', marginTop: '3px' }}>{remainingAnnual} <span style={{ fontSize: '11px' }}>يوم</span></div>
                                    </div>

                                    <div style={{ backgroundColor: '#fffbeb', border: '2px solid #f59e0b', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '900', color: '#b45309' }}>المتبقي من رصيد العارضة</div>
                                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#92400e', marginTop: '3px' }}>{remainingCasual} <span style={{ fontSize: '11px' }}>يوم</span></div>
                                    </div>

                                    <div style={{ backgroundColor: '#eff6ff', border: '2px solid #2563eb', borderRadius: '14px', padding: '14px', textAlign: 'center' }}>
                                        <div style={{ fontSize: '12px', fontWeight: '900', color: '#1d4ed8' }}>إجمالي الرصيد المتبقي</div>
                                        <div style={{ fontSize: '24px', fontWeight: '900', color: '#1e3a8a', marginTop: '3px' }}>{totalRemaining} <span style={{ fontSize: '11px' }}>يوم</span></div>
                                    </div>
                                </div>
                            </div>
                        );

                        const renderSignatures = () => (
                            <div style={{ 
                                marginTop: '24px', 
                                paddingTop: '16px', 
                                borderTop: '1.5px solid #cbd5e1', 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                fontSize: '12px', 
                                color: '#334155' 
                            }}>
                                <div style={{ textAlign: 'center', width: '220px' }}>
                                    <p style={{ fontWeight: 'bold', margin: '0 0 36px 0' }}>توقيع الموظف</p>
                                    <p style={{ borderTop: '1px dashed #94a3b8', paddingTop: '4px', margin: 0 }}>........................................</p>
                                </div>
                                <div style={{ textAlign: 'center', width: '220px' }}>
                                    <p style={{ fontWeight: 'bold', margin: '0 0 36px 0' }}>الموارد البشرية</p>
                                    <p style={{ borderTop: '1px dashed #94a3b8', paddingTop: '4px', margin: 0 }}>........................................</p>
                                </div>
                                <div style={{ textAlign: 'center', width: '220px' }}>
                                    <p style={{ fontWeight: 'bold', margin: '0 0 36px 0' }}>اعتماد الإدارة العامة</p>
                                    <p style={{ borderTop: '1px dashed #94a3b8', paddingTop: '4px', margin: 0 }}>........................................</p>
                                </div>
                            </div>
                        );

                        const totalRecs = userAllRecords.length;
                        const isMultiPage = totalRecs > 12;
                        const page1Count = isMultiPage ? Math.min(18, Math.max(12, totalRecs - 4)) : totalRecs;
                        const page1Records = userAllRecords.slice(0, page1Count);
                        const page2Records = isMultiPage ? userAllRecords.slice(page1Count) : [];

                        return (
                            <div>
                                {/* الورقة الأولى */}
                                <div 
                                    className="leave-pdf-page"
                                    style={{ 
                                        width: '1050px', 
                                        minHeight: '1420px', 
                                        backgroundColor: '#ffffff', 
                                        padding: '36px 40px 36px 40px', 
                                        boxSizing: 'border-box',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        marginBottom: isMultiPage ? '30px' : '0'
                                    }}
                                >
                                    <div>
                                        {/* ترويسة التقرير الرسمية */}
                                        <div style={{ borderBottom: '3px solid #1e3a8a', paddingBottom: '16px', marginBottom: '20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#1e3a8a', margin: '0 0 5px 0' }}>
                                                        شركة سوفت روز للصناعات الورقية (Soft Rose)
                                                    </h1>
                                                    <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#0284c7', margin: 0 }}>
                                                        السجل الكامل للإجازات والغياب ورصيد الموظف
                                                    </h2>
                                                </div>
                                                <div style={{ textAlign: 'left', border: '1.5px solid #cbd5e1', borderRadius: '14px', padding: '12px 18px', backgroundColor: '#f8fafc', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                                    <div style={{ fontSize: '12px', color: '#0f172a', marginBottom: '4px' }}>
                                                        <strong style={{ color: '#1e3a8a' }}>يوم الطباعة:</strong> <span style={{ color: '#0f172a', fontWeight: 'bold' }}>{exportDay}</span>
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#0f172a', marginBottom: '4px' }}>
                                                        <strong style={{ color: '#1e3a8a' }}>تاريخ الطباعة:</strong> <span style={{ color: '#0f172a', fontWeight: 'bold', direction: 'ltr', display: 'inline-block' }}>{exportDateStr}</span>
                                                    </div>
                                                    <div style={{ fontSize: '12px', color: '#0f172a' }}>
                                                        <strong style={{ color: '#1e3a8a' }}>ساعة الطباعة:</strong> <span style={{ color: '#e11d48', fontWeight: 'bold' }}>{exportTimeStr}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* البطاقة التعريفية الشاملة لبيانات الموظف والطباعة */}
                                        <div style={{ 
                                            display: 'grid', 
                                            gridTemplateColumns: 'repeat(3, 1fr)', 
                                            gap: '14px', 
                                            marginBottom: '20px',
                                            backgroundColor: '#f8fafc',
                                            border: '1.5px solid #cbd5e1',
                                            borderRadius: '16px',
                                            padding: '16px 20px'
                                        }}>
                                            <div style={{ borderRight: '3px solid #1e3a8a', paddingRight: '12px' }}>
                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '3px' }}>الاسم (عربي):</div>
                                                <div style={{ fontSize: '16px', fontWeight: '900', color: '#0f172a' }}>{empArabicName}</div>
                                            </div>
                                            <div style={{ borderRight: '3px solid #0284c7', paddingRight: '12px' }}>
                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '3px' }}>الاسم (إنجليزي):</div>
                                                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#0284c7', direction: 'ltr', textAlign: 'right' }}>{empEnglishName}</div>
                                            </div>
                                            <div style={{ borderRight: '3px solid #059669', paddingRight: '12px' }}>
                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '3px' }}>الوظيفة:</div>
                                                <div style={{ fontSize: '15px', fontWeight: '800', color: '#047857' }}>{empJobTitle}</div>
                                            </div>
                                            <div style={{ borderRight: '3px solid #6366f1', paddingRight: '12px' }}>
                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '3px' }}>يوم الطباعة:</div>
                                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a' }}>{exportDay}</div>
                                            </div>
                                            <div style={{ borderRight: '3px solid #8b5cf6', paddingRight: '12px' }}>
                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '3px' }}>تاريخ الطباعة:</div>
                                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0f172a', direction: 'ltr', display: 'inline-block' }}>{exportDateStr}</div>
                                            </div>
                                            <div style={{ borderRight: '3px solid #e11d48', paddingRight: '12px' }}>
                                                <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold', marginBottom: '3px' }}>ساعة الطباعة:</div>
                                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#e11d48' }}>{exportTimeStr}</div>
                                            </div>
                                        </div>

                                        {/* جدول سجل الإجازات المنسق */}
                                        <div style={{ marginBottom: isMultiPage ? '16px' : '20px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                <h3 style={{ fontSize: '15px', fontWeight: '900', color: '#1e3a8a', margin: 0 }}>
                                                    سجل الإجازات والغياب {isMultiPage ? `(الجزء الأول: 1 إلى ${page1Records.length} من إجمالي ${totalRecs} عملية)` : `(${totalRecs} عملية مسجلة)`}
                                                </h3>
                                                <span style={{ fontSize: '12px', color: '#0f172a', fontWeight: 'bold', backgroundColor: '#e2e8f0', padding: '4px 10px', borderRadius: '8px' }}>
                                                    إجمالي أيام الغياب والإجازات: {totalConsumedDays} يوم
                                                </span>
                                            </div>

                                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'right' }}>
                                                {renderTableHeader()}
                                                <tbody>
                                                    {page1Records.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={6} style={{ padding: '36px', textAlign: 'center', border: '1px solid #cbd5e1', color: '#64748b', fontStyle: 'italic', fontSize: '13px' }}>
                                                                لا توجد أي إجازات أو غيابات مسجلة لهذا الموظف حتى الآن
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        page1Records.map((rec, idx) => renderLeaveRow(rec, idx))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* إذا كانت صفحة واحدة فقط، نعرض الملخص والتوقيعات هنا في أسفل الصفحة مع مسافة نظيفة عن النهاية */}
                                    {!isMultiPage && (
                                        <div style={{ marginTop: 'auto' }}>
                                            {renderSummarySection()}
                                            {renderSignatures()}
                                            <div style={{ marginTop: '16px', paddingTop: '8px', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>
                                                <span>نهاية التقرير المعتمد</span>
                                                <span>صفحة 1 من 1</span>
                                            </div>
                                        </div>
                                    )}

                                    {/* تذييل الصفحة الأولى عند وجود ورقة ثانية مع مسافة نظيفة عن النهاية */}
                                    {isMultiPage && (
                                        <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>
                                            <span>يتبع في الصفحة التالية (ورقة 2 من 2)...</span>
                                            <span>صفحة 1 من 2</span>
                                        </div>
                                    )}
                                </div>

                                {/* الورقة الثانية (في حال دخول الإجازات في ورقتين) */}
                                {isMultiPage && (
                                    <div 
                                        className="leave-pdf-page"
                                        style={{ 
                                            width: '1050px', 
                                            minHeight: '1420px', 
                                            backgroundColor: '#ffffff', 
                                            padding: '36px 40px 36px 40px', 
                                            boxSizing: 'border-box',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            justifyContent: 'space-between'
                                        }}
                                    >
                                        <div>
                                            {/* ترويسة الورقة الثانية */}
                                            <div style={{ borderBottom: '2.5px solid #1e3a8a', paddingBottom: '12px', marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#1e3a8a', margin: '0 0 3px 0' }}>
                                                        شركة سوفت روز للصناعات الورقية (Soft Rose)
                                                    </h2>
                                                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#0284c7' }}>
                                                        تابع السجل الكامل للإجازات والغياب ورصيد الموظف - {empArabicName}
                                                    </div>
                                                </div>
                                                <div style={{ textAlign: 'left', border: '1.5px solid #cbd5e1', borderRadius: '12px', padding: '10px 16px', backgroundColor: '#f8fafc' }}>
                                                    <div style={{ fontSize: '11px', color: '#0f172a', marginBottom: '3px' }}>
                                                        <strong style={{ color: '#1e3a8a' }}>يوم الطباعة:</strong> {exportDay}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#0f172a', marginBottom: '3px' }}>
                                                        <strong style={{ color: '#1e3a8a' }}>تاريخ الطباعة:</strong> <span style={{ direction: 'ltr', display: 'inline-block' }}>{exportDateStr}</span>
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: '#0f172a' }}>
                                                        <strong style={{ color: '#1e3a8a' }}>صفحة:</strong> 2 من 2
                                                    </div>
                                                </div>
                                            </div>

                                            {/* رأس الجدول في الورقة الثانية مطابق تماماً للورقة الأولى */}
                                            <div style={{ marginBottom: '18px' }}>
                                                <h3 style={{ fontSize: '14px', fontWeight: '900', color: '#1e3a8a', margin: '0 0 8px 0' }}>
                                                    استكمال سجل الإجازات والغياب (من {page1Records.length + 1} إلى {totalRecs})
                                                </h3>

                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'right' }}>
                                                    {renderTableHeader()}
                                                    <tbody>
                                                        {page2Records.map((rec, idx) => renderLeaveRow(rec, idx + page1Records.length))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* ملخص الأرصدة والتوقيعات في أسفل الورقة الثانية مع مسافة نظيفة عن النهاية */}
                                        <div style={{ marginTop: 'auto' }}>
                                            {renderSummarySection()}
                                            {renderSignatures()}

                                            <div style={{ marginTop: '16px', paddingTop: '8px', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>
                                                <span>نهاية التقرير المعتمد</span>
                                                <span>صفحة 2 من 2</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};
export default LeaveBalanceComponent;
