import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { ref, set } from 'firebase/database';
import { onCachedValue } from '../firebaseCache';
import { User, AttendanceRecord, LeaveRecord } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
    X, Download, Calendar, Clock, UserCheck, AlertTriangle,
    ShieldAlert, CheckCircle2, Search, Filter, Printer,
    FileText, ChevronRight, ChevronDown, Building2, User as UserIcon,
    RefreshCw, Loader2, Sparkles, Award, Coffee, AlertCircle,
    Eye, Users, Trash2
} from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    user: User;
    usersList: User[];
    markets: string[];
}

export const AttendanceRecordsModal: React.FC<Props> = ({
    isOpen,
    onClose,
    user,
    usersList,
    markets
}) => {
    // Firebase raw data
    const [allAttendance, setAllAttendance] = useState<Record<string, Record<string, AttendanceRecord>>>({});
    const [allLeaves, setAllLeaves] = useState<LeaveRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Generate Work Periods (من 21 من كل شهر حتى 20 من الشهر التالي)
    const workPeriods = useMemo(() => {
        const list: { id: string; startDate: string; endDate: string; label: string }[] = [];
        const now = new Date();
        // Generate from current cycle up to past 14 cycles
        for (let i = -1; i < 14; i++) {
            const dStart = new Date(now.getFullYear(), now.getMonth() - i - 1, 21);
            const dEnd = new Date(now.getFullYear(), now.getMonth() - i, 20);

            const startStr = `${dStart.getFullYear()}-${String(dStart.getMonth() + 1).padStart(2, '0')}-21`;
            const endStr = `${dEnd.getFullYear()}-${String(dEnd.getMonth() + 1).padStart(2, '0')}-20`;

            const startMonthName = dStart.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });
            const endMonthName = dEnd.toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' });

            list.push({
                id: `${startStr}_${endStr}`,
                startDate: startStr,
                endDate: endStr,
                label: `من 21 ${dStart.toLocaleDateString('ar-EG', { month: 'long' })} إلى 20 ${endMonthName}`
            });
        }
        return list;
    }, []);

    // Active selected work period (default: first matching current date or first in list)
    const [selectedPeriodId, setSelectedPeriodId] = useState<string>(() => {
        const today = new Date().toISOString().split('T')[0];
        const currentPeriod = workPeriods.find((p) => today >= p.startDate && today <= p.endDate);
        return currentPeriod ? currentPeriod.id : (workPeriods[1]?.id || workPeriods[0]?.id || '');
    });

    const activePeriod = useMemo(() => {
        return workPeriods.find((p) => p.id === selectedPeriodId) || workPeriods[0];
    }, [workPeriods, selectedPeriodId]);

    // Filters
    const [selectedEmployee, setSelectedEmployee] = useState<string>(() => {
        return user.role === 'admin' ? 'all' : (user.key || user.username);
    });
    const [selectedBranch, setSelectedBranch] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState<string>('');
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [viewMode, setViewMode] = useState<'dayByDay' | 'allSummary'>('dayByDay');

    // Specified Dates Range (التواريخ المحددة: من تاريخ - إلى تاريخ)
    const [filterStartDate, setFilterStartDate] = useState<string>('');
    const [filterEndDate, setFilterEndDate] = useState<string>('');

    // Sync filter dates when activePeriod changes
    useEffect(() => {
        if (activePeriod) {
            setFilterStartDate(activePeriod.startDate);
            const today = new Date().toISOString().split('T')[0];
            const end = activePeriod.endDate > today ? today : activePeriod.endDate;
            setFilterEndDate(end);
        }
    }, [activePeriod]);

    // Quick presets helper for date ranges
    const handleSetPresetDates = (preset: 'cycle' | 'today' | 'week' | 'month') => {
        const today = new Date().toISOString().split('T')[0];
        if (preset === 'cycle' && activePeriod) {
            setFilterStartDate(activePeriod.startDate);
            const end = activePeriod.endDate > today ? today : activePeriod.endDate;
            setFilterEndDate(end);
        } else if (preset === 'today') {
            setFilterStartDate(today);
            setFilterEndDate(today);
        } else if (preset === 'week') {
            const d = new Date();
            d.setDate(d.getDate() - 6);
            setFilterStartDate(d.toISOString().split('T')[0]);
            setFilterEndDate(today);
        } else if (preset === 'month') {
            const d = new Date();
            const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
            setFilterStartDate(start);
            setFilterEndDate(today);
        }
    };

    // Employee specific detail popup modal (نافذة منبثقة لبيانات الموظف المختار)
    const [showEmployeeDetailModal, setShowEmployeeDetailModal] = useState(false);
    const [modalTargetEmployee, setModalTargetEmployee] = useState<User | null>(null);

    // Print container reference
    const printContainerRef = useRef<HTMLDivElement>(null);
    const employeePrintContainerRef = useRef<HTMLDivElement>(null);

    // Reset Attendance States & Handlers
    const [isResettingAttendance, setIsResettingAttendance] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);

    const handleResetAllAttendance = async () => {
        setIsResettingAttendance(true);
        try {
            await set(ref(db, 'attendance'), null);
            setAllAttendance({});
            setShowResetConfirm(false);
            setResetSuccessMsg('تم بنجاح تصفير سجلات الحضور والانصراف لجميع الموظفين!');
            setTimeout(() => setResetSuccessMsg(null), 5000);
        } catch (error: any) {
            console.error('Error resetting attendance:', error);
            setResetSuccessMsg('حدث خطأ أثناء تصفير الحضور والانصراف: ' + (error?.message || ''));
        } finally {
            setIsResettingAttendance(false);
        }
    };

    // Fetch Attendance and Leaves from Firebase
    useEffect(() => {
        if (!isOpen) return;
        setIsLoading(true);

        const attendanceRef = ref(db, 'attendance');
        const unsubAttendance = onCachedValue(attendanceRef, 'attendance_all_history', (snapshot) => {
            if (snapshot.exists()) {
                setAllAttendance(snapshot.val() || {});
            } else {
                setAllAttendance({});
            }
            setIsLoading(false);
        });

        const leavesRef = ref(db, 'leave_history');
        const unsubLeaves = onCachedValue(leavesRef, 'leave_history', (snapshot) => {
            if (snapshot.exists()) {
                const list: LeaveRecord[] = [];
                snapshot.forEach((child: any) => {
                    list.push({ id: child.key, ...child.val() });
                });
                setAllLeaves(list);
            } else {
                setAllLeaves([]);
            }
        });

        // Listen to attendance system start state
        const startedRef = ref(db, 'attendance_settings/is_started');
        const unsubStarted = onCachedValue(startedRef, 'attendance_settings_is_started', (snapshot) => {
            if (snapshot.exists()) {
                const val = snapshot.val();
                setIsAttendanceStarted(val?.started === true || val === true);
            } else {
                setIsAttendanceStarted(false);
            }
        });

        return () => {
            unsubAttendance();
            unsubLeaves();
            unsubStarted();
        };
    }, [isOpen]);

    const [isAttendanceStarted, setIsAttendanceStarted] = useState(false);

    // هل تم تسجيل أي حضور فعلي في النظام حتى الآن لأي موظف في أي فرع
    const hasAnyRecordedAttendance = useMemo(() => {
        return Object.values(allAttendance).some((dayMap) => {
            if (!dayMap || typeof dayMap !== 'object') return false;
            return Object.values(dayMap).some((r: any) => !!r?.checkInTime);
        });
    }, [allAttendance]);

    // Available dates belonging to the selected work cycle (من 21 إلى 20)
    const filteredDates = useMemo(() => {
        if (!activePeriod) return [];
        // إذا لم يبدأ التسجيل أو لم يتم تسجيل أي حضور فعلي، تكون القائمة فارغة تماماً
        if (!isAttendanceStarted || !hasAnyRecordedAttendance) {
            return [];
        }

        const dateSet = new Set<string>();

        Object.keys(allAttendance).forEach((d) => {
            if (d && d.match(/^\d{4}-\d{2}-\d{2}$/) && d >= activePeriod.startDate && d <= activePeriod.endDate) {
                const dayMap = allAttendance[d];
                const hasActivity = dayMap && typeof dayMap === 'object' && Object.values(dayMap).some((r: any) => !!r?.checkInTime || !!r?.checkOutTime);
                if (hasActivity) {
                    dateSet.add(d);
                }
            }
        });

        allLeaves.forEach((l) => {
            if (l.date && l.date.match(/^\d{4}-\d{2}-\d{2}$/) && l.date >= activePeriod.startDate && l.date <= activePeriod.endDate) {
                dateSet.add(l.date);
            }
        });

        const sorted = Array.from(dateSet).sort().reverse();
        return sorted;
    }, [allAttendance, allLeaves, activePeriod, isAttendanceStarted, hasAnyRecordedAttendance]);

    // Auto-select latest date if none is selected
    useEffect(() => {
        if (filteredDates.length > 0 && (!selectedDate || !filteredDates.includes(selectedDate))) {
            setSelectedDate(filteredDates[0]);
        } else if (filteredDates.length === 0) {
            setSelectedDate('');
        }
    }, [filteredDates, selectedDate]);

    // Format Arabic Day Name & Date
    const formatArabicDate = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const [y, m, d] = dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            return dateObj.toLocaleDateString('ar-EG', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

    const getShortDayName = (dateStr: string) => {
        if (!dateStr) return '';
        try {
            const [y, m, d] = dateStr.split('-').map(Number);
            const dateObj = new Date(y, m - 1, d);
            return dateObj.toLocaleDateString('ar-EG', { weekday: 'long' });
        } catch {
            return '';
        }
    };

    // Determine current effective employee filter
    const effectiveEmployeeFilter = user.role === 'admin' ? selectedEmployee : (user.key || user.username);

    // Build consolidated list of records for a specific date
    const getRecordsForDate = (dateStr: string, specificEmpKey?: string) => {
        if (!dateStr) return [];
        const dayAttendance = allAttendance[dateStr] || {};
        const dayLeaves = allLeaves.filter((l) => l.date === dateStr);

        const hasActualAttendance = Object.values(dayAttendance).some((r: any) => !!r?.checkInTime || !!r?.checkOutTime);
        if (!hasActualAttendance && dayLeaves.length === 0) {
            return [];
        }

        const recordsMap: Record<string, {
            userId: string;
            username: string;
            employeeName: string;
            branchName: string;
            date: string;
            checkInTime: string | null;
            checkOutTime: string | null;
            status: string;
            isLate: boolean;
            penaltyAmount: number;
            penaltyNote: string;
            leaveType?: string;
            leaveLabel?: string;
            leaveNotes?: string;
            autoAbsent?: boolean;
            note?: string;
        }> = {};

        // 1. Process attendance records
        Object.entries(dayAttendance).forEach(([key, rec]) => {
            const empUser = usersList.find((u) => u.key === key || u.username === rec.username || u.username === key);
            const userId = rec.userId || empUser?.key || key;
            const username = rec.username || empUser?.username || key;
            const employeeName = rec.employeeName || empUser?.name || username;
            const branchName = rec.branchName || (empUser?.assignedMarkets && empUser.assignedMarkets[0]) || 'الفرع الرئيسي';

            recordsMap[key] = {
                userId,
                username,
                employeeName,
                branchName,
                date: dateStr,
                checkInTime: rec.checkInTime || null,
                checkOutTime: rec.checkOutTime || null,
                status: rec.status || (rec.checkInTime ? 'present' : 'absent'),
                isLate: !!rec.isLate,
                penaltyAmount: rec.penaltyAmount || (rec.isLate ? 0.25 : 0),
                penaltyNote: rec.delayPenalty || (rec.isLate ? 'خصم ربع يوم (تأخير)' : ''),
                autoAbsent: !!rec.autoAbsent,
                note: rec.note || ''
            };
        });

        // 2. Overlay leaves for this date
        dayLeaves.forEach((leave) => {
            const targetKey = leave.userId;
            const empUser = usersList.find((u) => u.key === targetKey || u.username === targetKey);
            const key = targetKey || empUser?.key || empUser?.username || 'unknown';

            const typeLabelMap: Record<string, string> = {
                annual: 'إجازة سنوية',
                casual: 'إجازة عارضة',
                sick: 'إجازة مرضية',
                exams: 'إجازة امتحانات',
                unpaid: 'إجازة بدون مرتب (غياب)',
                official: 'إجازة رسمية',
                custom: leave.customLabel || 'إجازة خاصة',
                penalty: 'جزاء إداري'
            };

            const leaveLabel = typeLabelMap[leave.type] || leave.customLabel || 'إجازة مسجلة';

            if (recordsMap[key]) {
                recordsMap[key].leaveType = leave.type;
                recordsMap[key].leaveLabel = leaveLabel;
                recordsMap[key].leaveNotes = leave.notes || '';
                if (leave.type === 'official' || leave.type === 'annual' || leave.type === 'casual' || leave.type === 'sick') {
                    recordsMap[key].status = 'leave';
                }
            } else {
                recordsMap[key] = {
                    userId: targetKey,
                    username: empUser?.username || targetKey,
                    employeeName: leave.employeeName || empUser?.name || targetKey,
                    branchName: (empUser?.assignedMarkets && empUser.assignedMarkets[0]) || 'الفرع الرئيسي',
                    date: dateStr,
                    checkInTime: null,
                    checkOutTime: null,
                    status: 'leave',
                    isLate: false,
                    penaltyAmount: 0,
                    penaltyNote: '',
                    leaveType: leave.type,
                    leaveLabel: leaveLabel,
                    leaveNotes: leave.notes || ''
                };
            }
        });

        // 3. If selectedBranch is 'all', show all active non-admin employees who have not registered as absent
        if (selectedBranch === 'all' && hasActualAttendance) {
            usersList
                .filter((u) => u.role !== 'admin' && !u.isArchived)
                .forEach((u) => {
                    const key = u.key || u.username;
                    const alreadyInMap = recordsMap[key] || recordsMap[u.username];
                    if (!alreadyInMap) {
                        recordsMap[key] = {
                            userId: key,
                            username: u.username,
                            employeeName: u.name || u.username,
                            branchName: (u.assignedMarkets && u.assignedMarkets[0]) || 'الفرع الرئيسي',
                            date: dateStr,
                            checkInTime: null,
                            checkOutTime: null,
                            status: 'absent',
                            isLate: false,
                            penaltyAmount: 0,
                            penaltyNote: '',
                            autoAbsent: false,
                            note: 'لم يسجل حضور'
                        };
                    }
                });
        }

        let list = Object.values(recordsMap);

        const filterEmp = specificEmpKey !== undefined ? specificEmpKey : effectiveEmployeeFilter;
        if (filterEmp !== 'all') {
            list = list.filter((r) =>
                r.userId === filterEmp ||
                r.username === filterEmp
            );
        }

        if (selectedBranch !== 'all') {
            // يظهر فقط الحضور والانصراف للموظفين الذين سجلوا في هذا الفرع
            list = list.filter((r) => r.branchName === selectedBranch && (r.checkInTime || r.checkOutTime));
        }

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter((r) =>
                r.employeeName.toLowerCase().includes(q) ||
                r.username.toLowerCase().includes(q) ||
                r.branchName.toLowerCase().includes(q)
            );
        }

        return list;
    };

    // الفروع التي تم تسجيل حضور وانصراف بها فقط
    const branchesWithAttendance = useMemo(() => {
        const branchSet = new Set<string>();
        Object.values(allAttendance).forEach((dayMap) => {
            if (!dayMap || typeof dayMap !== 'object') return;
            Object.values(dayMap).forEach((r: any) => {
                if (r && r.branchName && (r.checkInTime || r.checkOutTime || r.status === 'on_time' || r.status === 'late' || r.status === 'present')) {
                    const b = String(r.branchName).trim();
                    if (b) branchSet.add(b);
                }
            });
        });
        return Array.from(branchSet).sort();
    }, [allAttendance]);

    // كم مرة زار الموظف هذا الفرع المحدد
    const employeeBranchVisitsCount = useMemo(() => {
        if (selectedBranch === 'all') return null;
        const target = effectiveEmployeeFilter !== 'all' ? effectiveEmployeeFilter : (searchQuery.trim() || null);
        if (!target) return null;

        let count = 0;
        Object.values(allAttendance).forEach((dayMap) => {
            if (!dayMap || typeof dayMap !== 'object') return;
            Object.values(dayMap).forEach((r: any) => {
                if (r && r.branchName === selectedBranch && (r.checkInTime || r.checkOutTime || r.status === 'on_time' || r.status === 'late' || r.status === 'present')) {
                    const matchesUser = r.userId === target || 
                                        r.username === target || 
                                        (r.employeeName && r.employeeName.toLowerCase().includes(target.toLowerCase()));
                    if (matchesUser) {
                        count++;
                    }
                }
            });
        });
        return count;
    }, [selectedBranch, effectiveEmployeeFilter, searchQuery, allAttendance]);

    // اسم الموظف المستهدف للعرض في الإحصائيات وبطاقة الزيارات
    const targetEmployeeDisplayName = useMemo(() => {
        if (effectiveEmployeeFilter !== 'all') {
            const u = usersList.find((x) => x.key === effectiveEmployeeFilter || x.username === effectiveEmployeeFilter);
            return u?.name || u?.username || effectiveEmployeeFilter;
        }
        if (searchQuery.trim()) {
            return searchQuery.trim();
        }
        return null;
    }, [effectiveEmployeeFilter, usersList, searchQuery]);

    // آخر يوم تم تسجيل به حضور وانصراف لجميع العاملين
    const latestAttendanceDate = useMemo(() => {
        const datesWithActivity: string[] = [];
        Object.entries(allAttendance).forEach(([d, dayMap]) => {
            if (!d || !d.match(/^\d{4}-\d{2}-\d{2}$/)) return;
            if (dayMap && typeof dayMap === 'object') {
                const hasActivity = Object.values(dayMap).some((r: any) => !!r?.checkInTime || !!r?.checkOutTime);
                if (hasActivity) {
                    datesWithActivity.push(d);
                }
            }
        });
        if (datesWithActivity.length > 0) {
            datesWithActivity.sort();
            return datesWithActivity[datesWithActivity.length - 1];
        }
        return '';
    }, [allAttendance]);

    // السجلات المسجلة لآخر يوم تم تسجيل به حضور وانصراف
    const latestDayRecords = useMemo(() => {
        if (!latestAttendanceDate) return [];
        return getRecordsForDate(latestAttendanceDate);
    }, [latestAttendanceDate, getRecordsForDate]);

    // Calculate overall summaries for the active period
    const statsSummary = useMemo(() => {
        let totalDaysWorked = 0;
        let totalPresent = 0;
        let totalOnTime = 0;
        let totalLate = 0;
        let totalAbsent = 0;
        let totalLeaves = 0;
        let totalDeductionDays = 0;

        filteredDates.forEach((d) => {
            const records = getRecordsForDate(d);
            records.forEach((r) => {
                if (r.checkInTime) {
                    totalPresent++;
                    if (r.isLate) {
                        totalLate++;
                        totalDeductionDays += (r.penaltyAmount || 0.25);
                    } else {
                        totalOnTime++;
                    }
                } else if (r.leaveType) {
                    totalLeaves++;
                } else if (r.status === 'absent' || r.autoAbsent) {
                    totalAbsent++;
                }
            });
        });

        totalDaysWorked = filteredDates.length;

        return {
            totalDays: totalDaysWorked,
            totalPresent,
            totalOnTime,
            totalLate,
            totalAbsent,
            totalLeaves,
            totalDeductionDays: Number(totalDeductionDays.toFixed(2))
        };
    }, [filteredDates, allAttendance, allLeaves, effectiveEmployeeFilter, selectedBranch, searchQuery]);

    // Active records for currently selected date
    const currentDayRecords = useMemo(() => {
        if (!selectedDate) return [];
        return getRecordsForDate(selectedDate);
    }, [selectedDate, allAttendance, allLeaves, effectiveEmployeeFilter, selectedBranch, searchQuery]);

    // Complete dates for the active period or specified dates (from start date up to end date)
    const periodAllDates = useMemo(() => {
        const start = filterStartDate || activePeriod?.startDate || '';
        const end = filterEndDate || activePeriod?.endDate || '';
        if (!start || !end) return [];

        const s = start <= end ? start : end;
        const e = start <= end ? end : start;

        const dates: string[] = [];
        const [sy, sm, sd] = s.split('-').map(Number);
        const [ey, em, ed] = e.split('-').map(Number);
        if (isNaN(sy) || isNaN(sm) || isNaN(sd) || isNaN(ey) || isNaN(em) || isNaN(ed)) return [];

        const curr = new Date(sy, sm - 1, sd);
        const last = new Date(ey, em - 1, ed);

        while (curr <= last) {
            const y = curr.getFullYear();
            const m = String(curr.getMonth() + 1).padStart(2, '0');
            const d = String(curr.getDate()).padStart(2, '0');
            dates.push(`${y}-${m}-${d}`);
            curr.setDate(curr.getDate() + 1);
        }

        return dates.sort().reverse();
    }, [filterStartDate, filterEndDate, activePeriod]);

    // All records across the filtered period for Cumulative view / Export
    const allPeriodRecords = useMemo(() => {
        const list: (ReturnType<typeof getRecordsForDate>[0] & { dayIndex: number })[] = [];
        filteredDates.forEach((d, idx) => {
            const dayRecs = getRecordsForDate(d);
            dayRecs.forEach((r) => {
                list.push({ ...r, dayIndex: idx + 1 });
            });
        });
        return list;
    }, [filteredDates, allAttendance, allLeaves, effectiveEmployeeFilter, selectedBranch, searchQuery]);

    // Specific selected employee records (or all employees) for the detail popup modal
    const employeeModalRecords = useMemo(() => {
        // إذا لم يبدأ التسجيل أو لم يقم أي موظف بتسجيل الحضور في أي فرع حتى الآن -> تكون السجلات فارغة تماماً
        if (!isAttendanceStarted || !hasAnyRecordedAttendance) {
            return [];
        }

        const list: {
            dayIndex: number;
            date: string;
            dayName: string;
            userId: string;
            username: string;
            employeeName: string;
            branchName: string;
            checkInTime: string | null;
            checkOutTime: string | null;
            status: 'on_time' | 'late' | 'absent' | 'leave' | 'weekly_off' | 'future';
            statusLabel: string;
            isLate: boolean;
            isAbsent: boolean;
            penaltyAmount: number;
            penaltyNote: string;
            leaveLabel?: string;
            leaveNotes?: string;
            note?: string;
        }[] = [];

        const nonAdminList = usersList.filter(u => u.role !== 'admin' && !u.isArchived);
        const targetUsers = modalTargetEmployee 
            ? [modalTargetEmployee] 
            : (selectedEmployee !== 'all'
                ? usersList.filter(u => u.key === selectedEmployee || u.username === selectedEmployee)
                : nonAdminList);

        let counter = 1;

        // فقط التواريخ التي تم فيها تسجيل حضور فعلي في النظام أو إجازة معتمدة
        const recordedDates = periodAllDates.filter(d => {
            const dayAttendance = allAttendance[d];
            const hasCheckIn = dayAttendance && typeof dayAttendance === 'object' && Object.values(dayAttendance).some((r: any) => !!r?.checkInTime);
            const hasLeave = allLeaves.some(l => l.date === d);
            return hasCheckIn || hasLeave;
        });

        recordedDates.forEach((d) => {
            const dayAttendance = allAttendance[d] || {};
            const dayLeaves = allLeaves.filter(l => l.date === d);
            const [y, m, dayNum] = d.split('-').map(Number);
            const dateObj = new Date(y, m - 1, dayNum);
            const dayName = dateObj.toLocaleDateString('ar-EG', { weekday: 'long' });

            targetUsers.forEach((targetUser) => {
                const empKey = targetUser.key || targetUser.username;
                const empUsername = targetUser.username || '';
                const empName = targetUser.name || empUsername;
                const defaultBranch = targetUser.assignedMarkets?.[0] || 'الفرع الرئيسي';

                // Check attendance - robust key and field lookup
                const attRec = Object.entries(dayAttendance).map(([k, v]: [string, any]) => ({ key: k, ...v })).find((r) => 
                    r.key === empKey || 
                    r.key === empUsername || 
                    r.userId === empKey || 
                    r.userId === empUsername || 
                    r.username === empUsername || 
                    r.username === empKey || 
                    (r.employeeName && r.employeeName.trim().toLowerCase() === empName.trim().toLowerCase())
                );

                // Check leaves
                const leaveRec = dayLeaves.find((l) => 
                    l.userId === empKey || 
                    l.userId === empUsername || 
                    (l.employeeName && l.employeeName.trim().toLowerCase() === empName.trim().toLowerCase())
                );

                if (attRec && attRec.checkInTime) {
                    const isLate = !!attRec.isLate;
                    list.push({
                        dayIndex: counter++,
                        date: d,
                        dayName,
                        userId: empKey,
                        username: empUsername,
                        employeeName: empName,
                        branchName: attRec.branchName || defaultBranch,
                        checkInTime: attRec.checkInTime,
                        checkOutTime: attRec.checkOutTime || null,
                        status: isLate ? 'late' : 'on_time',
                        statusLabel: isLate ? 'متأخر' : 'منضبط',
                        isLate,
                        isAbsent: false,
                        penaltyAmount: attRec.penaltyAmount || (isLate ? 0.25 : 0),
                        penaltyNote: attRec.delayPenalty || attRec.note || (isLate ? 'خصم ربع يوم (تأخير)' : 'لا يوجد تأخير'),
                        note: attRec.note || ''
                    });
                } else if (leaveRec) {
                    const typeLabelMap: Record<string, string> = {
                        annual: 'إجازة سنوية',
                        casual: 'إجازة عارضة',
                        sick: 'إجازة مرضية',
                        exams: 'إجازة امتحانات',
                        unpaid: 'إجازة بدون مرتب',
                        official: 'إجازة رسمية',
                        custom: leaveRec.customLabel || 'إجازة خاصة',
                        penalty: 'جزاء إداري'
                    };
                    const label = typeLabelMap[leaveRec.type] || leaveRec.customLabel || 'إجازة مسجلة';
                    list.push({
                        dayIndex: counter++,
                        date: d,
                        dayName,
                        userId: empKey,
                        username: empUsername,
                        employeeName: empName,
                        branchName: defaultBranch,
                        checkInTime: null,
                        checkOutTime: null,
                        status: 'leave',
                        statusLabel: label,
                        isLate: false,
                        isAbsent: false,
                        penaltyAmount: 0,
                        penaltyNote: '',
                        leaveLabel: label,
                        leaveNotes: leaveRec.notes || ''
                    });
                } else if (attRec && attRec.status === 'absent') {
                    // غياب مسجل فعلياً في ذلك اليوم
                    list.push({
                        dayIndex: counter++,
                        date: d,
                        dayName,
                        userId: empKey,
                        username: empUsername,
                        employeeName: empName,
                        branchName: defaultBranch,
                        checkInTime: null,
                        checkOutTime: null,
                        status: 'absent',
                        statusLabel: 'غياب',
                        isLate: false,
                        isAbsent: true,
                        penaltyAmount: attRec.penaltyAmount || 1,
                        penaltyNote: attRec.penaltyNote || 'يوم غياب كامل',
                        note: attRec.note || 'لم يسجل حضور'
                    });
                }
            });
        });

        let result = list;
        if (selectedBranch !== 'all') {
            result = result.filter(r => r.branchName === selectedBranch);
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            result = result.filter(r => 
                r.employeeName.toLowerCase().includes(q) || 
                r.branchName.toLowerCase().includes(q)
            );
        }

        return result;
    }, [isAttendanceStarted, hasAnyRecordedAttendance, modalTargetEmployee, selectedEmployee, usersList, periodAllDates, allAttendance, allLeaves, selectedBranch, searchQuery]);

    // Specific employee statistics summary for popup
    const employeeModalStats = useMemo(() => {
        let presentCount = 0;
        let onTimeCount = 0;
        let lateCount = 0;
        let absentCount = 0;
        let leaveCount = 0;
        let penaltyDays = 0;

        employeeModalRecords.forEach((r) => {
            if (r.checkInTime) {
                presentCount++;
                if (r.isLate) {
                    lateCount++;
                    penaltyDays += (r.penaltyAmount || 0.25);
                } else {
                    onTimeCount++;
                }
            } else if (r.status === 'leave') {
                leaveCount++;
            } else if (r.status === 'absent') {
                absentCount++;
                penaltyDays += (r.penaltyAmount || 1);
            }
        });

        return {
            totalWorkDays: employeeModalRecords.filter(r => r.status !== 'future' && r.status !== 'weekly_off').length,
            presentCount,
            onTimeCount,
            lateCount,
            absentCount,
            leaveCount,
            penaltyDays: Number(penaltyDays.toFixed(2))
        };
    }, [employeeModalRecords]);

    // Handle "بحث" Button Click:
    // Opens the detailed popup modal with attendance, departure, delays, and absences
    const handleSearchClick = () => {
        let emp: User | undefined;
        if (user.role !== 'admin') {
            emp = usersList.find((u) => u.key === user.key || u.username === user.username) || user;
        } else if (selectedEmployee !== 'all') {
            emp = usersList.find((u) => u.key === selectedEmployee || u.username === selectedEmployee);
        } else if (searchQuery.trim()) {
            emp = usersList.find((u) => 
                (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase()))
            );
        } else {
            // Default to first non-admin employee
            emp = usersList.find((u) => u.role !== 'admin' && !u.isArchived);
        }

        setModalTargetEmployee(emp || null);
        setShowEmployeeDetailModal(true);
    };

    // Handle PDF Export
    const handleDownloadPDF = async (forSpecificEmployee = false) => {
        const targetContainer = forSpecificEmployee ? employeePrintContainerRef.current : printContainerRef.current;
        if (!targetContainer) return;
        setIsExportingPDF(true);

        try {
            targetContainer.style.display = 'block';
            await new Promise((res) => setTimeout(res, 200));

            const canvas = await html2canvas(targetContainer, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                windowWidth: 1200
            });

            targetContainer.style.display = 'none';

            const imgData = canvas.toDataURL('image/jpeg', 0.98);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            const pageHeight = pdf.internal.pageSize.getHeight();
            let position = 0;

            if (pdfHeight > pageHeight) {
                let heightLeft = pdfHeight;
                while (heightLeft > 0) {
                    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
                    heightLeft -= pageHeight;
                    position -= pageHeight;
                    if (heightLeft > 0) {
                        pdf.addPage();
                    }
                }
            } else {
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }

            const empNameForFile = forSpecificEmployee && modalTargetEmployee
                ? (modalTargetEmployee.name || modalTargetEmployee.username)
                : effectiveEmployeeFilter !== 'all'
                ? (usersList.find((u) => u.key === effectiveEmployeeFilter || u.username === effectiveEmployeeFilter)?.name || effectiveEmployeeFilter)
                : 'جميع_الموظفين';

            const cleanFileName = `تقرير_الحضور_والانصراف_${empNameForFile.replace(/\s+/g, '_')}_${activePeriod?.startDate}_${activePeriod?.endDate}.pdf`;
            pdf.save(cleanFileName);
        } catch (error) {
            console.error('Error generating PDF:', error);
            alert('حدث خطأ أثناء إنشاء ملف PDF، يرجى المحاولة مرة أخرى.');
        } finally {
            if (targetContainer) {
                targetContainer.style.display = 'none';
            }
            setIsExportingPDF(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
            <div className="bg-gray-900 border border-white/15 w-full max-w-6xl rounded-3xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden my-auto animate-in zoom-in-95 duration-200">
                
                {/* Modal Header */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-gray-900 via-gray-850 to-gray-900 border-b border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                            <FileText size={22} />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-lg sm:text-xl font-black text-white">سجل وتقارير الحضور والانصراف</h2>
                                <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2.5 py-0.5 rounded-full border border-blue-500/30 font-bold">
                                    {user.role === 'admin' ? 'صلاحيات المدير العام' : 'سجل الموظف الشخصي'}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-0.5">
                                متابعة دورات العمل من 21 حتى 20، وسجلات الحضور والغياب والتأخيرات المخصومة
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-auto w-full md:w-auto justify-end flex-wrap">
                        {/* Reset Attendance Button for Admin */}
                        {user.role === 'admin' && (
                            !showResetConfirm ? (
                                <button
                                    type="button"
                                    onClick={() => setShowResetConfirm(true)}
                                    className="flex items-center gap-1.5 px-3 py-2 sm:py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs sm:text-sm font-bold transition active:scale-95 cursor-pointer whitespace-nowrap"
                                    title="تصفير الحضور والانصراف لجميع الموظفين"
                                >
                                    <Trash2 size={16} />
                                    <span>تصفير الحضور والانصراف</span>
                                </button>
                            ) : (
                                <div className="flex items-center gap-1.5 animate-in fade-in">
                                    <button
                                        type="button"
                                        onClick={handleResetAllAttendance}
                                        disabled={isResettingAttendance}
                                        className="flex items-center gap-1 px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black transition active:scale-95 cursor-pointer shadow-lg shadow-rose-600/30 whitespace-nowrap"
                                    >
                                        {isResettingAttendance ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                        <span>تأكيد التصفير للجميع</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setShowResetConfirm(false)}
                                        disabled={isResettingAttendance}
                                        className="px-2.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition cursor-pointer"
                                    >
                                        إلغاء
                                    </button>
                                </div>
                            )
                        )}

                        {/* Download PDF Button */}
                        <button
                            onClick={() => handleDownloadPDF(false)}
                            disabled={isExportingPDF || isLoading}
                            className="flex-1 md:flex-initial flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm shadow-lg shadow-emerald-600/25 transition active:scale-95 disabled:opacity-50 cursor-pointer"
                        >
                            {isExportingPDF ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>جاري تجهيز PDF...</span>
                                </>
                            ) : (
                                <>
                                    <Download size={16} />
                                    <span>تحميل PDF</span>
                                </>
                            )}
                        </button>

                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/5 transition"
                            title="إغلاق"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Reset Success Notification Banner */}
                {resetSuccessMsg && (
                    <div className="mx-3 sm:mx-4 mt-3 p-3 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm font-bold flex items-center justify-between gap-2 animate-in fade-in">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 size={18} />
                            <span>{resetSuccessMsg}</span>
                        </div>
                        <button onClick={() => setResetSuccessMsg(null)} className="text-emerald-400 hover:text-white">
                            <X size={16} />
                        </button>
                    </div>
                )}

                {/* Filter and View Controls Bar */}
                <div className="p-3 sm:p-4 bg-gray-950/70 border-b border-white/5 space-y-2 sm:space-y-3">
                    {user.role === 'admin' ? (
                        <>
                            {/* سطر واحد: دورة الشهر + الموظف + الفروع مع مراعاة عدم وجود مسطرة تحريك */}
                            <div className="grid grid-cols-3 gap-1 sm:gap-3 text-xs">
                                {/* Period Picker: من يوم 21 حتى 20 الشهر التالي */}
                                <div className="min-w-0">
                                    <label className="block text-gray-300 font-bold mb-1 flex items-center gap-1 text-[9px] sm:text-xs truncate">
                                        <Calendar size={12} className="text-blue-400 shrink-0 hidden sm:inline" />
                                        <span className="truncate">دورة الشهر</span>
                                    </label>
                                    <select
                                        value={selectedPeriodId}
                                        onChange={(e) => setSelectedPeriodId(e.target.value)}
                                        className="w-full bg-gray-800 text-white px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none font-bold text-[10px] sm:text-xs truncate"
                                    >
                                        {workPeriods.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                📅 {p.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Employee Filter - Dropdown */}
                                <div className="min-w-0">
                                    <label className="block text-gray-300 font-bold mb-1 flex items-center gap-1 text-[9px] sm:text-xs truncate">
                                        <Users size={12} className="text-emerald-400 shrink-0 hidden sm:inline" />
                                        <span className="truncate">الموظف</span>
                                    </label>
                                    <select
                                        value={selectedEmployee}
                                        onChange={(e) => setSelectedEmployee(e.target.value)}
                                        className="w-full bg-gray-800 text-white px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none text-[10px] sm:text-xs truncate font-bold"
                                    >
                                        <option value="all">👥 جميع الموظفين</option>
                                        {usersList
                                            .filter((u) => u.role !== 'admin' && !u.isArchived)
                                            .map((u) => (
                                                <option key={u.key || u.username} value={u.key || u.username}>
                                                    {u.name || u.username}
                                                </option>
                                            ))}
                                    </select>
                                </div>

                                {/* Branch Filter - Admin Only */}
                                <div className="min-w-0">
                                    <label className="block text-gray-300 font-bold mb-1 flex items-center gap-1 text-[9px] sm:text-xs truncate">
                                        <Building2 size={12} className="text-purple-400 shrink-0 hidden sm:inline" />
                                        <span className="truncate">الفروع</span>
                                    </label>
                                    <select
                                        value={selectedBranch}
                                        onChange={(e) => setSelectedBranch(e.target.value)}
                                        className="w-full bg-gray-800 text-white px-1.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none text-[10px] sm:text-xs truncate font-bold"
                                    >
                                        <option value="all">
                                            🏢 جميع الفروع {branchesWithAttendance.length > 0 ? `(${branchesWithAttendance.length})` : '(لا توجد فروع مسجلة بعد)'}
                                        </option>
                                        {branchesWithAttendance.map((m) => (
                                            <option key={m} value={m}>
                                                🏢 {m}
                                            </option>
                                        ))}
                                        {selectedBranch !== 'all' && !branchesWithAttendance.includes(selectedBranch) && (
                                            <option value={selectedBranch}>🏢 {selectedBranch}</option>
                                        )}
                                    </select>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                                <label className="block text-gray-300 font-bold mb-1 flex items-center gap-1 text-[9px] sm:text-xs">
                                    <Calendar size={12} className="text-blue-400" />
                                    <span>دورة الشهر:</span>
                                </label>
                                <select
                                    value={selectedPeriodId}
                                    onChange={(e) => setSelectedPeriodId(e.target.value)}
                                    className="w-full bg-gray-800 text-white px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-white/10 focus:border-blue-500 focus:outline-none font-bold text-[10px] sm:text-xs"
                                >
                                    {workPeriods.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            📅 {p.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-gray-300 font-bold mb-1 flex items-center gap-1 text-[9px] sm:text-xs">
                                    <UserIcon size={12} className="text-blue-400" />
                                    <span>الموظف الحالي:</span>
                                </label>
                                <div className="w-full bg-gray-800/80 text-blue-300 font-bold px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl border border-white/10 flex items-center gap-1 text-[10px] sm:text-xs truncate">
                                    <UserIcon size={13} className="shrink-0" />
                                    <span className="truncate">{user.name || user.username}</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* شريط اختيار التواريخ المحددة (من تاريخ - إلى تاريخ) */}
                    <div className="pt-2 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[11px] font-bold text-gray-300 flex items-center gap-1">
                                <Calendar size={13} className="text-blue-400" />
                                <span>التواريخ المحددة:</span>
                            </span>

                            <div className="flex items-center gap-1.5 bg-gray-800/90 px-2 py-1 rounded-xl border border-white/10">
                                <span className="text-[10px] text-gray-400">من:</span>
                                <input
                                    type="date"
                                    value={filterStartDate}
                                    onChange={(e) => setFilterStartDate(e.target.value)}
                                    className="bg-transparent text-white font-mono text-[11px] focus:outline-none"
                                />
                            </div>

                            <div className="flex items-center gap-1.5 bg-gray-800/90 px-2 py-1 rounded-xl border border-white/10">
                                <span className="text-[10px] text-gray-400">إلى:</span>
                                <input
                                    type="date"
                                    value={filterEndDate}
                                    onChange={(e) => setFilterEndDate(e.target.value)}
                                    className="bg-transparent text-white font-mono text-[11px] focus:outline-none"
                                />
                            </div>

                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => handleSetPresetDates('cycle')}
                                    className="px-2 py-1 text-[10px] rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition"
                                >
                                    دورة العمل
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSetPresetDates('today')}
                                    className="px-2 py-1 text-[10px] rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition"
                                >
                                    اليوم
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleSetPresetDates('week')}
                                    className="px-2 py-1 text-[10px] rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition"
                                >
                                    7 أيام
                                </button>
                            </div>
                        </div>

                        {/* زر البحث وأسفله لتشغيل الشاشة المنبثقة للبيانات */}
                        <button
                            type="button"
                            onClick={handleSearchClick}
                            className="w-full sm:w-auto px-6 py-2 sm:py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 active:scale-95 transition cursor-pointer"
                        >
                            <Search size={16} />
                            <span>{user.role === 'admin' ? 'بحث وتفاصيل الموظف' : 'عرض تفاصيل حضوري وغيابي'}</span>
                        </button>
                    </div>

                    <div className="text-[11px] text-gray-400 font-semibold pt-1">
                        <span className="text-blue-300 font-bold">
                            💡 عند الضغط على زر "بحث وتفاصيل الموظف" تظهر شاشة منبثقة بها جدول تفصيلي يوضح الحضور، الانصراف، التأخيرات، والغياب في التواريخ المحددة.
                        </span>
                    </div>
                </div>

                {/* Visits Count and Branch Filter Info Card */}
                {selectedBranch !== 'all' && (
                    <div className="px-3 sm:px-4 pt-3 bg-gray-950/40 border-b border-white/5 pb-3">
                        {targetEmployeeDisplayName && employeeBranchVisitsCount !== null ? (
                            <div className="bg-gradient-to-r from-purple-950/70 via-purple-900/40 to-gray-900 border border-purple-500/40 p-3 sm:p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-purple-200 animate-in fade-in">
                                <div className="flex items-center gap-3">
                                    <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-400/30 shrink-0">
                                        <Building2 size={20} />
                                    </div>
                                    <div>
                                        <h4 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 flex-wrap">
                                            <span>عدد مرات زيارة وحضور الموظف</span>
                                            <span className="text-purple-300 bg-purple-500/25 px-2 py-0.5 rounded-lg border border-purple-400/30 font-black">
                                                {targetEmployeeDisplayName}
                                            </span>
                                            <span>لفرع</span>
                                            <span className="text-white underline font-black">({selectedBranch})</span>:
                                        </h4>
                                        <p className="text-[11px] text-gray-400 mt-1">
                                            إجمالي عدد أيام الحضور والزيارات المسجلة للموظف في هذا الفرع.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-baseline gap-1.5 bg-purple-600/40 border border-purple-400/50 px-4 py-2 rounded-2xl shrink-0 self-end sm:self-auto shadow-lg shadow-purple-950/50">
                                    <span className="text-xl sm:text-2xl font-black text-white font-mono">
                                        {employeeBranchVisitsCount}
                                    </span>
                                    <span className="text-xs font-bold text-purple-200">
                                        {employeeBranchVisitsCount === 1 ? 'مرة واحدة' : employeeBranchVisitsCount === 2 ? 'مرتان' : 'مرات (زيارة)'}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="bg-blue-950/40 border border-blue-500/30 p-3 rounded-2xl flex items-center gap-2.5 text-blue-200 text-xs sm:text-sm font-bold animate-in fade-in">
                                <Building2 size={18} className="text-blue-400 shrink-0" />
                                <span>
                                    عرض الحضور والانصراف الكامل لجميع الموظفين الذين سجلوا في فرع <strong className="text-white underline font-black">({selectedBranch})</strong>
                                </span>
                            </div>
                        )}
                    </div>
                )}

                {/* Modal Body: عرض آخر يوم تم تسجيل به حضور وانصراف لجميع العاملين */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-5 flex flex-col">
                    {/* Header bar for latest attendance date */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-white/10">
                        <div className="flex items-center gap-2 flex-wrap">
                            <Calendar size={18} className="text-blue-400 shrink-0" />
                            <h3 className="font-black text-xs sm:text-sm md:text-base text-white">
                                السجل: آخر يوم تم تسجيل به حضور وانصراف لجميع العاملين
                            </h3>
                            {latestAttendanceDate ? (
                                <span className="text-xs bg-blue-600/25 border border-blue-400/40 px-2.5 py-0.5 rounded-full text-blue-300 font-bold">
                                    {formatArabicDate(latestAttendanceDate)} ({latestAttendanceDate})
                                </span>
                            ) : (
                                <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full border border-amber-500/30 font-bold">
                                    لم يتم تسجيل حضور حتى الآن
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                            {user.role === 'admin' && latestDayRecords.length > 0 && !showResetConfirm && (
                                <button
                                    type="button"
                                    onClick={() => setShowResetConfirm(true)}
                                    className="px-2.5 py-1 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                    title="تصفير الحضور والانصراف لجميع الموظفين"
                                >
                                    <Trash2 size={13} />
                                    <span>تصفير الحضور</span>
                                </button>
                            )}
                            <div className="text-xs text-gray-400 flex items-center gap-1.5">
                                <span>عدد السجلات:</span>
                                <span className="text-white font-black font-mono bg-white/10 px-2.5 py-0.5 rounded-lg border border-white/10">
                                    {latestDayRecords.length}
                                </span>
                            </div>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-12 text-gray-400">
                            <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-3" />
                            <p className="text-sm font-semibold">جاري تحميل سجلات الحضور والانصراف والإجازات...</p>
                        </div>
                    ) : latestDayRecords.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 text-gray-400 text-center space-y-2">
                            <Clock size={42} className="text-gray-600 mb-2" />
                            <p className="text-sm sm:text-base font-bold text-gray-200">
                                {selectedBranch !== 'all'
                                    ? `لا توجد تسجيلات حضور وانصراف في (${selectedBranch}) لآخر يوم مسجل`
                                    : 'تم تصفير الحضور والانصراف - لا توجد أي تسجيلات حالياً'}
                            </p>
                            <p className="text-xs text-gray-500 max-w-md">
                                {selectedBranch !== 'all'
                                    ? 'يمكنك اختيار "جميع الفروع" للاطلاع على الحضور في بقية الفروع، أو إلغاء فلتر البحث.'
                                    : 'تم تصفير السجل بنجاح لجميع العاملين. بمجرد قيام الموظفين بتسجيل الحضور، سيتم عرض سجل اليوم الأخير تلقائياً هنا.'}
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <div className="hidden md:block overflow-x-auto rounded-2xl border border-white/10">
                                <table className="w-full text-right border-collapse text-xs">
                                    <thead>
                                        <tr className="bg-white/5 border-b border-white/10 text-gray-400 font-bold uppercase text-[11px]">
                                            <th className="p-3">#</th>
                                            <th className="p-3">اسم الموظف</th>
                                            <th className="p-3">الفرع</th>
                                            <th className="p-3 text-center">وقت الحضور</th>
                                            <th className="p-3 text-center">وقت الانصراف</th>
                                            <th className="p-3 text-center">الحالة والانضباط</th>
                                            <th className="p-3 text-center">التأخير والخصم</th>
                                            <th className="p-3">الملاحظات</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {latestDayRecords.map((r, rIdx) => {
                                            const isMe = r.userId === user.key || r.username === user.username;
                                            return (
                                                <tr
                                                    key={`${r.userId}-${rIdx}`}
                                                    className={`hover:bg-white/5 transition ${
                                                        isMe ? 'bg-blue-600/10' : ''
                                                    }`}
                                                >
                                                    <td className="p-3 font-mono text-gray-500">{rIdx + 1}</td>
                                                    <td className="p-3">
                                                        <div className="font-bold text-white flex items-center gap-1.5">
                                                            <span>{r.employeeName}</span>
                                                            {isMe && (
                                                                <span className="text-[9px] bg-blue-500/20 text-blue-400 px-1 rounded font-bold">أنت</span>
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-gray-500 font-mono">@{r.username}</span>
                                                    </td>
                                                    <td className="p-3 text-gray-300 font-medium">
                                                        <span className="flex items-center gap-1">
                                                            <Building2 size={12} className="text-gray-500" />
                                                            <span>{r.branchName}</span>
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-center font-mono">
                                                        {r.checkInTime ? (
                                                            <span className={`inline-block px-2 py-0.5 rounded font-bold ${
                                                                r.isLate
                                                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                            }`}>
                                                                {r.checkInTime}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-600">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center font-mono">
                                                        {r.checkOutTime ? (
                                                            <span className="inline-block px-2 py-0.5 rounded font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                                {r.checkOutTime}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-600">غير مسجل</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {r.leaveLabel ? (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                                                <Coffee size={10} />
                                                                <span>{r.leaveLabel}</span>
                                                            </span>
                                                        ) : r.checkInTime ? (
                                                            r.isLate ? (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                                                    <AlertTriangle size={10} />
                                                                    <span>متأخر</span>
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                                                    <CheckCircle2 size={10} />
                                                                    <span>منضبط في الموعد</span>
                                                                </span>
                                                            )
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                                                <ShieldAlert size={10} />
                                                                <span>غياب</span>
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-center">
                                                        {r.isLate ? (
                                                            <span className="text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                                                {r.penaltyNote || 'خصم ربع يوم'}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-500 text-[10px]">-</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3 text-gray-400">
                                                        {r.leaveNotes || r.note || '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile Cards View (منسق دون مسطرة تحريك وبشكل واضح) */}
                            <div className="md:hidden space-y-2.5">
                                {latestDayRecords.map((r, rIdx) => {
                                    const isMe = r.userId === user.key || r.username === user.username;
                                    return (
                                        <div
                                            key={`mobile-${r.userId}-${rIdx}`}
                                            className={`p-3 rounded-2xl border transition ${
                                                isMe
                                                    ? 'bg-blue-900/20 border-blue-500/40'
                                                    : 'bg-white/5 border-white/10'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/5">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className="w-6 h-6 rounded-lg bg-white/10 text-gray-300 text-[11px] font-mono font-bold flex items-center justify-center shrink-0">
                                                        #{rIdx + 1}
                                                    </span>
                                                    <div className="min-w-0">
                                                        <span className="font-black text-white text-xs block truncate">
                                                            {r.employeeName}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400 font-mono block truncate">
                                                            @{r.username}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-lg border border-purple-400/20 shrink-0 font-medium">
                                                    🏢 {r.branchName}
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pt-2 text-xs">
                                                <div className="bg-gray-800/80 p-2 rounded-xl border border-white/5">
                                                    <span className="text-[10px] text-gray-400 block mb-0.5">وقت الحضور:</span>
                                                    {r.checkInTime ? (
                                                        <span className={`font-mono font-black ${r.isLate ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                            {r.checkInTime}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-500 font-mono">لم يسجل</span>
                                                    )}
                                                </div>

                                                <div className="bg-gray-800/80 p-2 rounded-xl border border-white/5">
                                                    <span className="text-[10px] text-gray-400 block mb-0.5">وقت الانصراف:</span>
                                                    {r.checkOutTime ? (
                                                        <span className="font-mono font-black text-purple-400">
                                                            {r.checkOutTime}
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-500 font-mono">غير مسجل</span>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-2 pt-2 mt-2 border-t border-white/5 text-[11px]">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-gray-400 text-[10px]">الحالة:</span>
                                                    {r.leaveLabel ? (
                                                        <span className="text-purple-300 font-bold bg-purple-500/20 px-2 py-0.5 rounded-full">
                                                            {r.leaveLabel}
                                                        </span>
                                                    ) : r.checkInTime ? (
                                                        r.isLate ? (
                                                            <span className="text-rose-400 font-bold bg-rose-500/20 px-2 py-0.5 rounded-full">
                                                                متأخر
                                                            </span>
                                                        ) : (
                                                            <span className="text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full">
                                                                منضبط
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className="text-amber-400 font-bold bg-amber-500/20 px-2 py-0.5 rounded-full">
                                                            غياب
                                                        </span>
                                                    )}
                                                </div>

                                                {r.isLate && (
                                                    <span className="text-rose-300 font-bold text-[10px] bg-rose-500/20 px-2 py-0.5 rounded-lg border border-rose-500/30">
                                                        {r.penaltyNote || 'خصم ربع يوم'}
                                                    </span>
                                                )}
                                            </div>

                                            {(r.leaveNotes || r.note) && (
                                                <div className="mt-2 pt-1.5 border-t border-white/5 text-[10px] text-gray-400">
                                                    ملاحظة: {r.leaveNotes || r.note}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* Footer Modal Actions */}
                <div className="p-4 bg-gray-950/90 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
                    <div>
                        دورة العمل: من 21 حتى 20 من كل شهر. يتم تطبيق خصم ربع يوم عن كل تأخير.
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition cursor-pointer"
                        >
                            إغلاق
                        </button>
                    </div>
                </div>
            </div>

            {/* ============================================================ */}
            {/* POPUP MODAL: EMPLOYEE DETAILED SUMMARY (شاشة منبثقة تفصيلية للموظف) */}
            {/* ============================================================ */}
            {showEmployeeDetailModal && (
                <div className="fixed inset-0 z-[140] bg-black/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-5 overflow-y-auto">
                    <div className="bg-gray-900 border border-blue-500/40 w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in zoom-in-95">
                        
                        {/* Popup Header */}
                        <div className="p-3.5 sm:p-5 bg-gradient-to-r from-blue-950 via-gray-900 to-gray-900 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="p-2 sm:p-2.5 rounded-2xl bg-blue-600/30 text-blue-400 border border-blue-400/40 shrink-0">
                                    <UserIcon size={22} />
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h3 className="text-sm sm:text-lg font-black text-white truncate">
                                            {modalTargetEmployee 
                                                ? `سجل حضور وانصراف وتفاصيل: ${modalTargetEmployee.name || modalTargetEmployee.username}`
                                                : 'سجل وتفاصيل حضور وانصراف الموظفين الشامل'}
                                        </h3>
                                        {modalTargetEmployee && (
                                            <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30 font-bold font-mono">
                                                @{modalTargetEmployee.username}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] sm:text-xs text-gray-400 mt-0.5">
                                        عرض جدول الحضور والانصراف، والتأخيرات والغياب في التواريخ المحددة
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                                {user.role === 'admin' && (
                                    <div className="flex items-center gap-1.5">
                                        <select
                                            value={modalTargetEmployee ? (modalTargetEmployee.key || modalTargetEmployee.username) : 'all'}
                                            onChange={(e) => {
                                                const val = e.target.value;
                                                if (val === 'all') {
                                                    setModalTargetEmployee(null);
                                                } else {
                                                    const found = usersList.find(u => u.key === val || u.username === val);
                                                    setModalTargetEmployee(found || null);
                                                }
                                            }}
                                            className="bg-gray-800 text-white font-bold text-xs px-2.5 sm:px-3 py-1.5 rounded-xl border border-white/15 focus:outline-none focus:border-blue-500 cursor-pointer"
                                        >
                                            <option value="all">👥 جميع الموظفين</option>
                                            {usersList.filter(u => u.role !== 'admin' && !u.isArchived).map(u => (
                                                <option key={u.key || u.username} value={u.key || u.username}>
                                                    {u.name || u.username}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                <button
                                    onClick={() => setShowEmployeeDetailModal(false)}
                                    className="p-1.5 sm:p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition cursor-pointer"
                                    title="إغلاق"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Interactive Date Range Selector inside Modal (التواريخ المحددة) */}
                        <div className="p-3 bg-gray-950/90 border-b border-white/5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-blue-300 flex items-center gap-1.5 text-xs">
                                    <Calendar size={14} className="text-blue-400" />
                                    <span>التواريخ المحددة:</span>
                                </span>

                                <div className="flex items-center gap-1 bg-gray-900 px-2 py-1 rounded-xl border border-white/15">
                                    <span className="text-[10px] text-gray-400">من:</span>
                                    <input
                                        type="date"
                                        value={filterStartDate}
                                        onChange={(e) => setFilterStartDate(e.target.value)}
                                        className="bg-transparent text-white font-mono text-xs focus:outline-none font-bold"
                                    />
                                </div>

                                <div className="flex items-center gap-1 bg-gray-900 px-2 py-1 rounded-xl border border-white/15">
                                    <span className="text-[10px] text-gray-400">إلى:</span>
                                    <input
                                        type="date"
                                        value={filterEndDate}
                                        onChange={(e) => setFilterEndDate(e.target.value)}
                                        className="bg-transparent text-white font-mono text-xs focus:outline-none font-bold"
                                    />
                                </div>

                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => handleSetPresetDates('cycle')}
                                        className="px-2.5 py-1 text-[11px] rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-bold transition"
                                    >
                                        دورة الشهر
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSetPresetDates('today')}
                                        className="px-2.5 py-1 text-[11px] rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition"
                                    >
                                        اليوم
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSetPresetDates('week')}
                                        className="px-2.5 py-1 text-[11px] rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition"
                                    >
                                        آخر 7 أيام
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleSetPresetDates('month')}
                                        className="px-2.5 py-1 text-[11px] rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 transition"
                                    >
                                        الشهر الحالي
                                    </button>
                                </div>
                            </div>

                            <div className="text-[11px] text-gray-400 font-mono">
                                الفترة: <span className="text-white font-bold">{filterStartDate}</span> إلى <span className="text-white font-bold">{filterEndDate}</span>
                            </div>
                        </div>

                        {/* Summary Cards: الحضور والإجازات والتأخيرات والغياب في سطر واحد */}
                        <div className="p-2 sm:p-4 bg-gray-950/60 border-b border-white/5 grid grid-cols-4 gap-1 sm:gap-3">
                            {/* أيام الحضور */}
                            <div className="p-1.5 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-center sm:text-right">
                                <span className="text-[9px] sm:text-xs font-bold text-emerald-300 block mb-0.5 truncate">أيام الحضور</span>
                                <div className="flex items-baseline justify-center sm:justify-start gap-1">
                                    <span className="text-base sm:text-2xl font-black text-emerald-400 font-mono">
                                        {employeeModalStats.presentCount}
                                    </span>
                                    <span className="text-[8px] sm:text-[10px] text-gray-400 truncate">سجل</span>
                                </div>
                                <span className="text-[8px] sm:text-[10px] text-emerald-400/90 font-semibold block mt-0.5 truncate">
                                    {employeeModalStats.onTimeCount} منضبط
                                </span>
                            </div>

                            {/* أيام التأخير */}
                            <div className="p-1.5 sm:p-3 rounded-xl sm:rounded-2xl bg-rose-500/15 border border-rose-500/30 text-center sm:text-right">
                                <span className="text-[9px] sm:text-xs font-black text-rose-300 block mb-0.5 truncate">أيام التأخير</span>
                                <div className="flex items-baseline justify-center sm:justify-start gap-1">
                                    <span className="text-base sm:text-2xl font-black text-rose-400 font-mono">
                                        {employeeModalStats.lateCount}
                                    </span>
                                    <span className="text-[8px] sm:text-[10px] text-rose-300 font-bold bg-rose-500/20 px-1 rounded truncate">
                                        {user.role === 'admin' ? `خصم ${employeeModalStats.penaltyDays}ي` : `${employeeModalStats.lateCount}ي`}
                                    </span>
                                </div>
                                <span className="text-[8px] sm:text-[10px] text-rose-300/80 block mt-0.5 truncate">
                                    {user.role === 'admin' ? 'خصم تأخيرات' : 'تأخيرات'}
                                </span>
                            </div>

                            {/* أيام الغياب */}
                            <div className="p-1.5 sm:p-3 rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/25 text-center sm:text-right">
                                <span className="text-[9px] sm:text-xs font-bold text-amber-300 block mb-0.5 truncate">أيام الغياب</span>
                                <div className="flex items-baseline justify-center sm:justify-start gap-1">
                                    <span className="text-base sm:text-2xl font-black text-amber-400 font-mono">
                                        {employeeModalStats.absentCount}
                                    </span>
                                    <span className="text-[8px] sm:text-[10px] text-amber-400">غياب</span>
                                </div>
                                <span className="text-[8px] sm:text-[10px] text-gray-400 block mt-0.5 truncate">بدون تسجيل</span>
                            </div>

                            {/* أيام الإجازات */}
                            <div className="p-1.5 sm:p-3 rounded-xl sm:rounded-2xl bg-purple-500/10 border border-purple-500/25 text-center sm:text-right">
                                <span className="text-[9px] sm:text-xs font-bold text-purple-300 block mb-0.5 truncate">الإجازات</span>
                                <div className="flex items-baseline justify-center sm:justify-start gap-1">
                                    <span className="text-base sm:text-2xl font-black text-purple-400 font-mono">
                                        {employeeModalStats.leaveCount}
                                    </span>
                                    <span className="text-[8px] sm:text-[10px] text-purple-400">إجازة</span>
                                </div>
                                <span className="text-[8px] sm:text-[10px] text-gray-400 block mt-0.5 truncate">سنوي/رسمي</span>
                            </div>
                        </div>

                        {/* Detailed Table for Employee Days (جدول الحضور والانصراف والتأخيرات والغياب في التواريخ المحددة) */}
                        <div className="p-3 sm:p-4 flex-1 overflow-y-auto">
                            <div className="text-xs font-bold text-gray-300 mb-2.5 flex items-center justify-between">
                                <span className="text-white flex items-center gap-1.5">
                                    <FileText size={15} className="text-blue-400" />
                                    <span>جدول الحضور والانصراف والتأخيرات والغياب ({employeeModalRecords.length} سجل في التواريخ المحددة):</span>
                                </span>
                                <span className="text-blue-400 font-mono text-[11px] bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20">
                                    {filterStartDate} ⬅ {filterEndDate}
                                </span>
                            </div>

                            {employeeModalRecords.length === 0 ? (
                                <div className="p-8 sm:p-12 text-center text-gray-400 text-xs sm:text-sm bg-white/5 rounded-2xl border border-white/5 flex flex-col items-center justify-center gap-2">
                                    <div className="p-3 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-1">
                                        <Users size={28} />
                                    </div>
                                    <span className="font-bold text-white text-sm">
                                        {!isAttendanceStarted 
                                            ? 'لم يتم بدء تسجيل الحضور والانصراف بعد من لوحة تحكم الإدارة.' 
                                            : !hasAnyRecordedAttendance 
                                            ? 'تم بدء النظام، ولكن لم يقم أي موظف بتسجيل الحضور بعد في أي فرع.' 
                                            : 'لا توجد تسجيلات حضور أو انصراف في التواريخ المحددة.'}
                                    </span>
                                    <span className="text-[11px] text-gray-400 max-w-md">
                                        يبدأ ظهور وتحديث سجلات وتقارير الحضور والانصراف تلقائياً لجميع الحسابات فور قيام أول موظف بتسجيل الحضور في أي فرع.
                                    </span>
                                </div>
                            ) : (
                                <>
                                    {/* Mobile View: كروت منظمة بوضوح تام لكل يوم بدون مسطرة تحريك */}
                                    <div className="md:hidden space-y-2 overflow-hidden">
                                        {employeeModalRecords.map((r, idx) => (
                                            <div
                                                key={`m-emp-rec-${r.date}-${r.userId}-${idx}`}
                                                className={`border rounded-2xl p-3 flex flex-col gap-2 text-xs overflow-hidden ${
                                                    r.status === 'absent' 
                                                        ? 'bg-amber-500/10 border-amber-500/30' 
                                                        : r.status === 'late' 
                                                        ? 'bg-rose-500/10 border-rose-500/30' 
                                                        : r.status === 'leave'
                                                        ? 'bg-purple-500/10 border-purple-500/30'
                                                        : 'bg-gray-800/60 border-white/10'
                                                }`}
                                            >
                                                {/* السطر الأول: التاريخ واليوم والحالة العامة */}
                                                <div className="flex items-center justify-between gap-1 border-b border-white/10 pb-1.5">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <span className="font-mono text-gray-400 text-[11px]">#{idx + 1}</span>
                                                        <span className="font-black text-white text-xs">{r.dayName}</span>
                                                        <span className="text-[11px] text-gray-300 font-mono">({r.date})</span>
                                                    </div>

                                                    <div className="shrink-0 text-left">
                                                        {r.status === 'on_time' ? (
                                                            <span className="text-emerald-300 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-lg text-[10px] inline-flex items-center gap-1">
                                                                ✓ منضبط
                                                            </span>
                                                        ) : r.status === 'late' ? (
                                                            <span className="text-rose-300 font-bold bg-rose-500/25 px-2 py-0.5 rounded-lg text-[10px] inline-flex items-center gap-1">
                                                                ⚠️ متأخر
                                                            </span>
                                                        ) : r.status === 'absent' ? (
                                                            <span className="text-amber-300 font-bold bg-amber-500/25 px-2 py-0.5 rounded-lg text-[10px] inline-flex items-center gap-1">
                                                                ✕ غياب
                                                            </span>
                                                        ) : (
                                                            <span className="text-purple-300 font-bold bg-purple-500/20 px-2 py-0.5 rounded-lg text-[10px]">
                                                                {r.statusLabel}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* السطر الثاني: الموظف والفرع */}
                                                <div className="text-[11px] text-gray-300 truncate">
                                                    👤 <span className="font-bold text-white">{r.employeeName}</span> {r.branchName ? `• ${r.branchName}` : ''}
                                                </div>

                                                {/* السطر الثالث: الحضور والانصراف بوضوح تام */}
                                                <div className="grid grid-cols-2 gap-2 text-[11px] bg-black/30 p-2 rounded-xl border border-white/5">
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-gray-400 shrink-0">الحضور:</span>
                                                        {r.checkInTime ? (
                                                            <span className="font-mono font-bold text-emerald-400">{r.checkInTime}</span>
                                                        ) : (
                                                            <span className="text-gray-400 text-[10px]">{r.status === 'absent' ? 'لم يحضر' : r.statusLabel}</span>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-gray-400 shrink-0">الانصراف:</span>
                                                        {r.checkOutTime ? (
                                                            <span className="font-mono font-bold text-blue-400">{r.checkOutTime}</span>
                                                        ) : (
                                                            <span className="text-gray-500 text-[10px]">-</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* السطر الرابع: التأخيرات والغياب بوضوح تام */}
                                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                                    {/* خانة التأخيرات */}
                                                    <div className="p-1.5 rounded-lg bg-black/20 flex flex-col">
                                                        <span className="text-gray-400 font-bold">التأخيرات:</span>
                                                        {r.isLate ? (
                                                            <span className="text-rose-400 font-bold mt-0.5">{r.penaltyNote || 'خصم ربع يوم'}</span>
                                                        ) : r.checkInTime ? (
                                                            <span className="text-emerald-400 font-semibold mt-0.5">✓ لا يوجد تأخير</span>
                                                        ) : (
                                                            <span className="text-gray-500 mt-0.5">-</span>
                                                        )}
                                                    </div>

                                                    {/* خانة الغياب */}
                                                    <div className="p-1.5 rounded-lg bg-black/20 flex flex-col">
                                                        <span className="text-gray-400 font-bold">الغياب:</span>
                                                        {r.status === 'absent' ? (
                                                            <span className="text-amber-400 font-bold mt-0.5">✕ غياب (يوم كامل)</span>
                                                        ) : r.checkInTime ? (
                                                            <span className="text-emerald-400 font-semibold mt-0.5">✓ حاضر</span>
                                                        ) : (
                                                            <span className="text-purple-300 font-semibold mt-0.5">{r.statusLabel}</span>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* ملاحظات إن وجدت */}
                                                {(r.leaveNotes || r.note) && (
                                                    <div className="text-[10px] text-gray-400 bg-white/5 px-2 py-1 rounded-lg">
                                                        📝 {r.leaveNotes || r.note}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Desktop Table (عرض الشاشات الكبيرة: جدول تفصيلي بالأعمدة المطلوبة) */}
                                    <div className="hidden md:block overflow-x-auto rounded-2xl border border-white/10 shadow-lg">
                                        <table className="w-full text-right border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-gray-800/90 border-b border-white/10 text-gray-300 font-black uppercase text-[11px]">
                                                    <th className="p-3 w-10 text-center">#</th>
                                                    <th className="p-3">التاريخ واليوم</th>
                                                    <th className="p-3">الموظف والفرع</th>
                                                    <th className="p-3 text-center">الحضور</th>
                                                    <th className="p-3 text-center">الانصراف</th>
                                                    <th className="p-3 text-center">التأخيرات</th>
                                                    <th className="p-3 text-center">الغياب</th>
                                                    <th className="p-3">الملاحظات والجزاء</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-white/5">
                                                {employeeModalRecords.map((r, idx) => (
                                                    <tr 
                                                        key={`emp-rec-${r.date}-${r.userId}-${idx}`} 
                                                        className={`hover:bg-white/5 transition-colors ${
                                                            r.status === 'absent' 
                                                                ? 'bg-amber-500/[0.05]' 
                                                                : r.status === 'late' 
                                                                ? 'bg-rose-500/[0.05]' 
                                                                : ''
                                                        }`}
                                                    >
                                                        <td className="p-3 font-mono text-gray-400 text-center font-bold">{idx + 1}</td>
                                                        <td className="p-3">
                                                            <div className="font-bold text-white text-xs">{r.dayName}</div>
                                                            <div className="text-[10px] text-gray-400 font-mono">{r.date}</div>
                                                        </td>
                                                        <td className="p-3">
                                                            <div className="font-bold text-white text-xs">{r.employeeName}</div>
                                                            <div className="text-[10px] text-gray-400">{r.branchName}</div>
                                                        </td>
                                                        <td className="p-3 text-center font-mono">
                                                            {r.checkInTime ? (
                                                                <span className="px-2.5 py-1 rounded-xl font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 inline-flex items-center gap-1">
                                                                    🟢 {r.checkInTime}
                                                                </span>
                                                            ) : r.status === 'leave' ? (
                                                                <span className="px-2 py-0.5 rounded-lg text-purple-300 bg-purple-500/20 font-bold text-[10px]">
                                                                    🟣 {r.leaveLabel}
                                                                </span>
                                                            ) : r.status === 'weekly_off' ? (
                                                                <span className="text-gray-400 text-[10px] bg-white/5 px-2 py-0.5 rounded-lg">عطلة أسبوعية</span>
                                                            ) : (
                                                                <span className="text-rose-400 text-[11px] font-bold">لم يسجل</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-center font-mono">
                                                            {r.checkOutTime ? (
                                                                <span className="px-2.5 py-1 rounded-xl font-bold text-blue-300 bg-blue-500/20 border border-blue-500/30 inline-flex items-center gap-1">
                                                                    🔵 {r.checkOutTime}
                                                                </span>
                                                            ) : r.checkInTime ? (
                                                                <span className="text-amber-400/80 text-[10px] bg-amber-500/10 px-2 py-0.5 rounded-lg">لم يسجل انصراف</span>
                                                            ) : (
                                                                <span className="text-gray-500">-</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {r.isLate ? (
                                                                <span className="px-2.5 py-1 rounded-xl font-bold text-rose-300 bg-rose-500/25 border border-rose-500/35 text-[11px] inline-flex items-center gap-1">
                                                                    ⚠️ {r.penaltyNote || 'متأخر (خصم ربع يوم)'}
                                                                </span>
                                                            ) : r.checkInTime ? (
                                                                <span className="px-2 py-1 rounded-xl font-semibold text-emerald-300 bg-emerald-500/10 text-[10px] inline-flex items-center gap-1">
                                                                    ✓ منضبط
                                                                </span>
                                                            ) : (
                                                                <span className="text-gray-500">-</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            {r.status === 'absent' ? (
                                                                <span className="px-2.5 py-1 rounded-xl font-black text-amber-300 bg-amber-500/25 border border-amber-500/35 text-[11px] inline-flex items-center gap-1">
                                                                    ✕ غياب (يوم كامل)
                                                                </span>
                                                            ) : r.checkInTime ? (
                                                                <span className="px-2 py-0.5 rounded-lg font-bold text-emerald-400 bg-emerald-500/10 text-[10px]">
                                                                    ✓ حاضر
                                                                </span>
                                                            ) : r.status === 'leave' ? (
                                                                <span className="text-purple-300 font-bold text-[10px]">{r.statusLabel}</span>
                                                            ) : (
                                                                <span className="text-gray-500">-</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-gray-300 text-xs">
                                                            {r.leaveNotes || r.note || (r.isLate ? r.penaltyNote : '-')}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Popup Footer Actions */}
                        <div className="p-3.5 sm:p-4 bg-gray-950 border-t border-white/10 flex items-center justify-between">
                            <button
                                onClick={() => handleDownloadPDF(true)}
                                disabled={isExportingPDF}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-2 transition cursor-pointer"
                            >
                                <Download size={14} />
                                <span>تحميل تقرير PDF</span>
                            </button>

                            <button
                                onClick={() => setShowEmployeeDetailModal(false)}
                                className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition cursor-pointer"
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* HIDDEN PRINT / PDF CONTAINER (ALL EMPLOYEES OR FILTERED)   */}
            {/* ============================================================ */}
            <div
                ref={printContainerRef}
                style={{
                    display: 'none',
                    position: 'absolute',
                    top: '-9999px',
                    left: '-9999px',
                    width: '1100px',
                    backgroundColor: '#ffffff',
                    color: '#111827',
                    padding: '36px',
                    direction: 'rtl',
                    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif'
                }}
            >
                <div style={{ borderBottom: '2px solid #2563eb', paddingBottom: '16px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#1e3a8a', margin: '0 0 6px 0' }}>
                                شركة سوفت روز للصناعات الورقية (Soft Rose)
                            </h1>
                            <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb', margin: '0 0 4px 0' }}>
                                تقرير سجل الحضور والانصراف، التأخيرات والإجازات
                            </h2>
                            <p style={{ fontSize: '13px', color: '#4b5563', margin: 0 }}>
                                نظام إدارة المبيعات الميدانية والموارد البشرية
                            </p>
                        </div>

                        <div style={{ textAlign: 'left', fontSize: '12px', color: '#374151' }}>
                            <div><strong>دورة العمل:</strong> {activePeriod?.label}</div>
                            <div><strong>تاريخ الطباعة:</strong> {new Date().toLocaleDateString('ar-EG')}</div>
                            <div><strong>الموظف المستهدف:</strong> {
                                effectiveEmployeeFilter === 'all'
                                    ? 'جميع الموظفين'
                                    : (usersList.find((u) => u.key === effectiveEmployeeFilter || u.username === effectiveEmployeeFilter)?.name || effectiveEmployeeFilter)
                            }</div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
                    <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px', backgroundColor: '#f9fafb', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 'bold' }}>أيام العمل بالتقرير</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#111827', marginTop: '4px' }}>{statsSummary.totalDays}</div>
                    </div>

                    <div style={{ border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px', backgroundColor: '#f0fdf4', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#166534', fontWeight: 'bold' }}>إجمالي الحضور</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#15803d', marginTop: '4px' }}>{statsSummary.totalPresent}</div>
                    </div>

                    <div style={{ border: '1px solid #fecdd3', borderRadius: '10px', padding: '12px', backgroundColor: '#fff1f2', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#9f1239', fontWeight: 'bold' }}>أيام التأخير (خصومات)</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#be123c', marginTop: '4px' }}>
                            {statsSummary.totalLate}
                            <span style={{ fontSize: '11px', display: 'block', color: '#e11d48' }}>خصم {statsSummary.totalDeductionDays} يوم</span>
                        </div>
                    </div>

                    <div style={{ border: '1px solid #fed7aa', borderRadius: '10px', padding: '12px', backgroundColor: '#fff7ed', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#9a3412', fontWeight: 'bold' }}>أيام الغياب</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#c2410c', marginTop: '4px' }}>{statsSummary.totalAbsent}</div>
                    </div>

                    <div style={{ border: '1px solid #e9d5ff', borderRadius: '10px', padding: '12px', backgroundColor: '#faf5ff', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: '#6b21a8', fontWeight: 'bold' }}>الإجازات المسجلة</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#7e22ce', marginTop: '4px' }}>{statsSummary.totalLeaves}</div>
                    </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'right' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}>
                            <th style={{ padding: '8px', border: '1px solid #1e3a8a' }}>م</th>
                            <th style={{ padding: '8px', border: '1px solid #1e3a8a' }}>اسم الموظف</th>
                            <th style={{ padding: '8px', border: '1px solid #1e3a8a' }}>التاريخ واليوم</th>
                            <th style={{ padding: '8px', border: '1px solid #1e3a8a' }}>الفرع</th>
                            <th style={{ padding: '8px', border: '1px solid #1e3a8a', textAlign: 'center' }}>وقت الحضور</th>
                            <th style={{ padding: '8px', border: '1px solid #1e3a8a', textAlign: 'center' }}>وقت الانصراف</th>
                            <th style={{ padding: '8px', border: '1px solid #1e3a8a', textAlign: 'center' }}>الحالة</th>
                            <th style={{ padding: '8px', border: '1px solid #1e3a8a', textAlign: 'center' }}>الخصم والتأخير</th>
                            <th style={{ padding: '8px', border: '1px solid #1e3a8a' }}>الملاحظات والإجازات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allPeriodRecords.map((r, idx) => (
                            <tr
                                key={`pdf-${r.date}-${r.userId}-${idx}`}
                                style={{
                                    backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb',
                                    borderBottom: '1px solid #e5e7eb'
                                }}
                            >
                                <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{idx + 1}</td>
                                <td style={{ padding: '8px', border: '1px solid #e5e7eb', fontWeight: 'bold' }}>
                                    {r.employeeName}
                                    <span style={{ display: 'block', fontSize: '9px', color: '#6b7280' }}>@{r.username}</span>
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>
                                    <strong>{getShortDayName(r.date)}</strong>
                                    <span style={{ display: 'block', fontSize: '10px', color: '#6b7280' }}>{r.date}</span>
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{r.branchName}</td>
                                <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold', color: r.isLate ? '#be123c' : '#15803d' }}>
                                    {r.checkInTime || '-'}
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                                    {r.checkOutTime || '-'}
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                                    {r.leaveLabel ? (
                                        <span style={{ color: '#7e22ce', fontWeight: 'bold' }}>{r.leaveLabel}</span>
                                    ) : r.checkInTime ? (
                                        r.isLate ? (
                                            <span style={{ color: '#be123c', fontWeight: 'bold' }}>متأخر</span>
                                        ) : (
                                            <span style={{ color: '#15803d', fontWeight: 'bold' }}>منضبط</span>
                                        )
                                    ) : (
                                        <span style={{ color: '#c2410c', fontWeight: 'bold' }}>غياب</span>
                                    )}
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', color: r.isLate ? '#be123c' : '#4b5563', fontWeight: r.isLate ? 'bold' : 'normal' }}>
                                    {r.isLate ? (r.penaltyNote || 'خصم ربع يوم') : '-'}
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #e5e7eb', color: '#4b5563' }}>
                                    {r.leaveNotes || r.note || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid #d1d5db', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <div style={{ textAlign: 'center', width: '220px' }}>
                        <p style={{ fontWeight: 'bold', margin: '0 0 40px 0' }}>توقيع الموظف</p>
                        <p style={{ borderTop: '1px dashed #9ca3af', paddingTop: '4px', margin: 0 }}>........................................</p>
                    </div>

                    <div style={{ textAlign: 'center', width: '220px' }}>
                        <p style={{ fontWeight: 'bold', margin: '0 0 40px 0' }}>مسؤول الموارد البشرية</p>
                        <p style={{ borderTop: '1px dashed #9ca3af', paddingTop: '4px', margin: 0 }}>........................................</p>
                    </div>

                    <div style={{ textAlign: 'center', width: '220px' }}>
                        <p style={{ fontWeight: 'bold', margin: '0 0 40px 0' }}>اعتماد المدير العام</p>
                        <p style={{ borderTop: '1px dashed #9ca3af', paddingTop: '4px', margin: 0 }}>........................................</p>
                    </div>
                </div>
            </div>

            {/* ============================================================ */}
            {/* HIDDEN PRINT / PDF CONTAINER FOR SPECIFIC EMPLOYEE           */}
            {/* ============================================================ */}
            {modalTargetEmployee && (
                <div
                    ref={employeePrintContainerRef}
                    style={{
                        display: 'none',
                        position: 'absolute',
                        top: '-9999px',
                        left: '-9999px',
                        width: '1100px',
                        backgroundColor: '#ffffff',
                        color: '#111827',
                        padding: '36px',
                        direction: 'rtl',
                        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", sans-serif'
                    }}
                >
                    <div style={{ borderBottom: '2px solid #2563eb', paddingBottom: '16px', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#1e3a8a', margin: '0 0 6px 0' }}>
                                    شركة سوفت روز للصناعات الورقية (Soft Rose)
                                </h1>
                                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#2563eb', margin: '0 0 4px 0' }}>
                                    تقرير الحضور والانصراف والإجازات والتأخيرات للموظف
                                </h2>
                                <p style={{ fontSize: '14px', color: '#1f2937', margin: '4px 0 0 0', fontWeight: 'bold' }}>
                                    الموظف: {modalTargetEmployee.name || modalTargetEmployee.username} (@{modalTargetEmployee.username})
                                </p>
                            </div>

                            <div style={{ textAlign: 'left', fontSize: '12px', color: '#374151' }}>
                                <div><strong>الدورة:</strong> {activePeriod?.label}</div>
                                <div><strong>تاريخ الطباعة:</strong> {new Date().toLocaleDateString('ar-EG')}</div>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ border: '1px solid #bbf7d0', borderRadius: '10px', padding: '12px', backgroundColor: '#f0fdf4', textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#166534', fontWeight: 'bold' }}>أيام الحضور</div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#15803d', marginTop: '4px' }}>{employeeModalStats.presentCount}</div>
                            <div style={{ fontSize: '10px', color: '#166534' }}>{employeeModalStats.onTimeCount} منضبط</div>
                        </div>

                        <div style={{ border: '1px solid #e9d5ff', borderRadius: '10px', padding: '12px', backgroundColor: '#faf5ff', textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#6b21a8', fontWeight: 'bold' }}>أيام الإجازات</div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#7e22ce', marginTop: '4px' }}>{employeeModalStats.leaveCount}</div>
                        </div>

                        <div style={{ border: '1px solid #fecdd3', borderRadius: '10px', padding: '12px', backgroundColor: '#fff1f2', textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#9f1239', fontWeight: 'bold' }}>التأخيرات والخصومات</div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#be123c', marginTop: '4px' }}>
                                {employeeModalStats.lateCount}
                                <span style={{ fontSize: '10px', display: 'block', color: '#e11d48' }}>خصم {employeeModalStats.penaltyDays} يوم</span>
                            </div>
                        </div>

                        <div style={{ border: '1px solid #fed7aa', borderRadius: '10px', padding: '12px', backgroundColor: '#fff7ed', textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', color: '#9a3412', fontWeight: 'bold' }}>أيام الغياب</div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#c2410c', marginTop: '4px' }}>{employeeModalStats.absentCount}</div>
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'right' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}>
                                <th style={{ padding: '8px', border: '1px solid #1e3a8a' }}>م</th>
                                <th style={{ padding: '8px', border: '1px solid #1e3a8a' }}>التاريخ واليوم</th>
                                <th style={{ padding: '8px', border: '1px solid #1e3a8a' }}>الفرع</th>
                                <th style={{ padding: '8px', border: '1px solid #1e3a8a', textAlign: 'center' }}>وقت الحضور</th>
                                <th style={{ padding: '8px', border: '1px solid #1e3a8a', textAlign: 'center' }}>وقت الانصراف</th>
                                <th style={{ padding: '8px', border: '1px solid #1e3a8a', textAlign: 'center' }}>الحالة</th>
                                <th style={{ padding: '8px', border: '1px solid #1e3a8a', textAlign: 'center' }}>الخصم والتأخير</th>
                                <th style={{ padding: '8px', border: '1px solid #1e3a8a' }}>الملاحظات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {employeeModalRecords.map((r, idx) => (
                                <tr
                                    key={`emp-pdf-${r.date}-${idx}`}
                                    style={{
                                        backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f9fafb',
                                        borderBottom: '1px solid #e5e7eb'
                                    }}
                                >
                                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>{idx + 1}</td>
                                    <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>
                                        <strong>{getShortDayName(r.date)}</strong>
                                        <span style={{ display: 'block', fontSize: '10px', color: '#6b7280' }}>{r.date}</span>
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #e5e7eb' }}>{r.branchName}</td>
                                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold', color: r.isLate ? '#be123c' : '#15803d' }}>
                                        {r.checkInTime || '-'}
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                                        {r.checkOutTime || '-'}
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center' }}>
                                        {r.leaveLabel ? (
                                            <span style={{ color: '#7e22ce', fontWeight: 'bold' }}>{r.leaveLabel}</span>
                                        ) : r.checkInTime ? (
                                            r.isLate ? (
                                                <span style={{ color: '#be123c', fontWeight: 'bold' }}>متأخر</span>
                                            ) : (
                                                <span style={{ color: '#15803d', fontWeight: 'bold' }}>منضبط</span>
                                            )
                                        ) : (
                                            <span style={{ color: '#c2410c', fontWeight: 'bold' }}>غياب</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', color: r.isLate ? '#be123c' : '#4b5563', fontWeight: r.isLate ? 'bold' : 'normal' }}>
                                        {r.isLate ? (r.penaltyNote || 'خصم ربع يوم') : '-'}
                                    </td>
                                    <td style={{ padding: '8px', border: '1px solid #e5e7eb', color: '#4b5563' }}>
                                        {r.leaveNotes || r.note || '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <div style={{ marginTop: '36px', paddingTop: '20px', borderTop: '1px solid #d1d5db', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <div style={{ textAlign: 'center', width: '220px' }}>
                            <p style={{ fontWeight: 'bold', margin: '0 0 40px 0' }}>توقيع الموظف</p>
                            <p style={{ borderTop: '1px dashed #9ca3af', paddingTop: '4px', margin: 0 }}>........................................</p>
                        </div>

                        <div style={{ textAlign: 'center', width: '220px' }}>
                            <p style={{ fontWeight: 'bold', margin: '0 0 40px 0' }}>مسؤول الموارد البشرية</p>
                            <p style={{ borderTop: '1px dashed #9ca3af', paddingTop: '4px', margin: 0 }}>........................................</p>
                        </div>

                        <div style={{ textAlign: 'center', width: '220px' }}>
                            <p style={{ fontWeight: 'bold', margin: '0 0 40px 0' }}>اعتماد المدير العام</p>
                            <p style={{ borderTop: '1px dashed #9ca3af', paddingTop: '4px', margin: 0 }}>........................................</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
