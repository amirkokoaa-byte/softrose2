import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { ref, set, update, push } from 'firebase/database';
import { onCachedValue } from '../firebaseCache';
import { User, AttendanceRecord, AttendanceScheduleSettings, EmployeeBranchLocation } from '../types';
import { validateEmployeeGeofence } from '../geoSecurity';
import { 
    Clock, AlertTriangle, LogIn, LogOut, Users, 
    CheckCircle2, Building2, Search, Calendar, 
    Sparkles, ShieldAlert, ArrowRightCircle,
    Settings as SettingsIcon, X, Plus, Trash2, 
    MapPin, Navigation, Save, Check, Sliders,
    BarChart2, UserCheck, AlertCircle, TrendingUp,
    Loader2, BookOpen, Eye, EyeOff, Coffee,
    PauseCircle, PlayCircle, Hourglass, Timer, Edit3,
    FileDown, Printer
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { AttendanceRecordsModal } from './AttendanceRecordsModal';

interface Props {
    user: User;
    theme: string;
    markets: string[];
}

export const Attendance: React.FC<Props> = ({ user, theme, markets }) => {
    // Current live time
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    
    // Attendance & Users real-time data
    const [todayAttendance, setTodayAttendance] = useState<Record<string, AttendanceRecord>>({});
    const [allAttendanceHistory, setAllAttendanceHistory] = useState<Record<string, Record<string, AttendanceRecord>>>({});
    const [usersList, setUsersList] = useState<User[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedBranch, setSelectedBranch] = useState<string>('all');
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Phase 5: Records & Reports Modal
    const [showRecordsModal, setShowRecordsModal] = useState(false);

    // ==========================================
    // Phase 2: Admin Settings State
    // ==========================================
    const [showAdminSettings, setShowAdminSettings] = useState(false);
    const [activeTab, setActiveTab] = useState<'schedules' | 'locations' | 'advanced' | 'employees'>('schedules');

    // Tab 1: Schedules & Grace Period
    const [scheduleCheckIn, setScheduleCheckIn] = useState<string>('10:00');
    const [scheduleCheckOut, setScheduleCheckOut] = useState<string>('18:00');
    const [gracePeriodMinutes, setGracePeriodMinutes] = useState<number>(15);

    // Tab 2: Employee Locations & Branches
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
    const [branchSlots, setBranchSlots] = useState<EmployeeBranchLocation[]>([]);
    const [allEmployeeLocations, setAllEmployeeLocations] = useState<Record<string, EmployeeBranchLocation[]>>({});
    const [isSavingSettings, setIsSavingSettings] = useState(false);
    const [settingsSaveMsg, setSettingsSaveMsg] = useState<string | null>(null);

    // Tab 4: Employee visibility (Show / Hide in Attendance)
    const [hiddenEmployees, setHiddenEmployees] = useState<Record<string, boolean>>({});
    const [employeeFilterSearch, setEmployeeFilterSearch] = useState<string>('');

    // Tab 4 (إعدادات إضافية): وضع تعليق النظام / وضع الصيانة (System Suspension Mode)
    const [isSuspended, setIsSuspended] = useState<boolean>(() => {
        try {
            const local = localStorage.getItem('attendance_is_suspended');
            return local ? JSON.parse(local) : false;
        } catch {
            return false;
        }
    });
    const [suspensionDays, setSuspensionDays] = useState<number>(() => {
        try {
            const local = localStorage.getItem('attendance_suspension_days');
            return local ? Number(local) : 1;
        } catch {
            return 1;
        }
    });
    const [targetEndTimestamp, setTargetEndTimestamp] = useState<number>(() => {
        try {
            const local = localStorage.getItem('attendance_target_end_timestamp');
            return local ? Number(local) : 0;
        } catch {
            return 0;
        }
    });

    // Start Attendance System State (لا يتم تسجيل حضور وانصراف إلا عند بدء التسجيل من إعدادات إضافية)
    const [isAttendanceStarted, setIsAttendanceStarted] = useState<boolean>(false);
    const [attendanceStartedInfo, setAttendanceStartedInfo] = useState<{ started?: boolean; startedAt?: number; startedBy?: string } | null>(null);

    // Editable Notice Message for Admin (مستطيل ملاحظة مع صلاحيات تعديل للمدير)
    const defaultNoticeMessage = 'أي تأخير عن الميعاد المحدد سيؤدي إلى خصم ربع يوم. مواعيد العمل من 10 صباحاً إلى 6 مساءً، أو من 11 صباحاً إلى 7 مساءً. لن يتم تسجيل الحضور نهائياً إذا كنت خارج النطاق الجغرافي للفرع.';
    const [noticeMessage, setNoticeMessage] = useState<string>(defaultNoticeMessage);
    const [isEditingNotice, setIsEditingNotice] = useState<boolean>(false);
    const [tempNoticeMessage, setTempNoticeMessage] = useState<string>(defaultNoticeMessage);
    const [isSavingNotice, setIsSavingNotice] = useState<boolean>(false);

    // Custom Employee Schedules (مواعيد الحضور والانصراف المعتمدة لكل موظف)
    const [employeeCustomSchedules, setEmployeeCustomSchedules] = useState<Record<string, { checkInTime: string; checkOutTime: string; approvedAt?: number }>>({});
    const [customScheduleEmpKey, setCustomScheduleEmpKey] = useState<string>('');
    const [customEmpCheckIn, setCustomEmpCheckIn] = useState<string>('10:00');
    const [customEmpCheckOut, setCustomEmpCheckOut] = useState<string>('18:00');

    // اختيار يوم محدد لعرض الحضور والانصراف المسجل به
    const [selectedDayDate, setSelectedDayDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [isSavingCustomSched, setIsSavingCustomSched] = useState<boolean>(false);

    // Check-in & Check-out Action Modal State
    const [showActionModal, setShowActionModal] = useState(false);
    const [actionModalMode, setActionModalMode] = useState<'check_in' | 'check_out'>('check_in');
    const [actionModalSelectedBranch, setActionModalSelectedBranch] = useState<string>('');
    const [branchSelectionError, setBranchSelectionError] = useState<string | null>(null);

    // Helper to strip undefined values so Firebase Realtime Database never throws
    const sanitizeForFirebase = <T,>(data: T): T => {
        if (data === null || data === undefined) return null as unknown as T;
        if (Array.isArray(data)) {
            return data
                .filter(item => item !== undefined)
                .map(item => sanitizeForFirebase(item)) as unknown as T;
        }
        if (typeof data === 'object') {
            const result: Record<string, any> = {};
            for (const [key, value] of Object.entries(data as Record<string, any>)) {
                if (value !== undefined) {
                    result[key] = sanitizeForFirebase(value);
                }
            }
            return result as unknown as T;
        }
        return data;
    };

    // Helper to generate initial 5 slots
    const getInitialFiveSlots = (existingSlots?: EmployeeBranchLocation[]): EmployeeBranchLocation[] => {
        const list: EmployeeBranchLocation[] = existingSlots && existingSlots.length > 0 
            ? existingSlots.map(s => ({ ...s }))
            : [];
        while (list.length < 5) {
            list.push({
                id: `slot_${list.length + 1}_${Math.random().toString(36).substring(2, 7)}`,
                branchName: '',
                coordinates: ''
            });
        }
        return list;
    };

    // Live clock ticker
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Today's date YYYY-MM-DD
    const todayDate = currentTime.toISOString().split('T')[0];

    // Listen to today's attendance & users
    useEffect(() => {
        const attendanceRef = ref(db, `attendance/${todayDate}`);
        const unsubAttendance = onCachedValue(attendanceRef, `attendance_${todayDate}`, (snapshot) => {
            if (snapshot.exists()) {
                setTodayAttendance(snapshot.val() || {});
            } else {
                setTodayAttendance({});
            }
        });

        // Listen to all attendance history for real-time employee cycle stats (التأخيرات والغيابات لحظياً)
        const allAttendanceRef = ref(db, 'attendance');
        const unsubAllAttendance = onCachedValue(allAttendanceRef, 'attendance_all_history', (snapshot) => {
            if (snapshot.exists()) {
                setAllAttendanceHistory(snapshot.val() || {});
            } else {
                setAllAttendanceHistory({});
            }
        });

        const usersRef = ref(db, 'users');
        const unsubUsers = onCachedValue(usersRef, 'users', (snapshot) => {
            if (snapshot.exists()) {
                const list: User[] = [];
                snapshot.forEach((child) => {
                    list.push({ key: child.key!, ...child.val() });
                });
                setUsersList(list);
            } else {
                setUsersList([]);
            }
        });

        // Listen to Admin Schedule settings
        const schedulesRef = ref(db, 'attendance_settings/schedules');
        const unsubSchedules = onCachedValue(schedulesRef, 'attendance_schedules', (snapshot) => {
            if (snapshot.exists()) {
                const val = snapshot.val();
                if (val.checkInTime) setScheduleCheckIn(val.checkInTime);
                if (val.checkOutTime) setScheduleCheckOut(val.checkOutTime);
                if (val.gracePeriodMinutes !== undefined) setGracePeriodMinutes(Number(val.gracePeriodMinutes));
            }
        });

        // Listen to Admin Employee Locations
        const locationsRef = ref(db, 'attendance_settings/employee_locations');
        const unsubLocations = onCachedValue(locationsRef, 'attendance_employee_locations', (snapshot) => {
            if (snapshot.exists()) {
                setAllEmployeeLocations(snapshot.val() || {});
            } else {
                setAllEmployeeLocations({});
            }
        });

        // Listen to Hidden Employees (Show / Hide)
        const hiddenEmployeesRef = ref(db, 'attendance_settings/hidden_employees');
        const unsubHidden = onCachedValue(hiddenEmployeesRef, 'attendance_hidden_employees', (snapshot) => {
            if (snapshot.exists()) {
                setHiddenEmployees(snapshot.val() || {});
            } else {
                setHiddenEmployees({});
            }
        });

        // Listen to System Suspension settings (تعليق النظام / وضع الصيانة)
        const suspensionRef = ref(db, 'attendance_settings/suspension');
        const unsubSuspension = onCachedValue(suspensionRef, 'attendance_suspension', (snapshot) => {
            if (snapshot.exists()) {
                const val = snapshot.val();
                const susp = !!val.isSuspended;
                const days = Number(val.suspensionDays) || 1;
                const endTs = Number(val.targetEndTimestamp) || 0;
                setIsSuspended(susp);
                setSuspensionDays(days);
                setTargetEndTimestamp(endTs);
                try {
                    localStorage.setItem('attendance_is_suspended', JSON.stringify(susp));
                    localStorage.setItem('attendance_suspension_days', String(days));
                    localStorage.setItem('attendance_target_end_timestamp', String(endTs));
                } catch (e) {
                    console.error('LocalStorage write error:', e);
                }
            } else {
                setIsSuspended(false);
                setTargetEndTimestamp(0);
            }
        });

        // Listen to Notice Message (مستطيل ملاحظة للمستخدمين)
        const noticeRef = ref(db, 'attendance_settings/notice_message');
        const unsubNotice = onCachedValue(noticeRef, 'attendance_notice_message', (snapshot) => {
            if (snapshot.exists()) {
                const val = snapshot.val();
                if (typeof val === 'string' && val.trim()) {
                    setNoticeMessage(val);
                    setTempNoticeMessage(val);
                } else if (val?.text) {
                    setNoticeMessage(val.text);
                    setTempNoticeMessage(val.text);
                }
            }
        });

        // Listen to Employee Custom Schedules (مواعيد الموظفين المعتمدة)
        const empSchedulesRef = ref(db, 'attendance_settings/employee_custom_schedules');
        const unsubEmpSchedules = onCachedValue(empSchedulesRef, 'attendance_employee_custom_schedules', (snapshot) => {
            if (snapshot.exists()) {
                setEmployeeCustomSchedules(snapshot.val() || {});
            } else {
                setEmployeeCustomSchedules({});
            }
        });

        // Listen to Attendance System Started status (ابدأ تسجيل الحضور والانصراف)
        const startedRef = ref(db, 'attendance_settings/is_started');
        const unsubStarted = onCachedValue(startedRef, 'attendance_is_started', (snapshot) => {
            if (snapshot.exists()) {
                const val = snapshot.val();
                if (typeof val === 'boolean') {
                    setIsAttendanceStarted(val);
                    setAttendanceStartedInfo({ started: val });
                } else if (typeof val === 'object' && val !== null) {
                    setIsAttendanceStarted(!!val.started);
                    setAttendanceStartedInfo(val);
                } else {
                    setIsAttendanceStarted(false);
                    setAttendanceStartedInfo(null);
                }
            } else {
                setIsAttendanceStarted(false);
                setAttendanceStartedInfo(null);
            }
        });

        return () => {
            unsubAttendance();
            unsubUsers();
            unsubSchedules();
            unsubLocations();
            unsubHidden();
            unsubSuspension();
            unsubNotice();
            unsubEmpSchedules();
            unsubStarted();
        };
    }, [todayDate]);

    // Helper: Check if an employee is hidden from attendance
    const isEmployeeHidden = (emp?: { key?: string; username?: string; isArchived?: boolean } | null): boolean => {
        if (!emp) return false;
        if (emp.isArchived) return true;
        const k1 = emp.key || '';
        const k2 = emp.username || '';
        return !!((k1 && hiddenEmployees[k1]) || (k2 && hiddenEmployees[k2]));
    };

    // Helper: Toggle employee visibility in attendance
    const handleToggleEmployeeVisibility = async (empKey: string) => {
        const currentVal = !!hiddenEmployees[empKey];
        const nextVal = !currentVal;
        const updated = { ...hiddenEmployees, [empKey]: nextVal };
        setHiddenEmployees(updated);
        try {
            await set(ref(db, `attendance_settings/hidden_employees/${empKey}`), nextVal);
        } catch (err) {
            console.error('Error toggling employee visibility:', err);
        }
    };

    // When selected employee changes, update branchSlots
    useEffect(() => {
        if (selectedEmployeeId) {
            const saved = allEmployeeLocations[selectedEmployeeId];
            setBranchSlots(getInitialFiveSlots(saved));
        } else if (usersList.length > 0 && !selectedEmployeeId) {
            const firstKey = usersList[0].key || usersList[0].username;
            setSelectedEmployeeId(firstKey);
            const saved = allEmployeeLocations[firstKey];
            setBranchSlots(getInitialFiveSlots(saved));
        }
    }, [selectedEmployeeId, allEmployeeLocations, usersList]);

    // Format time in 12-hour AM/PM format
    const format12Hour = (date: Date) => {
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        const ampmArabic = hours >= 12 ? 'مساءً' : 'صباحاً';
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        const strHours = hours.toString().padStart(2, '0');

        return {
            time: `${strHours}:${minutes}:${seconds}`,
            ampm,
            ampmArabic,
            fullFormatted: `${strHours}:${minutes}:${seconds} ${ampm} (${ampmArabic})`
        };
    };

    const liveTimeObj = format12Hour(currentTime);

    // Arabic day name
    const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const currentDayName = arabicDays[currentTime.getDay()];

    // System Suspension Mode & Live Countdown calculations
    const nowTimestamp = currentTime.getTime();
    const diffMs = targetEndTimestamp - nowTimestamp;
    const isSystemSuspended = isSuspended && (targetEndTimestamp > 0 ? diffMs > 0 : true);
    const isSuspensionExpired = isSuspended && targetEndTimestamp > 0 && diffMs <= 0;

    const countdown = useMemo(() => {
        if (!isSystemSuspended || diffMs <= 0) {
            return { days: 0, hours: 0, minutes: 0, seconds: 0, formatted: '[0 يوم : 0 ساعة : 0 دقيقة]' };
        }
        const totalSec = Math.floor(diffMs / 1000);
        const days = Math.floor(totalSec / 86400);
        const hours = Math.floor((totalSec % 86400) / 3600);
        const minutes = Math.floor((totalSec % 3600) / 60);
        const seconds = totalSec % 60;
        return {
            days,
            hours,
            minutes,
            seconds,
            formatted: `[${days} يوم : ${hours} ساعة : ${minutes} دقيقة]`
        };
    }, [isSystemSuspended, diffMs]);

    // Current user's identifier
    const userIdentifier = user.key || user.username || 'unknown_user';
    const myRecord = todayAttendance[userIdentifier];

    // Compute branches that have a registered location (coordinates) for this employee
    const employeeLocationBranches = useMemo(() => {
        const branchSet = new Set<string>();
        const userSlots = allEmployeeLocations[userIdentifier] || 
                         (user.key ? allEmployeeLocations[user.key] : null) || 
                         (user.username ? allEmployeeLocations[user.username] : null) || 
                         [];
        userSlots.forEach(s => {
            if (s.branchName && s.branchName.trim() && s.coordinates && s.coordinates.trim()) {
                branchSet.add(s.branchName.trim());
            }
        });
        return Array.from(branchSet);
    }, [allEmployeeLocations, userIdentifier, user]);

    // For check-in actions & dropdowns: only branches with registered location for employee
    const userRegisteredBranches = useMemo(() => {
        if (employeeLocationBranches.length > 0) {
            return employeeLocationBranches;
        }
        // If admin, fallback to markets
        if (user.role === 'admin') {
            return markets;
        }
        return [];
    }, [employeeLocationBranches, user.role, markets]);

    // Calculate employee's real-time delay days & absence days in the current work cycle (من 21 إلى 20)
    const { myCycleLateCount, myCycleAbsentCount } = useMemo(() => {
        const now = currentTime;
        const day = now.getDate();
        let dStart: Date;
        let dEnd: Date;
        if (day >= 21) {
            dStart = new Date(now.getFullYear(), now.getMonth(), 21);
            dEnd = new Date(now.getFullYear(), now.getMonth() + 1, 20);
        } else {
            dStart = new Date(now.getFullYear(), now.getMonth() - 1, 21);
            dEnd = new Date(now.getFullYear(), now.getMonth(), 20);
        }
        const startStr = `${dStart.getFullYear()}-${String(dStart.getMonth() + 1).padStart(2, '0')}-21`;
        const endStr = `${dEnd.getFullYear()}-${String(dEnd.getMonth() + 1).padStart(2, '0')}-20`;

        let lateCount = 0;
        let absentCount = 0;
        const userKeys = [user.key, user.username, userIdentifier].filter(Boolean) as string[];

        Object.entries(allAttendanceHistory).forEach(([dateStr, dayRecords]) => {
            if (dateStr >= startStr && dateStr <= endStr && dayRecords) {
                for (const k of userKeys) {
                    const rec = dayRecords[k];
                    if (rec) {
                        if (rec.isLate) lateCount++;
                        if (rec.status === 'absent' || rec.autoAbsent) absentCount++;
                        break;
                    }
                }
            }
        });

        return { myCycleLateCount: lateCount, myCycleAbsentCount: absentCount };
    }, [allAttendanceHistory, user, userIdentifier, currentTime]);

    // Phase 3: Automatic Absence Rule at 12:00 PM (Skips hidden employees & requires isAttendanceStarted)
    useEffect(() => {
        if (!usersList || usersList.length === 0) return;
        if (!isAttendanceStarted || isSystemSuspended) return;

        const checkAndApplyAutoAbsence = async () => {
            const now = new Date();
            // Only apply automatic absence if at least one employee checked in today
            const hasAnyCheckInToday = Object.values(todayAttendance).some((r: any) => !!r?.checkInTime);
            if (!hasAnyCheckInToday) {
                return;
            }

            // If current time is 12:00 PM or later
            if (now.getHours() >= 12) {
                for (const emp of usersList) {
                    // System admins are not subject to daily branch attendance
                    if (emp.role === 'admin') continue;

                    // Skip employees hidden by management
                    if (isEmployeeHidden(emp)) continue;

                    const empKey = emp.key || emp.username;
                    if (!empKey) continue;

                    const existing = todayAttendance[empKey];
                    // If employee hasn't checked in and isn't already marked absent
                    if (!existing?.checkInTime && existing?.status !== 'absent') {
                        try {
                            const empUsername = emp.username || emp.key || empKey;
                            const empName = emp.name || emp.username || empKey;
                            const absentRecord: AttendanceRecord = {
                                userId: emp.key || empKey,
                                username: empUsername,
                                employeeName: empName,
                                branchName: (emp.assignedMarkets && emp.assignedMarkets[0]) || 'الفرع الرئيسي',
                                date: todayDate,
                                status: 'absent',
                                autoAbsent: true,
                                note: 'غياب تلقائي (تجاوز الساعة 12:00 ظهراً دون تسجيل حضور)'
                            };
                            await set(ref(db, `attendance/${todayDate}/${empKey}`), sanitizeForFirebase(absentRecord));
                        } catch (err) {
                            console.error('Error applying auto absence:', err);
                        }
                    }
                }
            }
        };

        checkAndApplyAutoAbsence();
    }, [todayDate, usersList, todayAttendance, hiddenEmployees, isAttendanceStarted, isSystemSuspended]);

    // Handle "تسجيل الحضور" and "حضور بريك" with branch & GPS validation
    const handleCheckIn = async (branchOverride?: string, checkType: 'regular' | 'break' = 'regular') => {
        if (!isAttendanceStarted) {
            setActionMessage({
                type: 'error',
                text: 'لم يتم بدء تسجيل الحضور والانصراف من الإدارة بعد! يرجى الانتظار حتى تفعيل التسجيل.'
            });
            setShowActionModal(false);
            return;
        }

        setIsSubmitting(true);
        setActionMessage(null);
        try {
            const userBranch = branchOverride || (user.assignedMarkets && user.assignedMarkets.length > 0
                ? user.assignedMarkets[0]
                : (markets[0] || 'الفرع الرئيسي'));

            const recordRef = ref(db, `attendance/${todayDate}/${userIdentifier}`);
            
            if (checkType === 'regular' && myRecord?.checkInTime) {
                setActionMessage({
                    type: 'info',
                    text: `لقد تم تسجيل حضورك مسبقاً اليوم في تمام الساعة: ${myRecord.checkInTime}`
                });
                setIsSubmitting(false);
                setShowActionModal(false);
                return;
            }

            // Phase 4: Geolocation Geofencing & Anti-Fake GPS Verification
            const employeeSavedSlots = allEmployeeLocations[userIdentifier] || 
                                       (user.key ? allEmployeeLocations[user.key] : null) || 
                                       (user.username ? allEmployeeLocations[user.username] : null) || 
                                       [];

            const geoValidation = await validateEmployeeGeofence(employeeSavedSlots, userBranch);

            if (!geoValidation.success) {
                // Suspicion of Fake Location: Stop check-in and notify admin immediately!
                if (geoValidation.isFakeSuspected) {
                    try {
                        const alertRef = ref(db, 'notifications/admin_alerts');
                        await push(alertRef, sanitizeForFirebase({
                            message: `اشتباه: الموظف ${user.name || user.username || 'موظف'} يحاول استخدام برامج Fake Location`,
                            sender: user.name || user.username || 'System',
                            timestamp: Date.now(),
                            isRead: false,
                            dateString: todayDate,
                            type: 'admin_alert',
                            actionType: 'fake_location_suspected',
                            reason: geoValidation.fakeReason || 'اشتباه في تزييف الموقع الجغرافي'
                        }));
                    } catch (err) {
                        console.error('Error sending admin alert for fake location:', err);
                    }

                    setActionMessage({
                        type: 'error',
                        text: 'اشتباه: تم رصد محاولة استخدام برنامج Fake Location. تم إيقاف التسجيل وإرسال تنبيه للإدارة.'
                    });
                    setIsSubmitting(false);
                    return;
                }

                // Geofence violation (> 1000 meters) or GPS error
                setActionMessage({
                    type: 'error',
                    text: geoValidation.errorMessage || 'عفواً، أنت لست في إطار الفرع.'
                });
                setIsSubmitting(false);
                return;
            }

            const now = new Date();
            const formattedTime = format12Hour(now);
            const timeStr = `${formattedTime.time} ${formattedTime.ampm}`;

            // Check if Break Return
            if (checkType === 'break') {
                const noteText = myRecord?.note ? `${myRecord.note} | حضور بريك (${timeStr})` : `حضور بريك (${timeStr})`;
                if (myRecord) {
                    await update(recordRef, sanitizeForFirebase({
                        branchName: userBranch,
                        status: 'present',
                        note: noteText,
                        distanceMeters: geoValidation.distanceMeters,
                        locationCoords: geoValidation.userCoords ? `${geoValidation.userCoords.lat.toFixed(6)}, ${geoValidation.userCoords.lon.toFixed(6)}` : undefined
                    }));
                } else {
                    const newRecord: AttendanceRecord = {
                        userId: user.key || user.username || userIdentifier,
                        username: user.username || user.key || userIdentifier,
                        employeeName: user.name || user.username || userIdentifier,
                        branchName: userBranch,
                        date: todayDate,
                        checkInTime: timeStr,
                        checkInTimestamp: now.getTime(),
                        status: 'present',
                        note: 'حضور بريك',
                        distanceMeters: geoValidation.distanceMeters,
                        locationCoords: geoValidation.userCoords ? `${geoValidation.userCoords.lat.toFixed(6)}, ${geoValidation.userCoords.lon.toFixed(6)}` : undefined
                    };
                    await set(recordRef, sanitizeForFirebase(newRecord));
                }

                setActionMessage({
                    type: 'success',
                    text: `تم تسجيل حضور البريك بنجاح في تمام الساعة ${timeStr} بالفرع: ${userBranch}`
                });
                setShowActionModal(false);
                return;
            }

            // Regular Check-In: Delay calculation based on custom approved schedule or scheduleCheckIn and gracePeriodMinutes
            let isLate = false;
            let delayMinutes = 0;
            const empCustomSched = employeeCustomSchedules[userIdentifier] || 
                                   (user.key ? employeeCustomSchedules[user.key] : null) || 
                                   (user.username ? employeeCustomSchedules[user.username] : null);
            const targetCheckInTime = empCustomSched?.checkInTime || scheduleCheckIn || '10:00';
            const [schedH, schedM] = targetCheckInTime.split(':').map(Number);
            if (!isNaN(schedH) && !isNaN(schedM)) {
                const scheduledDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), schedH, schedM, 0, 0);
                const cutoffTime = scheduledDate.getTime() + (Number(gracePeriodMinutes) || 0) * 60 * 1000;
                
                if (now.getTime() > cutoffTime) {
                    isLate = true;
                    delayMinutes = Math.max(1, Math.round((now.getTime() - scheduledDate.getTime()) / (60 * 1000)));
                }
            }

            const newRecord: AttendanceRecord = {
                userId: user.key || user.username || userIdentifier,
                username: user.username || user.key || userIdentifier,
                employeeName: user.name || user.username || userIdentifier,
                branchName: userBranch,
                date: todayDate,
                checkInTime: timeStr,
                checkInTimestamp: now.getTime(),
                status: 'present',
                isLate: isLate,
                delayPenalty: isLate ? 'خصم ربع يوم' : undefined,
                penaltyAmount: isLate ? 0.25 : 0,
                note: isLate ? `تأخير ${delayMinutes} دقيقة - خصم ربع يوم` : undefined,
                distanceMeters: geoValidation.distanceMeters,
                locationCoords: geoValidation.userCoords ? `${geoValidation.userCoords.lat.toFixed(6)}, ${geoValidation.userCoords.lon.toFixed(6)}` : undefined
            };

            await set(recordRef, sanitizeForFirebase(newRecord));
            setShowActionModal(false);

            if (isLate) {
                setActionMessage({
                    type: 'error',
                    text: `تم تسجيل ميعادك بـ (${timeStr}) بالفرع (${userBranch})، تأخير! خصم ربع يوم.`
                });
            } else {
                setActionMessage({
                    type: 'success',
                    text: `تم تسجيل الحضور بنجاح في تمام الساعة ${timeStr} بالفرع: ${userBranch}`
                });
            }
        } catch (error: any) {
            console.error('Error during check-in:', error);
            setActionMessage({
                type: 'error',
                text: error?.message || 'حدث خطأ أثناء تسجيل الحضور، يرجى المحاولة مرة أخرى.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Handle "تسجيل الانصراف" with Geofencing & Anti-Fake GPS Verification
    const handleCheckOut = async (branchOverride?: string) => {
        if (!isAttendanceStarted) {
            setActionMessage({
                type: 'error',
                text: 'لم يتم بدء تسجيل الحضور والانصراف من الإدارة بعد! يرجى الانتظار حتى تفعيل التسجيل.'
            });
            setShowActionModal(false);
            return;
        }

        setIsSubmitting(true);
        setActionMessage(null);
        try {
            const recordRef = ref(db, `attendance/${todayDate}/${userIdentifier}`);

            if (!myRecord?.checkInTime) {
                setActionMessage({
                    type: 'error',
                    text: 'يجب تسجيل الحضور أولاً قبل تسجيل الانصراف!'
                });
                setIsSubmitting(false);
                setShowActionModal(false);
                return;
            }

            if (myRecord?.checkOutTime) {
                setActionMessage({
                    type: 'info',
                    text: `لقد تم تسجيل انصرافك مسبقاً اليوم في تمام الساعة: ${myRecord.checkOutTime}`
                });
                setIsSubmitting(false);
                setShowActionModal(false);
                return;
            }

            const userBranch = branchOverride || myRecord.branchName || 
                               ((user.assignedMarkets && user.assignedMarkets.length > 0) ? user.assignedMarkets[0] : (markets[0] || 'الفرع الرئيسي'));

            // Phase 4: Geolocation Geofencing & Anti-Fake GPS
            const employeeSavedSlots = allEmployeeLocations[userIdentifier] || 
                                       (user.key ? allEmployeeLocations[user.key] : null) || 
                                       (user.username ? allEmployeeLocations[user.username] : null) || 
                                       [];

            const geoValidation = await validateEmployeeGeofence(employeeSavedSlots, userBranch);

            if (!geoValidation.success) {
                // Suspicion of Fake Location: Stop checkout and notify admin!
                if (geoValidation.isFakeSuspected) {
                    try {
                        const alertRef = ref(db, 'notifications/admin_alerts');
                        await push(alertRef, sanitizeForFirebase({
                            message: `اشتباه: الموظف ${user.name || user.username || 'موظف'} يحاول استخدام برامج Fake Location`,
                            sender: user.name || user.username || 'System',
                            timestamp: Date.now(),
                            isRead: false,
                            dateString: todayDate,
                            type: 'admin_alert',
                            actionType: 'fake_location_suspected',
                            reason: geoValidation.fakeReason || 'اشتباه في تزييف الموقع أثناء الانصراف'
                        }));
                    } catch (err) {
                        console.error('Error sending admin alert for fake location:', err);
                    }

                    setActionMessage({
                        type: 'error',
                        text: 'اشتباه: تم رصد محاولة استخدام برنامج Fake Location. تم إيقاف التسجيل وإرسال تنبيه للإدارة.'
                    });
                    setIsSubmitting(false);
                    return;
                }

                // Geofence violation (> 1000 meters) or GPS error
                setActionMessage({
                    type: 'error',
                    text: geoValidation.errorMessage || 'عفواً، أنت لست في إطار الفرع.'
                });
                setIsSubmitting(false);
                return;
            }

            const now = new Date();
            const formattedTime = format12Hour(now);
            const timeStr = `${formattedTime.time} ${formattedTime.ampm}`;

            await update(recordRef, sanitizeForFirebase({
                checkOutTime: timeStr,
                checkOutTimestamp: now.getTime(),
                status: 'departed',
                branchName: userBranch,
                distanceMeters: geoValidation.distanceMeters,
                locationCoords: geoValidation.userCoords ? `${geoValidation.userCoords.lat.toFixed(6)}, ${geoValidation.userCoords.lon.toFixed(6)}` : undefined
            }));

            setActionMessage({
                type: 'success',
                text: `تم تسجيل الانصراف بنجاح في تمام الساعة ${timeStr} بالفرع: ${userBranch}`
            });
            setShowActionModal(false);
        } catch (error: any) {
            console.error('Error during check-out:', error);
            setActionMessage({
                type: 'error',
                text: error?.message || 'حدث خطأ أثناء تسجيل الانصراف، يرجى المحاولة مرة أخرى.'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Execute attendance action from modal with branch confirmation
    const executeAttendanceAction = (actionType: 'check_in' | 'break_return' | 'check_out') => {
        if (!actionModalSelectedBranch || !actionModalSelectedBranch.trim()) {
            setBranchSelectionError('يرجى تحديد الفرع أولاً قبل تسجيل الحضور أو الانصراف!');
            return;
        }
        setBranchSelectionError(null);

        if (actionType === 'check_in') {
            handleCheckIn(actionModalSelectedBranch, 'regular');
        } else if (actionType === 'break_return') {
            handleCheckIn(actionModalSelectedBranch, 'break');
        } else if (actionType === 'check_out') {
            handleCheckOut(actionModalSelectedBranch);
        }
    };

    // Phase 2: Add dynamic branch slot
    const handleAddSlot = () => {
        setBranchSlots(prev => [
            ...prev,
            {
                id: `slot_${prev.length + 1}_${Date.now()}`,
                branchName: '',
                coordinates: ''
            }
        ]);
    };

    // Phase 2: Remove branch slot (if above 5 slots or reset)
    const handleRemoveSlot = (index: number) => {
        if (branchSlots.length <= 5) {
            // If 5 or fewer, clear fields instead of removing
            setBranchSlots(prev => {
                const updated = [...prev];
                updated[index] = { ...updated[index], branchName: '', coordinates: '' };
                return updated;
            });
        } else {
            setBranchSlots(prev => prev.filter((_, i) => i !== index));
        }
    };

    // Phase 2: Update slot field
    const handleUpdateSlotField = (index: number, field: 'branchName' | 'coordinates', value: string) => {
        setBranchSlots(prev => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    // Phase 2: Capture device coordinates helper
    const handleGetDeviceCoordinates = (index: number) => {
        if (!navigator.geolocation) {
            alert("خاصية تحديد الموقع الجغرافي غير مدعومة في متصفحك");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const coords = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
                handleUpdateSlotField(index, 'coordinates', coords);
            },
            (err) => {
                alert(`تعذر جلب الموقع الجغرافي: ${err.message}`);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // Helper to save System Suspension Settings (تعليق النظام / وضع الصيانة)
    const handleSaveSuspensionSettings = async (suspendedOverride?: boolean, daysOverride?: number) => {
        setIsSavingSettings(true);
        setSettingsSaveMsg(null);
        try {
            const nextSuspended = suspendedOverride !== undefined ? suspendedOverride : isSuspended;
            const daysNum = Math.max(1, Number(daysOverride !== undefined ? daysOverride : suspensionDays) || 1);
            let calculatedEnd = 0;
            if (nextSuspended) {
                calculatedEnd = Date.now() + (daysNum * 24 * 60 * 60 * 1000);
                setTargetEndTimestamp(calculatedEnd);
            } else {
                setTargetEndTimestamp(0);
            }
            const payload = {
                isSuspended: nextSuspended,
                suspensionDays: daysNum,
                targetEndTimestamp: nextSuspended ? calculatedEnd : 0,
                updatedAt: Date.now(),
                updatedBy: user.name || user.username || 'Admin'
            };
            await set(ref(db, 'attendance_settings/suspension'), sanitizeForFirebase(payload));
            try {
                localStorage.setItem('attendance_is_suspended', JSON.stringify(nextSuspended));
                localStorage.setItem('attendance_suspension_days', String(daysNum));
                localStorage.setItem('attendance_target_end_timestamp', String(payload.targetEndTimestamp));
            } catch (e) {
                console.error('LocalStorage write error:', e);
            }
            setSettingsSaveMsg(nextSuspended ? "تم تعليق التسجيل وحساب العداد التنازلي بنجاح!" : "تم فتح تسجيل الحضور والانصراف بنجاح!");
            setTimeout(() => setSettingsSaveMsg(null), 3500);
        } catch (error) {
            console.error("Error saving suspension settings:", error);
            alert("حدث خطأ أثناء حفظ حالة تعليق النظام، يرجى المحاولة مجدداً.");
        } finally {
            setIsSavingSettings(false);
        }
    };

    // Start Attendance System (ابدأ تسجيل الحضور والانصراف مع تصفير أي تسجيل عشوائي)
    const handleStartAttendanceSystem = async () => {
        setIsSavingSettings(true);
        try {
            // Delete random/previous attendance from the system
            await set(ref(db, 'attendance'), null);
            // Mark started in settings
            const payload = {
                started: true,
                startedAt: Date.now(),
                startedBy: user.name || user.username || 'Admin'
            };
            await set(ref(db, 'attendance_settings/is_started'), sanitizeForFirebase(payload));
            setIsAttendanceStarted(true);
            setAttendanceStartedInfo(payload);
            setTodayAttendance({});
            setAllAttendanceHistory({});
            setSettingsSaveMsg("تم بنجاح بدء تسجيل الحضور والانصراف ومسح أي تسجيلات عشوائية سابقة!");
            setActionMessage({
                type: 'success',
                text: "تم بنجاح بدء تسجيل الحضور والانصراف وتصفير أي تسجيلات سابقة!"
            });
            setTimeout(() => setSettingsSaveMsg(null), 4000);
        } catch (e: any) {
            console.error("Error starting attendance:", e);
            setActionMessage({
                type: 'error',
                text: "حدث خطأ أثناء بدء تسجيل الحضور والانصراف: " + (e?.message || '')
            });
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handleStopAttendanceSystem = async () => {
        setIsSavingSettings(true);
        try {
            const payload = {
                started: false,
                stoppedAt: Date.now(),
                stoppedBy: user.name || user.username || 'Admin'
            };
            await set(ref(db, 'attendance_settings/is_started'), sanitizeForFirebase(payload));
            setIsAttendanceStarted(false);
            setAttendanceStartedInfo(payload);
            setSettingsSaveMsg("تم إيقاف تسجيل الحضور والانصراف بنجاح.");
            setActionMessage({
                type: 'info',
                text: "تم إيقاف تسجيل الحضور والانصراف مؤقتاً."
            });
            setTimeout(() => setSettingsSaveMsg(null), 4000);
        } catch (e) {
            console.error(e);
        } finally {
            setIsSavingSettings(false);
        }
    };

    const handlePurgeRandomAttendance = async () => {
        setIsSavingSettings(true);
        try {
            await set(ref(db, 'attendance'), null);
            setTodayAttendance({});
            setAllAttendanceHistory({});
            setSettingsSaveMsg("تم تصفير وحذف جميع السجلات العشوائية السابقة بنجاح!");
            setActionMessage({
                type: 'success',
                text: "تم تصفير وحذف جميع السجلات العشوائية السابقة بنجاح!"
            });
            setTimeout(() => setSettingsSaveMsg(null), 4000);
        } catch (e: any) {
            console.error(e);
            setActionMessage({
                type: 'error',
                text: "حدث خطأ أثناء حذف السجلات: " + (e?.message || '')
            });
        } finally {
            setIsSavingSettings(false);
        }
    };

    // Phase 2: Save Admin Settings
    const handleSaveSettings = async () => {
        setIsSavingSettings(true);
        setSettingsSaveMsg(null);
        try {
            if (activeTab === 'schedules') {
                await set(ref(db, 'attendance_settings/schedules'), sanitizeForFirebase({
                    checkInTime: scheduleCheckIn,
                    checkOutTime: scheduleCheckOut,
                    gracePeriodMinutes: Number(gracePeriodMinutes) || 0,
                    updatedAt: Date.now(),
                    updatedBy: user.name || user.username || 'Admin'
                }));
                setSettingsSaveMsg("تم حفظ مواعيد العمل وفترة السماح بنجاح!");
            } else if (activeTab === 'locations') {
                if (!selectedEmployeeId) {
                    alert("يرجى اختيار الموظف أولاً");
                    setIsSavingSettings(false);
                    return;
                }
                await set(ref(db, `attendance_settings/employee_locations/${selectedEmployeeId}`), sanitizeForFirebase(branchSlots));
                setSettingsSaveMsg("تم حفظ الفروع وإحداثيات اللوكيشن للموظف بنجاح!");
            } else if (activeTab === 'employees') {
                await set(ref(db, 'attendance_settings/hidden_employees'), sanitizeForFirebase(hiddenEmployees));
                setSettingsSaveMsg("تم حفظ إعدادات ظهور وإخفاء العاملين بنجاح!");
            } else if (activeTab === 'advanced') {
                await handleSaveSuspensionSettings();
                return;
            }
            setTimeout(() => setSettingsSaveMsg(null), 3500);
        } catch (error) {
            console.error("Error saving admin settings:", error);
            alert("حدث خطأ أثناء حفظ الإعدادات، يرجى المحاولة مجدداً.");
        } finally {
            setIsSavingSettings(false);
        }
    };

    // Helper: Save Notice Message (حفظ رسالة الملاحظة للمدير)
    const handleSaveNoticeMessage = async () => {
        setIsSavingNotice(true);
        try {
            const msgToSave = tempNoticeMessage.trim() || defaultNoticeMessage;
            await set(ref(db, 'attendance_settings/notice_message'), msgToSave);
            setNoticeMessage(msgToSave);
            setIsEditingNotice(false);
            setActionMessage({
                type: 'success',
                text: 'تم تحديث وحفظ رسالة الملاحظة للمستخدمين بنجاح!'
            });
        } catch (e) {
            console.error('Error saving notice message:', e);
            alert('حدث خطأ أثناء حفظ رسالة الملاحظة');
        } finally {
            setIsSavingNotice(false);
        }
    };

    // Helper: Save/Approve Employee Custom Schedule (اعتماد وحفظ ميعاد الموظف)
    const handleSaveEmployeeSchedule = async (empKeyToSave: string, inTime: string, outTime: string) => {
        if (!empKeyToSave) return;
        setIsSavingCustomSched(true);
        try {
            const updated = {
                ...employeeCustomSchedules,
                [empKeyToSave]: {
                    checkInTime: inTime,
                    checkOutTime: outTime,
                    approvedAt: Date.now()
                }
            };
            setEmployeeCustomSchedules(updated);
            await set(ref(db, `attendance_settings/employee_custom_schedules/${empKeyToSave}`), sanitizeForFirebase({
                checkInTime: inTime,
                checkOutTime: outTime,
                approvedAt: Date.now()
            }));
            setSettingsSaveMsg('تم اعتماد وحفظ مواعيد الموظف بنجاح!');
            setTimeout(() => setSettingsSaveMsg(null), 3000);
        } catch (e) {
            console.error('Error saving employee custom schedule:', e);
            alert('حدث خطأ أثناء حفظ ميعاد الموظف');
        } finally {
            setIsSavingCustomSched(false);
        }
    };

    // Helper: Remove Employee Custom Schedule (إلغاء الميعاد المخصص والعودة للعام)
    const handleRemoveEmployeeSchedule = async (empKeyToRemove: string) => {
        try {
            const updated = { ...employeeCustomSchedules };
            delete updated[empKeyToRemove];
            setEmployeeCustomSchedules(updated);
            await set(ref(db, `attendance_settings/employee_custom_schedules/${empKeyToRemove}`), null);
            setSettingsSaveMsg('تم إلغاء الميعاد المخصص والعودة للمواعيد العامة.');
            setTimeout(() => setSettingsSaveMsg(null), 3000);
        } catch (e) {
            console.error('Error removing employee schedule:', e);
        }
    };

    // Phase 3: Stats calculations
    const isPastNoon = currentTime.getHours() >= 12;

    const activeDayDate = selectedDayDate || todayDate;
    const currentDayAttendance = (activeDayDate === todayDate ? todayAttendance : allAttendanceHistory[activeDayDate]) || {};

    const attendanceDatesList = useMemo(() => {
        const set = new Set<string>();
        set.add(todayDate);
        Object.keys(allAttendanceHistory || {}).forEach(k => {
            if (/^\d{4}-\d{2}-\d{2}$/.test(k)) {
                set.add(k);
            }
        });
        return Array.from(set).sort().reverse();
    }, [allAttendanceHistory, todayDate]);

    // Handlers for Reset All Attendance and Delete Single Attendance
    const handleResetAllAttendance = async () => {
        const confirmMsg = `تأكيد تصفير الحضور والانصراف:\nهل أنت متأكد من تصفير ومسح سجل الحضور والانصراف بالكامل المسجل ليوم (${activeDayDate})؟\nهذا الإجراء سيقوم بحذف كافة تسجيلات الحضور والانصراف لهذا اليوم.`;
        if (window.confirm(confirmMsg)) {
            try {
                await set(ref(db, `attendance/${activeDayDate}`), null);
                alert(`تم تصفير سجل الحضور والانصراف ليوم (${activeDayDate}) بنجاح.`);
            } catch (e) {
                console.error(e);
                alert("حدث خطأ أثناء تصفير السجل");
            }
        }
    };

    const handleDeleteSingleAttendance = async (empKey: string, empName: string) => {
        if (window.confirm(`هل أنت متأكد من حذف تسجيل الحضور والانصراف للموظف "${empName}" ليوم (${activeDayDate})؟`)) {
            try {
                await set(ref(db, `attendance/${activeDayDate}/${empKey}`), null);
                alert(`تم حذف تسجيل "${empName}" بنجاح.`);
            } catch (e) {
                console.error(e);
                alert("حدث خطأ أثناء الحذف");
            }
        }
    };

    // PDF Export for Daily Attendance List (تصدير الحضور والانصراف الحالي أو أي يوم محدد)
    const [isExportingAttendancePDF, setIsExportingAttendancePDF] = useState(false);
    const attendancePrintContainerRef = React.useRef<HTMLDivElement>(null);

    const handleDownloadAttendanceDailyPDF = async () => {
        if (!attendancePrintContainerRef.current) return;
        setIsExportingAttendancePDF(true);
        try {
            const container = attendancePrintContainerRef.current;
            container.style.display = 'block';
            await new Promise(r => setTimeout(r, 200));

            const canvas = await html2canvas(container, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                windowWidth: 1200
            });

            container.style.display = 'none';

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
                    if (heightLeft > 0) pdf.addPage();
                }
            } else {
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }

            const branchLabel = selectedBranch !== 'all' ? `_فرع_${selectedBranch}` : '';
            pdf.save(`سجل_الحضور_اليومي_${activeDayDate}${branchLabel}.pdf`);
        } catch (error) {
            console.error('PDF error:', error);
            alert('حدث خطأ أثناء تصدير ملف PDF، يرجى المحاولة مرة أخرى.');
        } finally {
            setIsExportingAttendancePDF(false);
        }
    };

    // Filter visible employees (exclude hidden ones and archived accounts from attendance lists)
    const visibleUsers = usersList.filter(u => !isEmployeeHidden(u) && !u.isArchived);

    // Combine users and attendance for real-time list
    const combinedEmployeeList = visibleUsers.map((emp) => {
        const empKey = emp.key || emp.username;
        const att = currentDayAttendance[empKey];
        const isLate = !!att?.isLate;
        const isAbsent = att?.status === 'absent' || (!att?.checkInTime && (isPastNoon || !!att?.autoAbsent));

        return {
            key: empKey,
            name: emp.name || emp.username || 'موظف',
            username: emp.username || '',
            role: emp.role,
            assignedMarkets: emp.assignedMarkets || [],
            checkInTime: att?.checkInTime || null,
            checkInTimestamp: att?.checkInTimestamp || (att?.checkInTime ? new Date(`1970/01/01 ${att.checkInTime}`).getTime() : 0),
            checkOutTime: att?.checkOutTime || null,
            status: att?.status || (att?.checkInTime ? 'present' : isAbsent ? 'absent' : 'pending'),
            branch: att?.branchName || (emp.assignedMarkets?.[0] || 'غير محدد'),
            isLate,
            delayPenalty: att?.delayPenalty,
            penaltyAmount: att?.penaltyAmount,
            autoAbsent: !!att?.autoAbsent || (!att?.checkInTime && isPastNoon),
            distanceMeters: att?.distanceMeters,
            locationCoords: att?.locationCoords
        };
    });

    Object.keys(currentDayAttendance).forEach((key) => {
        // Skip hidden employees or archived employees from appearing in the attendance list
        if (hiddenEmployees[key]) return;
        const matchingUser = usersList.find((u) => u.key === key || u.username === key);
        if (matchingUser && (isEmployeeHidden(matchingUser) || matchingUser.isArchived)) return;

        if (!combinedEmployeeList.some((e) => e.key === key)) {
            const att = currentDayAttendance[key];
            const isLate = !!att?.isLate;
            const isAbsent = att?.status === 'absent' || (!att?.checkInTime && (isPastNoon || !!att?.autoAbsent));
            combinedEmployeeList.push({
                key,
                name: att.employeeName || att.username || key || 'موظف',
                username: att.username || key || '',
                role: 'employee',
                assignedMarkets: att.branchName ? [att.branchName] : [],
                checkInTime: att.checkInTime || null,
                checkInTimestamp: att.checkInTimestamp || (att.checkInTime ? new Date(`1970/01/01 ${att.checkInTime}`).getTime() : 0),
                checkOutTime: att.checkOutTime || null,
                status: att.status || (att.checkInTime ? 'present' : isAbsent ? 'absent' : 'pending'),
                branch: att.branchName || 'غير محدد',
                isLate,
                delayPenalty: att.delayPenalty,
                penaltyAmount: att.penaltyAmount,
                autoAbsent: !!att.autoAbsent || (!att.checkInTime && isPastNoon),
                distanceMeters: att.distanceMeters,
                locationCoords: att.locationCoords
            });
        }
    });

    // Requirement: يظهر فقط الذي سجل حضور ويكون بالترتيب الاول يبتدي ب رقم 1 و الثاني رقم 2 وهاكذا
    const checkedInEmployees = combinedEmployeeList.filter(emp => !!emp.checkInTime);

    // Sort chronologically by check-in time / timestamp so earliest check-in is #1
    checkedInEmployees.sort((a, b) => {
        if (a.checkInTimestamp && b.checkInTimestamp && a.checkInTimestamp !== b.checkInTimestamp) {
            return a.checkInTimestamp - b.checkInTimestamp;
        }
        return (a.checkInTime || '').localeCompare(b.checkInTime || '');
    });

    // Filter employees by search & branch
    const filteredEmployees = checkedInEmployees.filter((emp) => {
        const empName = emp.name || emp.username || '';
        const empUsername = emp.username || '';
        const matchesSearch = !searchQuery.trim() || 
            empName.toLowerCase().includes(searchQuery.toLowerCase()) ||
            empUsername.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesBranch = selectedBranch === 'all' || 
            emp.branch === selectedBranch || 
            (emp.assignedMarkets && emp.assignedMarkets.includes(selectedBranch));
        return matchesSearch && matchesBranch;
    });

    // Phase 3: Stats
    const totalEmployees = combinedEmployeeList.length;
    const totalPresent = combinedEmployeeList.filter(e => !!e.checkInTime).length;
    const totalOnTime = combinedEmployeeList.filter(e => !!e.checkInTime && !e.isLate).length;
    const totalLate = combinedEmployeeList.filter(e => !!e.checkInTime && !!e.isLate).length;
    const totalAbsent = combinedEmployeeList.filter(e => e.status === 'absent' || (!e.checkInTime && (isPastNoon || e.autoAbsent))).length;
    const totalDeparted = combinedEmployeeList.filter(e => !!e.checkOutTime).length;
    const attendancePercentage = totalEmployees > 0 ? Math.round((totalPresent / totalEmployees) * 100) : 0;

    return (
        <div className="space-y-6">
            {/* Phase 3: Admin Daily Mini Summary (ملخص يومي مصغر للمدير) */}
            {!isSystemSuspended && user.role === 'admin' && (
                <div className="bg-gray-900/90 border border-blue-500/30 rounded-3xl p-5 shadow-2xl backdrop-blur-md relative overflow-hidden">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10 mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                                <BarChart2 size={18} />
                            </div>
                            <div>
                                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                                    <span>ملخص الحضور والغياب اليومي</span>
                                    <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/30 font-bold">
                                        لوحة تحكم المدير
                                    </span>
                                </h3>
                                <p className="text-[11px] text-gray-400 font-semibold">متابعة لحظية لمؤشرات انضباط وتواجد الموظفين اليوم</p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 text-xs font-mono font-bold bg-white/5 px-3 py-1.5 rounded-xl border border-white/5 text-gray-300">
                            <Calendar size={13} className="text-blue-400" />
                            <span>{todayDate}</span>
                            <span className="text-white/30">•</span>
                            <span className="text-emerald-400">{attendancePercentage}% نسبة الحضور</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-1 sm:gap-2.5 w-full overflow-hidden">
                        {/* 1. حضور */}
                        <div className="bg-gradient-to-br from-emerald-500/15 to-emerald-600/5 border border-emerald-500/25 p-1.5 sm:p-3 rounded-xl sm:rounded-2xl flex items-center justify-between shadow-sm min-w-0">
                            <div className="min-w-0">
                                <span className="text-[10px] sm:text-xs font-bold text-emerald-300 block mb-0.5 truncate">حضور</span>
                                <div className="flex items-baseline gap-0.5 sm:gap-1">
                                    <span className="text-base sm:text-2xl font-black text-white font-mono">{totalPresent}</span>
                                    <span className="text-[8px] sm:text-[11px] text-gray-400 hidden xs:inline">/ {totalEmployees}</span>
                                </div>
                            </div>
                            <div className="p-1 sm:p-2 rounded-lg sm:rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0">
                                <UserCheck size={14} className="sm:w-5 sm:h-5" />
                            </div>
                        </div>

                        {/* 2. الانصراف */}
                        <div className="bg-gradient-to-br from-purple-500/15 to-purple-600/5 border border-purple-500/25 p-1.5 sm:p-3 rounded-xl sm:rounded-2xl flex items-center justify-between shadow-sm min-w-0">
                            <div className="min-w-0">
                                <span className="text-[10px] sm:text-xs font-bold text-purple-300 block mb-0.5 truncate">الانصراف</span>
                                <div className="flex items-baseline gap-0.5 sm:gap-1">
                                    <span className="text-base sm:text-2xl font-black text-white font-mono">{totalDeparted}</span>
                                    <span className="text-[8px] sm:text-[10px] text-purple-300 font-bold hidden xs:inline">مكتمل</span>
                                </div>
                            </div>
                            <div className="p-1 sm:p-2 rounded-lg sm:rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 shrink-0">
                                <LogOut size={14} className="sm:w-5 sm:h-5" />
                            </div>
                        </div>

                        {/* 3. التاخير */}
                        <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/40 p-1.5 sm:p-3 rounded-xl sm:rounded-2xl flex items-center justify-between shadow-sm min-w-0">
                            <div className="min-w-0">
                                <span className="text-[10px] sm:text-xs font-black text-red-300 block mb-0.5 truncate">التاخير</span>
                                <div className="flex items-baseline gap-0.5 sm:gap-1">
                                    <span className="text-base sm:text-2xl font-black text-red-100 font-mono">{totalLate}</span>
                                    <span className="text-[8px] sm:text-[10px] text-red-400 font-bold hidden xs:inline">خصم</span>
                                </div>
                            </div>
                            <div className="p-1 sm:p-2 rounded-lg sm:rounded-xl bg-red-500/25 text-red-300 border border-red-500/30 shrink-0">
                                <AlertTriangle size={14} className="sm:w-5 sm:h-5" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Top Header Card with Live Clock */}
            <div className="bg-gradient-to-r from-gray-900 via-gray-850 to-gray-900 p-6 md:p-8 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md relative overflow-hidden">
                {/* Decorative background ambient glow */}
                <div className="absolute top-0 right-1/4 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-1/4 w-72 h-72 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

                {/* زر السجل - متاح للمدير (admin فقط) */}
                {!isSystemSuspended && user.role === 'admin' && (
                    <button
                        onClick={() => setShowRecordsModal(true)}
                        className="absolute top-5 right-5 md:top-6 md:right-6 p-2.5 sm:px-4 sm:py-2.5 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border border-blue-400/30 transition-all shadow-lg shadow-blue-600/25 active:scale-95 flex items-center gap-2 cursor-pointer z-20 group font-bold text-xs sm:text-sm"
                        title="سجل الحضور والانصراف والتقارير والملخصات"
                    >
                        <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-blue-200 group-hover:scale-110 transition-transform" />
                        <span>السجل</span>
                    </button>
                )}

                {/* Phase 2: Settings Gear Icon - Exclusively for Admin */}
                {user.role === 'admin' && (
                    <button
                        onClick={() => setShowAdminSettings(true)}
                        className="absolute top-5 left-5 md:top-6 md:left-6 p-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white border border-white/10 hover:border-white/25 transition-all shadow-lg active:scale-95 flex items-center gap-2 cursor-pointer z-20 group"
                        title="إعدادات الحضور والانصراف (للمدير فقط)"
                    >
                        <SettingsIcon className="w-5 h-5 text-gray-300 group-hover:rotate-90 transition-transform duration-300" />
                        <span className="text-xs font-bold hidden sm:inline text-gray-200">الإعدادات</span>
                    </button>
                )}

                <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                    {/* Live Indicator Badge */}
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>الوقت الحالي لحظياً (Live Clock)</span>
                    </div>

                    {/* Digital Live Clock Display - 12-Hour System */}
                    <div className="flex flex-col items-center">
                        <div className="flex items-baseline justify-center gap-3">
                            <span className="text-4xl sm:text-6xl md:text-7xl font-black tracking-wider text-white font-mono drop-shadow-[0_0_25px_rgba(59,130,246,0.3)]">
                                {liveTimeObj.time}
                            </span>
                            <div className="flex flex-col text-right">
                                <span className="text-xl sm:text-2xl font-black text-blue-400 font-mono">
                                    {liveTimeObj.ampm}
                                </span>
                                <span className="text-xs sm:text-sm font-bold text-gray-400">
                                    {liveTimeObj.ampmArabic}
                                </span>
                            </div>
                        </div>

                        {/* Date and Day Name */}
                        <div className="flex items-center gap-2 mt-2 text-xs sm:text-sm text-gray-300 font-bold bg-white/5 px-4 py-1.5 rounded-full border border-white/5">
                            <Calendar size={14} className="text-blue-400" />
                            <span>{currentDayName}</span>
                            <span className="text-white/30">•</span>
                            <span className="font-mono text-gray-300">{todayDate}</span>
                        </div>
                    </div>

                    {/* Conditional Rendering: تعليق التسجيل VS فتح التسجيل */}
                    {isSystemSuspended ? (
                        <div className="w-full max-w-2xl mt-4 p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-amber-500/15 via-amber-500/10 to-transparent border-2 border-amber-500/40 shadow-2xl backdrop-blur-md flex flex-col items-center text-center animate-in zoom-in-95">
                            {/* شارة التنبيه والحالة */}
                            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs sm:text-sm font-black mb-3 shadow-sm">
                                <Hourglass className="animate-spin text-amber-400" size={16} style={{ animationDuration: '6s' }} />
                                <span>وضع تعليق النظام والصيانة مؤقتاً</span>
                            </div>

                            {/* النص المطلوب: "جاري العمل به.. باقي من الزمن:" */}
                            <h3 className="text-xl sm:text-3xl font-black text-amber-300 mb-4 tracking-wide drop-shadow-md">
                                جاري العمل به.. باقي من الزمن:
                            </h3>

                            {/* عداد حي رقمي متقدم للوحدات الأربعة (يوم، ساعة، دقيقة، ثانية) فقط في المربعات */}
                            <div className="grid grid-cols-4 gap-1.5 sm:gap-4 w-full max-w-lg mb-4">
                                <div className="bg-gray-900/90 border border-amber-500/30 rounded-2xl p-2 sm:p-4 text-center shadow-lg">
                                    <span className="block text-xl sm:text-4xl font-black text-amber-400 font-mono">{countdown.days}</span>
                                    <span className="text-[10px] sm:text-xs text-amber-200/80 font-bold mt-1 block">يوم</span>
                                </div>
                                <div className="bg-gray-900/90 border border-amber-500/30 rounded-2xl p-2 sm:p-4 text-center shadow-lg">
                                    <span className="block text-xl sm:text-4xl font-black text-white font-mono">{String(countdown.hours).padStart(2, '0')}</span>
                                    <span className="text-[10px] sm:text-xs text-amber-200/80 font-bold mt-1 block">ساعة</span>
                                </div>
                                <div className="bg-gray-900/90 border border-amber-500/30 rounded-2xl p-2 sm:p-4 text-center shadow-lg">
                                    <span className="block text-xl sm:text-4xl font-black text-white font-mono">{String(countdown.minutes).padStart(2, '0')}</span>
                                    <span className="text-[10px] sm:text-xs text-amber-200/80 font-bold mt-1 block">دقيقة</span>
                                </div>
                                <div className="bg-gray-900/90 border border-amber-500/30 rounded-2xl p-2 sm:p-4 text-center shadow-lg">
                                    <span className="block text-xl sm:text-4xl font-black text-amber-300 font-mono">{String(countdown.seconds).padStart(2, '0')}</span>
                                    <span className="text-[10px] sm:text-xs text-amber-200/80 font-bold mt-1 block">ثانية</span>
                                </div>
                            </div>

                            <p className="text-xs sm:text-sm text-amber-200/80 font-medium max-w-md leading-relaxed">
                                تم تعليق تسجيل الحضور والانصراف مؤقتاً بواسطة إدارة النظام. سيعود النظام للعمل الطبيعي فور انتهاء العداد التنازلي.
                            </p>
                        </div>
                    ) : isSuspensionExpired ? (
                        <div className="w-full max-w-xl mt-4 p-5 rounded-3xl bg-rose-500/15 border-2 border-rose-500/40 text-rose-200 text-center shadow-xl backdrop-blur-md animate-in zoom-in-95">
                            <div className="flex items-center justify-center gap-2 mb-2 text-rose-400 font-black text-base">
                                <AlertTriangle size={20} />
                                <span>انتهت فترة التعليق المحددة</span>
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-white mb-3">
                                يرجى مراجعة الإدارة لفتح وتفعيل تسجيل الحضور والانصراف.
                            </p>
                            {user.role === 'admin' && (
                                <button
                                    onClick={() => {
                                        setActiveTab('advanced');
                                        setShowAdminSettings(true);
                                    }}
                                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black shadow-lg transition active:scale-95 cursor-pointer"
                                >
                                    فتح الإعدادات لإنهاء التعليق
                                </button>
                            )}
                        </div>
                    ) : (
                        <>
                            {/* Warning Notice Box - Editable for Admin Only */}
                            <div className="w-full max-w-3xl mt-3 p-3.5 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-right shadow-lg backdrop-blur-sm overflow-hidden">
                                {isEditingNotice && user.role === 'admin' ? (
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between pb-2 border-b border-amber-500/20">
                                            <div className="flex items-center gap-2 text-amber-300 font-bold text-xs sm:text-sm">
                                                <Edit3 size={16} />
                                                <span>تعديل رسالة الملاحظة التي تظهر للمستخدمين</span>
                                            </div>
                                            <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">صلاحيات المدير</span>
                                        </div>
                                        <textarea
                                            value={tempNoticeMessage}
                                            onChange={e => setTempNoticeMessage(e.target.value)}
                                            rows={3}
                                            className="w-full bg-gray-900/90 text-white font-medium text-xs sm:text-sm p-3 rounded-xl border border-amber-500/40 focus:border-amber-400 outline-none leading-relaxed"
                                            placeholder="اكتب رسالة الملاحظة هنا..."
                                        />
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setTempNoticeMessage(noticeMessage);
                                                    setIsEditingNotice(false);
                                                }}
                                                className="px-3.5 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition cursor-pointer"
                                            >
                                                إلغاء
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveNoticeMessage}
                                                disabled={isSavingNotice}
                                                className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-500/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
                                            >
                                                <Save size={14} />
                                                <span>{isSavingNotice ? 'جاري الحفظ...' : 'حفظ الرسالة'}</span>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="space-y-2 w-full">
                                        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-amber-500/20">
                                            <div className="flex items-center gap-2 text-amber-300 font-black text-xs sm:text-sm">
                                                <AlertTriangle size={18} className="text-amber-400 shrink-0" />
                                                <span>ملاحظة هامة للموظفين:</span>
                                            </div>
                                            {user.role === 'admin' && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setTempNoticeMessage(noticeMessage);
                                                        setIsEditingNotice(true);
                                                    }}
                                                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1 transition active:scale-95 cursor-pointer shrink-0"
                                                    title="تعديل رسالة الملاحظة"
                                                >
                                                    <Edit3 size={12} />
                                                    <span>تعديل</span>
                                                </button>
                                            )}
                                        </div>
                                        <div className="text-[11px] sm:text-xs leading-relaxed font-semibold text-amber-100/90 space-y-1.5 text-right w-full break-words">
                                            {noticeMessage
                                                .split(/\r?\n/)
                                                .flatMap(p => p.split(/(?<=[.!?؟])\s+/))
                                                .map(s => s.trim())
                                                .filter(Boolean)
                                                .map((line, idx) => (
                                                    <div key={idx} className="flex items-start gap-1.5 w-full text-right">
                                                        <span className="text-amber-400 mt-1 shrink-0 text-[10px]">•</span>
                                                        <span className="flex-1 break-words">{line}</span>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action Message Toast / Alert */}
                            {actionMessage ? (
                                <div className={`w-full max-w-xl p-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all duration-300 animate-in fade-in ${
                                    actionMessage.type === 'success' 
                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                                        : actionMessage.type === 'error'
                                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                        : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                                }`}>
                                    {actionMessage.type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
                                    <span>{actionMessage.text}</span>
                                </div>
                            ) : (myRecord?.isLate && (user.role === 'admin' || myRecord?.userId === user.key || myRecord?.username === user.username)) ? (
                                <div className="w-full max-w-xl p-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 bg-red-600/20 text-red-300 border border-red-500/40 animate-in fade-in">
                                    <AlertTriangle size={18} className="text-red-400" />
                                    <span>تم تسجيل ميعادك بـ ({myRecord.checkInTime})، تأخير! خصم ربع يوم.</span>
                                </div>
                            ) : null}

                            {/* Notice if employee account is hidden */}
                            {isEmployeeHidden(user) && (
                                <div className="w-full max-w-xl p-3.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-in fade-in">
                                    <ShieldAlert size={18} className="text-amber-400" />
                                    <span>تم حجب هذا الحساب من نظام الحضور والانصراف بواسطة إدارة النظام.</span>
                                </div>
                            )}

                            {/* System Not Started Notice OR Action Buttons */}
                            {!isAttendanceStarted ? (
                                <div className="w-full max-w-2xl mt-2 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-emerald-950/40 via-gray-900 to-gray-900 border-2 border-emerald-500/40 text-center shadow-2xl backdrop-blur-md animate-in fade-in space-y-3">
                                    <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center">
                                        <PlayCircle size={28} />
                                    </div>
                                    <div>
                                        <h4 className="text-base sm:text-lg font-black text-white">
                                            تسجيل الحضور والانصراف غير مفعّل حالياً
                                        </h4>
                                        <p className="text-xs sm:text-sm text-gray-300 font-semibold mt-1 max-w-lg mx-auto leading-relaxed">
                                            {user.role === 'admin' 
                                                ? 'لم يتم بدء تسجيل الحضور والانصراف بعد. يمكنك بدء التسجيل وتصفير أي تسجيلات عشوائية سابقة من قسم (إعدادات إضافية).'
                                                : 'تسجيل الحضور والانصراف في انتظار البدء والتفعيل من قِبل إدارة النظام.'}
                                        </p>
                                    </div>

                                    {user.role === 'admin' ? (
                                        <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                                            <button
                                                type="button"
                                                onClick={handleStartAttendanceSystem}
                                                disabled={isSavingSettings}
                                                className="px-6 py-2.5 sm:py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm shadow-xl shadow-emerald-600/30 transition active:scale-95 cursor-pointer inline-flex items-center gap-2"
                                            >
                                                <PlayCircle size={18} />
                                                <span>ابدأ تسجيل الحضور والانصراف</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveTab('advanced');
                                                    setShowAdminSettings(true);
                                                }}
                                                className="px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition cursor-pointer inline-flex items-center gap-1.5"
                                            >
                                                <Sliders size={15} />
                                                <span>فتح الإعدادات الإضافية</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-xl">
                                            <Clock size={16} />
                                            <span>يرجى مراجعة إدارة الفرع أو المسؤول لتفعيل التسجيل</span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Two Prominent Action Buttons: تسجيل الحضور & تسجيل الانصراف بجانب بعض في الهاتف */
                                <div className="grid grid-cols-2 gap-2 sm:gap-4 w-full max-w-2xl pt-2">
                                    {/* Check-In Button */}
                                    <button
                                        onClick={() => {
                                            if (isEmployeeHidden(user)) return;
                                            setActionModalMode('check_in');
                                            setActionModalSelectedBranch(myRecord?.branchName || userRegisteredBranches[0] || '');
                                            setBranchSelectionError(null);
                                            setShowActionModal(true);
                                        }}
                                        disabled={isSubmitting || !!myRecord?.checkInTime || isEmployeeHidden(user)}
                                        className={`group relative py-3 sm:py-5 px-2 sm:px-6 rounded-2xl font-black transition-all duration-300 shadow-xl flex items-center justify-center gap-1.5 sm:gap-3 cursor-pointer overflow-hidden ${
                                            isEmployeeHidden(user)
                                                ? 'bg-gray-800/40 text-gray-500 border border-white/5 cursor-not-allowed'
                                                : myRecord?.checkInTime
                                                ? 'bg-emerald-900/30 text-emerald-400/60 border border-emerald-500/20 cursor-not-allowed'
                                                : isSubmitting
                                                ? 'bg-emerald-700/60 text-white cursor-wait'
                                                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30 hover:shadow-emerald-600/50 hover:scale-[1.02] active:scale-95 border border-emerald-400/30'
                                        }`}
                                    >
                                        <div className="p-1.5 sm:p-2 bg-white/10 rounded-xl shrink-0 group-hover:scale-110 transition-transform">
                                            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
                                        </div>
                                        <div className="text-right min-w-0">
                                            <span className="block whitespace-nowrap font-black text-xs sm:text-base leading-tight">
                                                {isSubmitting ? 'جاري الفحص...' : 'تسجيل الحضور'}
                                            </span>
                                            {myRecord?.checkInTime && (
                                                <span className={`block text-[9px] sm:text-[11px] font-mono truncate ${myRecord.isLate && (user.role === 'admin' || myRecord?.userId === user.key || myRecord?.username === user.username) ? 'text-red-400 font-bold' : 'text-emerald-400 font-normal'}`}>
                                                    تم: {myRecord.checkInTime}
                                                </span>
                                            )}
                                        </div>
                                    </button>

                                    {/* Check-Out Button */}
                                    <button
                                        onClick={() => {
                                            if (isEmployeeHidden(user)) return;
                                            setActionModalMode('check_out');
                                            setActionModalSelectedBranch(myRecord?.branchName || userRegisteredBranches[0] || '');
                                            setBranchSelectionError(null);
                                            setShowActionModal(true);
                                        }}
                                        disabled={isSubmitting || !myRecord?.checkInTime || !!myRecord?.checkOutTime || isEmployeeHidden(user)}
                                        className={`group relative py-3 sm:py-5 px-2 sm:px-6 rounded-2xl font-black transition-all duration-300 shadow-xl flex items-center justify-center gap-1.5 sm:gap-3 cursor-pointer overflow-hidden ${
                                            isEmployeeHidden(user)
                                                ? 'bg-gray-800/40 text-gray-500 border border-white/5 cursor-not-allowed'
                                                : !myRecord?.checkInTime
                                                ? 'bg-gray-800/50 text-gray-500 border border-white/5 cursor-not-allowed'
                                                : myRecord?.checkOutTime
                                                ? 'bg-rose-900/30 text-rose-400/60 border border-rose-500/20 cursor-not-allowed'
                                                : isSubmitting
                                                ? 'bg-rose-700/60 text-white cursor-wait'
                                                : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-rose-600/30 hover:shadow-rose-600/50 hover:scale-[1.02] active:scale-95 border border-rose-400/30'
                                        }`}
                                    >
                                        <div className="p-1.5 sm:p-2 bg-white/10 rounded-xl shrink-0 group-hover:scale-110 transition-transform">
                                            {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <LogOut size={18} />}
                                        </div>
                                        <div className="text-right min-w-0">
                                            <span className="block whitespace-nowrap font-black text-xs sm:text-base leading-tight">
                                                {isSubmitting ? 'جاري الفحص...' : 'تسجيل الانصراف'}
                                            </span>
                                            {myRecord?.checkOutTime ? (
                                                <span className="block text-[9px] sm:text-[11px] font-normal text-rose-400 font-mono truncate">
                                                    تم: {myRecord.checkOutTime}
                                                </span>
                                            ) : !myRecord?.checkInTime ? (
                                                <span className="block text-[9px] sm:text-[11px] font-normal text-gray-400 truncate">
                                                    يتطلب الحضور أولاً
                                                </span>
                                            ) : null}
                                        </div>
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Real-time Employees List Section */}
            {!isSystemSuspended && (
                <div className="space-y-4">
                {/* Section Header with Clean Title & Actions */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-gray-900/70 p-3 sm:p-5 rounded-2xl border border-white/10 shadow-lg overflow-hidden">
                    <div className="flex items-center gap-2.5 sm:gap-3 w-full sm:w-auto min-w-0">
                        <div className="p-2 sm:p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30 shrink-0">
                            <Users size={20} />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-sm sm:text-lg md:text-xl font-bold text-white truncate">
                                قائمة الموظفين وسجل الحضور (لحظياً)
                            </h3>
                            <p className="text-[11px] text-gray-400 font-semibold truncate">
                                ترتيب زمني لحظي للموظفين المسجلين في تاريخ ({activeDayDate})
                            </p>
                        </div>
                    </div>

                    {/* زر تصدير PDF للحضور والانصراف */}
                    {user.role === 'admin' && (
                        <button
                            type="button"
                            onClick={handleDownloadAttendanceDailyPDF}
                            disabled={isExportingAttendancePDF}
                            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition active:scale-95 cursor-pointer whitespace-nowrap"
                            title="تصدير كشف الحضور والانصراف لهذا اليوم كملف PDF"
                        >
                            {isExportingAttendancePDF ? (
                                <Loader2 size={15} className="animate-spin text-white" />
                            ) : (
                                <FileDown size={15} />
                            )}
                            <span>تصدير PDF</span>
                        </button>
                    )}
                </div>

                {/* Filter and Search Bar - Only for Admin */}
                {user.role === 'admin' && (
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 bg-gray-900/50 p-2.5 sm:p-4 rounded-2xl border border-white/5">
                        {/* 1. اختيار يوم محدد */}
                        <div className="relative min-w-[130px] sm:min-w-[150px] flex-1 sm:flex-initial">
                            <select
                                value={selectedDayDate}
                                onChange={e => setSelectedDayDate(e.target.value)}
                                className="w-full bg-gray-800 text-white text-xs font-bold px-3 py-2 sm:py-2.5 rounded-xl border border-white/10 outline-none cursor-pointer focus:border-blue-500"
                                title="اختيار يوم محدد"
                            >
                                {attendanceDatesList.map(d => (
                                    <option key={d} value={d}>
                                        {d === todayDate ? `📅 يوم محدد: اليوم (${d})` : `📅 يوم محدد: ${d}`}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* 2. Branch Filter */}
                        <select
                            value={selectedBranch}
                            onChange={e => setSelectedBranch(e.target.value)}
                            className="bg-gray-800 text-white text-xs font-bold px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border border-white/10 outline-none cursor-pointer focus:border-blue-500 min-w-[110px]"
                        >
                            <option value="all">كل الفروع</option>
                            {(user.role === 'admin' ? markets : employeeLocationBranches).map((m, idx) => (
                                <option key={idx} value={m}>{m}</option>
                            ))}
                        </select>

                        {/* 3. Search Select Dropdown with Admin accounts hidden */}
                        <div className="relative flex-1 min-w-[140px]">
                            <select
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full bg-gray-800 text-white text-xs font-bold px-3 py-2 sm:py-2.5 rounded-xl border border-white/10 outline-none focus:border-blue-500 transition cursor-pointer truncate"
                            >
                                <option value="">كل الموظفين (بحث بالاسم)</option>
                                {usersList
                                    .filter(u => u.role !== 'admin' && !u.isArchived && !isEmployeeHidden(u))
                                    .map(u => (
                                        <option key={u.key || u.username} value={u.name || u.username}>
                                            {u.name || u.username}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {/* 4. زر تصفير الحضور والانصراف بالكامل */}
                        <button
                            type="button"
                            onClick={handleResetAllAttendance}
                            className="px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer whitespace-nowrap"
                            title={`تصفير الحضور والانصراف بالكامل ليوم ${activeDayDate}`}
                        >
                            <Trash2 size={13} />
                            <span>تصفير الحضور</span>
                        </button>
                    </div>
                )}

                {/* Employees Table / List - Responsive without horizontal scroll on mobile */}
                <div className="bg-gray-900/60 rounded-2xl border border-white/10 overflow-hidden shadow-xl">
                    <div className="overflow-x-hidden w-full">
                        <table className="w-full text-right text-xs">
                            <thead className="bg-gray-800/80 text-gray-400 uppercase text-[10px] sm:text-[11px] font-bold border-b border-white/10">
                                <tr>
                                    <th className="p-1.5 sm:p-3.5 text-center w-7 sm:w-10">#</th>
                                    <th className="p-1.5 sm:p-3.5">الاسم</th>
                                    <th className="p-1.5 sm:p-3.5">الفرع</th>
                                    <th className="p-1.5 sm:p-3.5 text-center">الحضور</th>
                                    <th className="p-1.5 sm:p-3.5 text-center">الانصراف</th>
                                    <th className="p-1.5 sm:p-3.5 text-center">تأخيرات</th>
                                    {user.role === 'admin' && <th className="p-1.5 sm:p-3.5 text-center w-8">حذف</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {filteredEmployees.length === 0 ? (
                                    <tr>
                                        <td colSpan={user.role === 'admin' ? 7 : 6} className="p-8 text-center text-gray-500 font-bold">
                                            لا يوجد موظفون قاموا بتسجيل الحضور في تاريخ ({activeDayDate})
                                        </td>
                                    </tr>
                                ) : (
                                    filteredEmployees.map((emp, index) => {
                                        const isCurrentUser = emp.key === userIdentifier;
                                        // Phase 3: Deduction details are visible ONLY to the penalized employee and the admin
                                        const canViewPenalty = user.role === 'admin' || isCurrentUser;
                                        const hasQuarterDayDeduction = !!emp.isLate && canViewPenalty;

                                        return (
                                            <tr
                                                key={emp.key}
                                                className={`transition-colors hover:bg-white/5 ${
                                                    isCurrentUser ? 'bg-blue-950/25' : ''
                                                }`}
                                            >
                                                <td className="p-1.5 sm:p-3.5 font-bold text-gray-400 font-mono text-center text-[10px] sm:text-xs">{index + 1}</td>
                                                <td className="p-1.5 sm:p-3.5">
                                                    <div className="flex items-center gap-1 sm:gap-2">
                                                        <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0 ${
                                                            emp.checkInTime 
                                                                ? hasQuarterDayDeduction
                                                                    ? 'bg-red-600 text-white shadow-sm'
                                                                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
                                                                : 'bg-gray-800 text-gray-400 border border-white/10'
                                                        }`}>
                                                            {(emp.name || emp.username || '?').charAt(0)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-white flex items-center gap-1">
                                                                <span className="text-[11px] sm:text-xs truncate max-w-[70px] sm:max-w-none">{emp.name || emp.username || 'موظف'}</span>
                                                                {isCurrentUser && (
                                                                    <span className="text-[8px] sm:text-[10px] bg-blue-600/30 text-blue-400 px-1 py-0.2 rounded border border-blue-500/30 font-bold shrink-0">
                                                                        أنت
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[9px] sm:text-[10px] text-gray-500 font-mono hidden sm:block truncate">@{emp.username || emp.key}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="p-1.5 sm:p-3.5 text-gray-300 font-medium">
                                                    <div className="flex items-center gap-1">
                                                        <Building2 size={12} className="text-gray-400 shrink-0 hidden sm:inline" />
                                                        <span className="text-[10px] sm:text-xs truncate max-w-[60px] sm:max-w-none">{emp.branch}</span>
                                                    </div>
                                                </td>
                                                <td className="p-1.5 sm:p-3.5 text-center">
                                                    {emp.checkInTime ? (
                                                        <div className={`inline-flex items-center justify-center gap-1 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg font-mono font-bold text-[10px] sm:text-xs ${
                                                            hasQuarterDayDeduction 
                                                                ? 'bg-red-600 text-white shadow-sm border border-red-500' 
                                                                : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                                        }`} dir="ltr" title={hasQuarterDayDeduction ? 'تأخير! تم خصم ربع يوم' : ''}>
                                                            <Clock size={11} className="hidden sm:inline" />
                                                            <span>{emp.checkInTime}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-500 text-[10px] sm:text-xs italic">لم يسجل</span>
                                                    )}
                                                </td>
                                                <td className="p-1.5 sm:p-3.5 text-center">
                                                    {emp.checkOutTime ? (
                                                        <div className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-md sm:rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 font-mono font-bold text-[10px] sm:text-xs" dir="ltr">
                                                            <Clock size={11} className="hidden sm:inline" />
                                                            <span>{emp.checkOutTime}</span>
                                                        </div>
                                                    ) : emp.checkInTime ? (
                                                        <span className="text-amber-400/80 font-medium text-[10px] sm:text-xs">قيد العمل</span>
                                                    ) : (
                                                        <span className="text-gray-500 text-[10px] sm:text-xs">-</span>
                                                    )}
                                                </td>
                                                <td className="p-1.5 sm:p-3.5 text-center">
                                                    {emp.checkOutTime ? (
                                                        <span className="px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 whitespace-nowrap">
                                                            انصرف
                                                        </span>
                                                    ) : emp.checkInTime ? (
                                                        hasQuarterDayDeduction ? (
                                                            <span className="px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-black bg-red-600 text-white shadow-sm border border-red-500 whitespace-nowrap">
                                                                خصم ربع يوم
                                                            </span>
                                                        ) : (
                                                            <span className="px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 whitespace-nowrap">
                                                                حاضر
                                                            </span>
                                                        )
                                                    ) : emp.status === 'absent' || emp.autoAbsent ? (
                                                        <span className="px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold bg-gray-800 text-rose-400 border border-rose-500/30 whitespace-nowrap">
                                                            {emp.autoAbsent ? 'غياب تلقائي' : 'غياب'}
                                                        </span>
                                                    ) : (
                                                        <span className="px-1.5 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold bg-gray-800 text-gray-400 border border-white/5 whitespace-nowrap">
                                                            -
                                                        </span>
                                                    )}
                                                </td>
                                                {user.role === 'admin' && (
                                                    <td className="p-1.5 sm:p-3.5 text-center">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteSingleAttendance(emp.key, emp.name)}
                                                            className="p-1 sm:p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 hover:text-rose-200 transition cursor-pointer"
                                                            title={`حذف تسجيل ${emp.name}`}
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Printable Attendance Sheet for PDF Generation (Hidden from DOM display until print) */}
                <div
                    ref={attendancePrintContainerRef}
                    style={{ display: 'none', position: 'fixed', top: '-9999px', left: '-9999px', width: '1000px', backgroundColor: '#ffffff', color: '#111827', padding: '30px', fontFamily: 'sans-serif' }}
                    dir="rtl"
                >
                    <div style={{ textAlign: 'center', borderBottom: '2px solid #2563eb', paddingBottom: '16px', marginBottom: '20px' }}>
                        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e3a8a', margin: '0 0 8px 0' }}>
                            كشف سجل الحضور والانصراف
                        </h2>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: '#4b5563', marginTop: '10px' }}>
                            <span><strong>التاريخ:</strong> {activeDayDate}</span>
                            <span><strong>الفرع:</strong> {selectedBranch === 'all' ? 'جميع الفروع' : selectedBranch}</span>
                            <span><strong>إجمالي الحضور:</strong> {filteredEmployees.length} موظف</span>
                            <span><strong>وقت التصدير:</strong> {new Date().toLocaleTimeString('ar-EG')}</span>
                        </div>
                    </div>

                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '12px' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                                <th style={{ padding: '10px', width: '40px', textAlign: 'center', border: '1px solid #cbd5e1' }}>#</th>
                                <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>اسم الموظف</th>
                                <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>اسم المستخدم</th>
                                <th style={{ padding: '10px', border: '1px solid #cbd5e1' }}>الفرع</th>
                                <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #cbd5e1' }}>وقت الحضور</th>
                                <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #cbd5e1' }}>وقت الانصراف</th>
                                <th style={{ padding: '10px', textAlign: 'center', border: '1px solid #cbd5e1' }}>الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.length === 0 ? (
                                <tr>
                                    <td colSpan={7} style={{ padding: '25px', textAlign: 'center', color: '#6b7280', border: '1px solid #cbd5e1' }}>
                                        لا توجد تسجيلات حضور في هذا اليوم
                                    </td>
                                </tr>
                            ) : (
                                filteredEmployees.map((emp, idx) => (
                                    <tr key={`print-att-${emp.key}-${idx}`} style={{ backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc', borderBottom: '1px solid #cbd5e1' }}>
                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #cbd5e1' }}>{idx + 1}</td>
                                        <td style={{ padding: '8px', fontWeight: 'bold', border: '1px solid #cbd5e1' }}>{emp.name || emp.username}</td>
                                        <td style={{ padding: '8px', color: '#64748b', border: '1px solid #cbd5e1' }}>@{emp.username}</td>
                                        <td style={{ padding: '8px', border: '1px solid #cbd5e1' }}>{emp.branch}</td>
                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: emp.isLate ? '#dc2626' : '#16a34a', border: '1px solid #cbd5e1' }}>
                                            {emp.checkInTime || '-'}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', color: '#7c3aed', border: '1px solid #cbd5e1' }}>
                                            {emp.checkOutTime || (emp.checkInTime ? 'قيد العمل' : '-')}
                                        </td>
                                        <td style={{ padding: '8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #cbd5e1' }}>
                                            {emp.checkOutTime ? 'انصرف' : emp.isLate ? 'متأخر (خصم ربع يوم)' : emp.checkInTime ? 'حاضر في الموعد' : 'غياب'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            )}

            {/* ========================================================= */}
            {/* Phase 2: Admin Settings Modal (Settings Gear Click)      */}
            {/* ========================================================= */}
            {showAdminSettings && user.role === 'admin' && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
                    <div className="w-full max-w-2xl bg-gray-900 text-white rounded-3xl border border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 my-auto max-h-[92vh] flex flex-col">
                        
                        {/* Modal Header */}
                        <div className="p-5 md:p-6 border-b border-white/10 flex items-center justify-between bg-gray-850">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                                    <SettingsIcon size={22} />
                                </div>
                                <div>
                                    <h3 className="text-lg md:text-xl font-black text-white">إعدادات الحضور والانصراف</h3>
                                    <p className="text-xs text-white/50 font-bold">لوحة تحكم المدير لإدارة المواعيد وفروع الموظفين</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowAdminSettings(false)}
                                className="text-white/50 hover:text-white p-2 rounded-xl hover:bg-white/10 transition cursor-pointer"
                                title="إغلاق"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* 4 Tab Buttons */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 bg-gray-950/60 border-b border-white/5">
                            {/* Tab 1: مواعيد */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('schedules')}
                                className={`py-3 px-2 sm:px-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition cursor-pointer ${
                                    activeTab === 'schedules'
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40'
                                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
                                }`}
                            >
                                <Clock size={16} />
                                <span>مواعيد</span>
                            </button>

                            {/* Tab 2: اللوكيشن - فروع الشركة */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('locations')}
                                className={`py-3 px-2 sm:px-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition cursor-pointer ${
                                    activeTab === 'locations'
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40'
                                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
                                }`}
                            >
                                <MapPin size={16} />
                                <span className="truncate">اللوكيشن</span>
                            </button>

                            {/* Tab 3: العاملين */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('employees')}
                                className={`py-3 px-2 sm:px-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition cursor-pointer ${
                                    activeTab === 'employees'
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40'
                                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
                                }`}
                            >
                                <Users size={16} />
                                <span>العاملين</span>
                            </button>

                            {/* Tab 4: إعدادات إضافية */}
                            <button
                                type="button"
                                onClick={() => setActiveTab('advanced')}
                                className={`py-3 px-2 sm:px-3 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 transition cursor-pointer relative ${
                                    activeTab === 'advanced'
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 border border-blue-400/40'
                                        : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-transparent'
                                }`}
                            >
                                <Sliders size={16} />
                                <span>إعدادات إضافية</span>
                                {isSystemSuspended && (
                                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping absolute top-2 left-2" title="التعليق مفعل حالياً" />
                                )}
                            </button>
                        </div>

                        {/* Modal Body / Tab Content */}
                        <div className="p-5 md:p-6 overflow-y-auto flex-1 space-y-5">
                            {/* ========================================= */}
                            {/* TAB 1: مواعيد ومواعيد التأخير              */}
                            {/* ========================================= */}
                            {activeTab === 'schedules' && (
                                <div className="space-y-6 animate-in fade-in duration-200">
                                    {/* قسم تحديد واعتماد مواعيد الحضور والانصراف لكل موظف - أعلى مواعيد العمل الرسمية */}
                                    <div className="bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/20 p-4 sm:p-5 rounded-2xl border border-blue-500/30 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-black text-white flex items-center gap-2">
                                                <UserCheck size={18} className="text-blue-400" />
                                                <span>تحديد واعتماد مواعيد الحضور والانصراف لكل موظف</span>
                                            </h4>
                                            <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-bold">
                                                اعتماد مستقل
                                            </span>
                                        </div>
                                        <p className="text-xs text-white/60 font-semibold leading-relaxed">
                                            قائمة بأسماء العاملين لتحديد مواعيد الحضور ومواعيد الانصراف لكل موظف بشكل مستقل ليتم اعتمادها في النظام واحتساب التأخير عليها.
                                        </p>

                                        {/* قائمة بأسماء العاملين */}
                                        <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                                            {usersList.filter(emp => !emp.isArchived).map((emp) => {
                                                const empKey = emp.key || emp.username || '';
                                                const custom = employeeCustomSchedules[empKey];
                                                const inTime = custom?.checkInTime || scheduleCheckIn || '10:00';
                                                const outTime = custom?.checkOutTime || scheduleCheckOut || '18:00';
                                                const isApproved = !!custom;

                                                return (
                                                    <div key={empKey} className="flex items-center justify-between gap-1.5 sm:gap-2 p-2 sm:p-2.5 rounded-xl bg-gray-800/80 border border-white/5 hover:border-blue-500/30 transition">
                                                        {/* 1. الاسم */}
                                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold shrink-0 ${isApproved ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-700 text-gray-300'}`}>
                                                                {(emp.name || emp.username || '?').charAt(0)}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="text-[11px] sm:text-xs font-bold text-white block truncate" title={emp.name || emp.username}>
                                                                    {emp.name || emp.username}
                                                                </span>
                                                            </div>
                                                            {isApproved && (
                                                                <span className="hidden sm:inline-block text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold shrink-0">
                                                                    معتمد
                                                                </span>
                                                            )}
                                                            {isApproved && (
                                                                <span className="sm:hidden w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="معتمد" />
                                                            )}
                                                        </div>

                                                        {/* 2. الوقت (حضور - انصراف) */}
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <input
                                                                type="time"
                                                                defaultValue={inTime}
                                                                key={`in-${empKey}-${inTime}`}
                                                                id={`checkin-${empKey}`}
                                                                className="w-[66px] sm:w-24 bg-gray-900 text-white font-mono font-bold text-[10px] sm:text-xs px-1 sm:px-2 py-1 rounded-lg border border-white/10 outline-none focus:border-blue-500 text-center"
                                                                title="ميعاد الحضور"
                                                            />
                                                            <span className="text-gray-400 font-bold text-[10px]">-</span>
                                                            <input
                                                                type="time"
                                                                defaultValue={outTime}
                                                                key={`out-${empKey}-${outTime}`}
                                                                id={`checkout-${empKey}`}
                                                                className="w-[66px] sm:w-24 bg-gray-900 text-white font-mono font-bold text-[10px] sm:text-xs px-1 sm:px-2 py-1 rounded-lg border border-white/10 outline-none focus:border-blue-500 text-center"
                                                                title="ميعاد الانصراف"
                                                            />
                                                        </div>

                                                        {/* 3. زر اعتماد */}
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    const inEl = document.getElementById(`checkin-${empKey}`) as HTMLInputElement;
                                                                    const outEl = document.getElementById(`checkout-${empKey}`) as HTMLInputElement;
                                                                    const newIn = inEl ? inEl.value : inTime;
                                                                    const newOut = outEl ? outEl.value : outTime;
                                                                    handleSaveEmployeeSchedule(empKey, newIn, newOut);
                                                                }}
                                                                disabled={isSavingCustomSched}
                                                                className="px-2 sm:px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[10px] sm:text-[11px] font-bold flex items-center justify-center gap-0.5 transition active:scale-95 shadow-sm cursor-pointer whitespace-nowrap"
                                                                title="اعتماد ميعاد هذا الموظف"
                                                            >
                                                                <Check size={11} className="shrink-0" />
                                                                <span>اعتماد</span>
                                                            </button>
                                                            {isApproved && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveEmployeeSchedule(empKey)}
                                                                    className="p-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 transition cursor-pointer shrink-0"
                                                                    title="إلغاء التخصيص والعودة للمواعيد العامة"
                                                                >
                                                                    <X size={11} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <h4 className="text-sm font-bold text-blue-400 mb-3 flex items-center gap-2">
                                            <Clock size={16} />
                                            <span>مواعيد العمل الرسمية</span>
                                        </h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-300 mb-2">
                                                    ميعاد الحضور *
                                                </label>
                                                <input
                                                    type="time"
                                                    value={scheduleCheckIn}
                                                    onChange={e => setScheduleCheckIn(e.target.value)}
                                                    className="w-full bg-gray-800 text-white font-mono font-bold text-sm px-4 py-3 rounded-xl border border-white/10 focus:border-blue-500 outline-none transition"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-300 mb-2">
                                                    ميعاد الانصراف *
                                                </label>
                                                <input
                                                    type="time"
                                                    value={scheduleCheckOut}
                                                    onChange={e => setScheduleCheckOut(e.target.value)}
                                                    className="w-full bg-gray-800 text-white font-mono font-bold text-sm px-4 py-3 rounded-xl border border-white/10 focus:border-blue-500 outline-none transition"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* قسم مواعيد التأخير */}
                                    <div className="bg-amber-500/10 p-5 rounded-2xl border border-amber-500/20">
                                        <h4 className="text-sm font-black text-amber-300 mb-2 flex items-center gap-2">
                                            <AlertTriangle size={17} />
                                            <span>مواعيد التأخير</span>
                                        </h4>
                                        <p className="text-xs text-amber-200/80 mb-4 leading-relaxed font-medium">
                                            حدد فترة السماح المسموح بها للموظف قبل احتساب خصم ربع يوم للتأخير عن الميعاد المحدد.
                                        </p>

                                        <div className="max-w-xs">
                                            <label className="block text-xs font-bold text-gray-200 mb-2">
                                                فترة السماح بالدقائق *
                                            </label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    max="120"
                                                    value={gracePeriodMinutes}
                                                    onChange={e => setGracePeriodMinutes(Number(e.target.value))}
                                                    className="w-full bg-gray-800 text-white font-mono font-bold text-sm pr-4 pl-14 py-3 rounded-xl border border-white/10 focus:border-amber-400 outline-none transition"
                                                    placeholder="15"
                                                />
                                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                                                    دقيقة
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ========================================= */}
                            {/* TAB 2: اللوكيشن - فروع الشركة             */}
                            {/* ========================================= */}
                            {activeTab === 'locations' && (
                                <div className="space-y-5 animate-in fade-in duration-200">
                                    {/* اختيار اسم الموظف */}
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                                        <label className="block text-xs font-bold text-gray-300 mb-2 flex items-center gap-2">
                                            <Users size={16} className="text-blue-400" />
                                            <span>اختيار اسم الموظف *</span>
                                        </label>
                                        <select
                                            value={selectedEmployeeId}
                                            onChange={e => setSelectedEmployeeId(e.target.value)}
                                            className="w-full bg-gray-800 text-white font-bold text-sm px-4 py-3 rounded-xl border border-white/10 focus:border-blue-500 outline-none cursor-pointer"
                                        >
                                            <option value="">-- اختر موظفاً لإعداد فروعه --</option>
                                            {usersList.filter(u => !u.isArchived).map((u) => (
                                                <option key={u.key || u.username} value={u.key || u.username}>
                                                    {u.name || u.username} ({u.username})
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* قائمة الخانات (الافتراضية 5 خانات + زر أضف بالاعلى) */}
                                    {selectedEmployeeId && (
                                        <div className="space-y-4">
                                            <div className="flex items-center justify-between gap-3 pt-1">
                                                <div>
                                                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                                                        <MapPin size={17} className="text-emerald-400" />
                                                        <span>فروع ولوكيشن الموظف</span>
                                                    </h4>
                                                    <p className="text-xs text-white/50 font-bold">5 خانات افتراضية مع إمكانية إضافة المزيد ديناميكياً</p>
                                                </div>

                                                {/* زر "أضف" أعلى القسم */}
                                                <button
                                                    type="button"
                                                    onClick={handleAddSlot}
                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-4 py-2.5 rounded-xl font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-600/20 active:scale-95 transition cursor-pointer"
                                                >
                                                    <Plus size={16} />
                                                    <span>أضف</span>
                                                </button>
                                            </div>

                                            {/* Datalist for registered branches */}
                                            <datalist id="company-branches-list">
                                                {markets.map((m, idx) => (
                                                    <option key={idx} value={m} />
                                                ))}
                                            </datalist>

                                            {/* Branch Slots List */}
                                            <div className="space-y-3">
                                                {branchSlots.map((slot, index) => (
                                                    <div 
                                                        key={slot.id || index}
                                                        className="bg-gray-800/80 p-3.5 sm:p-4 rounded-2xl border border-white/10 hover:border-white/20 transition-all space-y-3"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-2">
                                                                <span className="w-6 h-6 rounded-lg bg-blue-600/30 text-blue-300 font-mono font-bold text-xs flex items-center justify-center border border-blue-500/30">
                                                                    {index + 1}
                                                                </span>
                                                                <span className="text-xs font-black text-gray-300">
                                                                    الخانة رقم {index + 1}
                                                                </span>
                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveSlot(index)}
                                                                className="text-gray-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition"
                                                                title={branchSlots.length > 5 ? "حذف هذه الخانة" : "تفريغ الخانة"}
                                                            >
                                                                <Trash2 size={15} />
                                                            </button>
                                                        </div>

                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                            {/* Field 1: اسم الفرع */}
                                                            <div>
                                                                <label className="block text-[11px] font-bold text-gray-400 mb-1">
                                                                    اسم الفرع
                                                                </label>
                                                                <input
                                                                    type="text"
                                                                    list="company-branches-list"
                                                                    placeholder="اختر أو اكتب اسم الفرع..."
                                                                    value={slot.branchName}
                                                                    onChange={e => handleUpdateSlotField(index, 'branchName', e.target.value)}
                                                                    className="w-full bg-gray-900 text-white text-xs font-bold px-3.5 py-2.5 rounded-xl border border-white/10 focus:border-blue-500 outline-none"
                                                                />
                                                            </div>

                                                            {/* Field 2: إحداثيات اللوكيشن */}
                                                            <div>
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <label className="text-[11px] font-bold text-gray-400">
                                                                        إحداثيات اللوكيشن (Lat, Lng)
                                                                    </label>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleGetDeviceCoordinates(index)}
                                                                        className="text-[10px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1"
                                                                        title="جلب إحداثيات موقعي الحالي"
                                                                    >
                                                                        <Navigation size={10} />
                                                                        <span>موقعي الحالي</span>
                                                                    </button>
                                                                </div>
                                                                <input
                                                                    type="text"
                                                                    dir="ltr"
                                                                    placeholder="30.0444, 31.2357"
                                                                    value={slot.coordinates}
                                                                    onChange={e => handleUpdateSlotField(index, 'coordinates', e.target.value)}
                                                                    className="w-full bg-gray-900 text-white font-mono text-xs px-3.5 py-2.5 rounded-xl border border-white/10 focus:border-blue-500 outline-none"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* ========================================= */}
                            {/* TAB 3: العاملين (إظهار وإخفاء الحسابات)    */}
                            {/* ========================================= */}
                            {activeTab === 'employees' && (
                                <div className="space-y-4 animate-in fade-in duration-200">
                                    <div className="bg-white/5 p-4 rounded-2xl border border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div>
                                            <h4 className="text-sm font-black text-white flex items-center gap-2">
                                                <Users size={17} className="text-blue-400" />
                                                <span>قائمة العاملين والحسابات المسجلة</span>
                                            </h4>
                                            <p className="text-xs text-white/50 font-bold mt-1">
                                                تحكم في ظهور أو إخفاء الموظفين من نظام وسجلات الحضور والانصراف
                                            </p>
                                        </div>

                                        <div className="relative w-full sm:w-64">
                                            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="بحث عن اسم أو حساب..."
                                                value={employeeFilterSearch}
                                                onChange={e => setEmployeeFilterSearch(e.target.value)}
                                                className="w-full bg-gray-800 text-white text-xs font-bold pr-9 pl-3 py-2 rounded-xl border border-white/10 focus:border-blue-500 outline-none"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                                        {usersList
                                            .filter(u => !u.isArchived)
                                            .filter(u => {
                                                if (!employeeFilterSearch.trim()) return true;
                                                const term = employeeFilterSearch.toLowerCase();
                                                const uName = (u.name || '').toLowerCase();
                                                const uUser = (u.username || '').toLowerCase();
                                                return uName.includes(term) || uUser.includes(term);
                                            })
                                            .map((emp) => {
                                                const empKey = emp.key || emp.username || '';
                                                const hidden = isEmployeeHidden(emp);

                                                return (
                                                    <div 
                                                        key={empKey}
                                                        className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                                                            hidden 
                                                                ? 'bg-rose-950/20 border-rose-500/30' 
                                                                : 'bg-gray-800/80 border-white/10 hover:border-white/20'
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2.5 rounded-xl border ${
                                                                hidden 
                                                                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' 
                                                                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                                            }`}>
                                                                {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-sm font-bold text-white">{emp.name || emp.username}</span>
                                                                    {emp.role === 'admin' && (
                                                                        <span className="text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded font-bold">
                                                                            مدير
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="text-xs text-gray-400 font-mono flex items-center gap-2 mt-0.5">
                                                                    <span>@{emp.username}</span>
                                                                    <span>•</span>
                                                                    <span className={hidden ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                                                                        {hidden ? 'محجوب من الحضور' : 'ظاهر للجميع'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleEmployeeVisibility(empKey)}
                                                            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition cursor-pointer active:scale-95 shadow-md ${
                                                                hidden
                                                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                                                                    : 'bg-rose-600/80 hover:bg-rose-600 text-white shadow-rose-600/30'
                                                            }`}
                                                        >
                                                            {hidden ? (
                                                                <>
                                                                    <Eye size={14} />
                                                                    <span>إظهار</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <EyeOff size={14} />
                                                                    <span>إخفاء</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                </div>
                            )}

                            {/* ========================================= */}
                            {/* TAB 4: إعدادات إضافية (بدء التسجيل وتعليق النظام / وضع الصيانة) */}
                            {/* ========================================= */}
                            {activeTab === 'advanced' && (
                                <div className="space-y-6 animate-in fade-in duration-200">
                                    {/* SECTION 1: بدء تسجيل الحضور والانصراف (مطلوب للتشغيل) */}
                                    <div className="bg-gradient-to-r from-emerald-950/50 via-gray-900 to-gray-900 border-2 border-emerald-500/40 p-5 rounded-2xl shadow-xl space-y-4">
                                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
                                            <div className="flex items-center gap-3">
                                                <div className={`p-3 rounded-2xl border ${
                                                    isAttendanceStarted 
                                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400/40' 
                                                        : 'bg-amber-500/20 text-amber-400 border-amber-400/40'
                                                }`}>
                                                    <PlayCircle size={24} />
                                                </div>
                                                <div>
                                                    <h4 className="text-base font-black text-white flex items-center gap-2">
                                                        <span>بدء تسجيل الحضور والانصراف</span>
                                                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                                            isAttendanceStarted 
                                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' 
                                                                : 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                                                        }`}>
                                                            {isAttendanceStarted ? '✓ التسجيل نشط ومفعّل' : '⚠ لم يبدأ بعد'}
                                                        </span>
                                                    </h4>
                                                    <p className="text-xs text-gray-300 mt-1 font-semibold leading-relaxed">
                                                        {isAttendanceStarted
                                                            ? 'النظام نشط ومفتوح لتسجيل الحضور والانصراف للعاملين في الفروع.'
                                                            : 'لا يمكن تسجيل حضور وانصراف إلا من البداية عند الضغط على زر "ابدأ تسجيل الحضور والانصراف". سيتم مسح وتصفير أي تسجيل عشوائي تلقائياً.'}
                                                    </p>
                                                    {attendanceStartedInfo?.startedAt && isAttendanceStarted && (
                                                        <p className="text-[11px] text-emerald-400 font-mono mt-1">
                                                            بدأ التسجيل بتاريخ: {new Date(attendanceStartedInfo.startedAt).toLocaleString('ar-EG')} {attendanceStartedInfo.startedBy ? `(بواسطة ${attendanceStartedInfo.startedBy})` : ''}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-3 pt-1">
                                            {!isAttendanceStarted ? (
                                                <button
                                                    type="button"
                                                    onClick={handleStartAttendanceSystem}
                                                    disabled={isSavingSettings}
                                                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-600/30 active:scale-95 transition cursor-pointer"
                                                >
                                                    <PlayCircle size={18} />
                                                    <span>ابدأ تسجيل الحضور والانصراف</span>
                                                </button>
                                            ) : (
                                                <div className="flex flex-wrap items-center gap-2.5 w-full">
                                                    <button
                                                        type="button"
                                                        onClick={handleStopAttendanceSystem}
                                                        disabled={isSavingSettings}
                                                        className="px-4 py-2.5 rounded-xl bg-amber-600/80 hover:bg-amber-600 text-white font-black text-xs flex items-center gap-2 shadow transition active:scale-95 cursor-pointer"
                                                    >
                                                        <PauseCircle size={16} />
                                                        <span>إيقاف تسجيل الحضور والانصراف مؤقتاً</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={handlePurgeRandomAttendance}
                                                        disabled={isSavingSettings}
                                                        className="px-4 py-2.5 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white font-black text-xs flex items-center gap-2 shadow transition active:scale-95 cursor-pointer"
                                                    >
                                                        <Trash2 size={16} />
                                                        <span>حذف وتصفير أي تسجيل عشوائي حالي</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* SECTION 2: Header Banner for Suspension */}
                                    <div className="bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-purple-900/40 p-5 rounded-2xl border border-blue-500/30">
                                        <div className="flex items-center gap-3">
                                            <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/40">
                                                <Sliders size={22} />
                                            </div>
                                            <div>
                                                <h4 className="text-base font-black text-white flex items-center gap-2">
                                                    <span>إعدادات إضافية: تعليق النظام / وضع الصيانة</span>
                                                    <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30 font-bold">
                                                        System Suspension Mode
                                                    </span>
                                                </h4>
                                                <p className="text-xs text-white/60 font-semibold mt-1">
                                                    التحكم في إتاحة تسجيل الحضور والانصراف للموظفين، أو تعليق التسجيل لفترة زمنية محددة بالأيام مع تشغيل العداد التنازلي الحي.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* System Status Current Card */}
                                    <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                                        isSystemSuspended 
                                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-200' 
                                            : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
                                    }`}>
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2.5 rounded-xl border ${
                                                isSystemSuspended 
                                                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' 
                                                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                            }`}>
                                                {isSystemSuspended ? <Hourglass size={20} className="animate-spin" style={{ animationDuration: '6s' }} /> : <CheckCircle2 size={20} />}
                                            </div>
                                            <div>
                                                <div className="text-xs font-black">
                                                    {isSystemSuspended ? 'الحالة الحالية: النظام في وضع التعليق (معلق)' : 'الحالة الحالية: فتح التسجيل (النظام نشط)'}
                                                </div>
                                                <div className="text-[11px] opacity-80 font-mono mt-0.5">
                                                    {isSystemSuspended ? `المتبقي في العداد: ${countdown.formatted}` : 'يمكن لجميع الموظفين تسجيل الحضور والانصراف بصورة طبيعية'}
                                                </div>
                                            </div>
                                        </div>

                                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                                            isSystemSuspended 
                                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' 
                                                : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                        }`}>
                                            {isSystemSuspended ? 'معلق مؤقتاً' : 'مفتوح للجميع'}
                                        </span>
                                    </div>

                                    {/* Radio / Toggle Options */}
                                    <div className="space-y-3">
                                        <label className="block text-xs font-black text-gray-300">
                                            اختر حالة نظام الحضور والانصراف:
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {/* Option 1: فتح التسجيل */}
                                            <div
                                                onClick={() => setIsSuspended(false)}
                                                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                                                    !isSuspended 
                                                        ? 'bg-emerald-950/40 border-emerald-500 shadow-lg shadow-emerald-900/20 ring-1 ring-emerald-500/50' 
                                                        : 'bg-gray-800/60 border-white/10 hover:border-white/20'
                                                }`}
                                            >
                                                <div className={`p-2 rounded-xl mt-0.5 border ${
                                                    !isSuspended 
                                                        ? 'bg-emerald-500 text-white border-emerald-400' 
                                                        : 'bg-white/5 text-gray-400 border-white/10'
                                                }`}>
                                                    <PlayCircle size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-black text-white">فتح التسجيل</span>
                                                        <input 
                                                            type="radio" 
                                                            name="suspension_mode" 
                                                            checked={!isSuspended} 
                                                            onChange={() => setIsSuspended(false)}
                                                            className="accent-emerald-500 w-4 h-4 cursor-pointer"
                                                        />
                                                    </div>
                                                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                                                        واجهة النظام الطبيعية بجميع تفاصيلها (أزرار الحضور والانصراف، القوائم، تفاصيل الخصومات، وغيرها).
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Option 2: تعليق التسجيل */}
                                            <div
                                                onClick={() => setIsSuspended(true)}
                                                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-start gap-3 ${
                                                    isSuspended 
                                                        ? 'bg-amber-950/40 border-amber-500 shadow-lg shadow-amber-900/20 ring-1 ring-amber-500/50' 
                                                        : 'bg-gray-800/60 border-white/10 hover:border-white/20'
                                                }`}
                                            >
                                                <div className={`p-2 rounded-xl mt-0.5 border ${
                                                    isSuspended 
                                                        ? 'bg-amber-500 text-black border-amber-400' 
                                                        : 'bg-white/5 text-gray-400 border-white/10'
                                                }`}>
                                                    <PauseCircle size={20} />
                                                </div>
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-sm font-black text-white">تعليق التسجيل</span>
                                                        <input 
                                                            type="radio" 
                                                            name="suspension_mode" 
                                                            checked={isSuspended} 
                                                            onChange={() => setIsSuspended(true)}
                                                            className="accent-amber-500 w-4 h-4 cursor-pointer"
                                                        />
                                                    </div>
                                                    <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                                                        إخفاء عناصر الشاشة وإظهار الساعة اللحظية ورسالة "جاري العمل به" مع العداد التنازلي الحي.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* When Suspended: Duration Input & Quick Presets */}
                                    {isSuspended && (
                                        <div className="bg-amber-500/10 border border-amber-500/30 p-5 rounded-2xl space-y-4 animate-in slide-in-from-top-2 duration-200">
                                            <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                                                <Timer size={18} />
                                                <span>تحديد مدة التعليق (بالأيام) *</span>
                                            </div>

                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                                                <div className="relative flex-1">
                                                    <input 
                                                        type="number"
                                                        min="1"
                                                        max="365"
                                                        value={suspensionDays}
                                                        onChange={e => setSuspensionDays(Math.max(1, Number(e.target.value) || 1))}
                                                        className="w-full bg-gray-900 text-white font-mono font-bold text-base px-4 py-3 rounded-xl border border-amber-500/40 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none text-left"
                                                        placeholder="مثال: 3"
                                                        dir="ltr"
                                                    />
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-amber-400">
                                                        يوم
                                                    </span>
                                                </div>

                                                {/* Quick Presets */}
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {[1, 2, 3, 5, 7, 14, 30].map(daysNum => (
                                                        <button
                                                            key={daysNum}
                                                            type="button"
                                                            onClick={() => setSuspensionDays(daysNum)}
                                                            className={`px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 ${
                                                                suspensionDays === daysNum 
                                                                    ? 'bg-amber-500 text-black font-black shadow-md shadow-amber-500/30' 
                                                                    : 'bg-white/5 hover:bg-white/10 text-gray-300 border border-white/5'
                                                            }`}
                                                        >
                                                            {daysNum} {daysNum === 1 ? 'يوم' : daysNum === 2 ? 'يومان' : daysNum <= 10 ? 'أيام' : 'يوم'}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Preview Calculation */}
                                            <div className="bg-black/40 p-3.5 rounded-xl border border-white/5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                <span className="text-gray-400 font-bold">موعد انتهاء التعليق المحسوب تلقائياً:</span>
                                                <span className="text-amber-300 font-bold font-mono">
                                                    {new Date(Date.now() + (Math.max(1, Number(suspensionDays) || 1)) * 24 * 60 * 60 * 1000).toLocaleString('ar-EG', {
                                                        weekday: 'long',
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Action Buttons within Tab */}
                                    <div className="pt-2 flex justify-end">
                                        <button
                                            type="button"
                                            onClick={() => handleSaveSuspensionSettings()}
                                            disabled={isSavingSettings}
                                            className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 active:scale-95 transition cursor-pointer disabled:opacity-50"
                                        >
                                            <Save size={16} />
                                            <span>{isSavingSettings ? 'جاري الحفظ...' : 'حفظ إعدادات حالة التعليق الآن'}</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer with Save Button */}
                        <div className="p-4 sm:p-5 border-t border-white/10 bg-gray-850 flex items-center justify-between gap-3">
                            <div>
                                {settingsSaveMsg && (
                                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 animate-in fade-in">
                                        <CheckCircle2 size={16} />
                                        <span>{settingsSaveMsg}</span>
                                    </span>
                                )}
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAdminSettings(false)}
                                    className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold transition cursor-pointer"
                                >
                                    إلغاء
                                </button>

                                <button
                                    type="button"
                                    onClick={handleSaveSettings}
                                    disabled={isSavingSettings}
                                    className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-lg shadow-blue-600/30 active:scale-95 transition cursor-pointer disabled:opacity-50"
                                >
                                    <Save size={16} />
                                    <span>{isSavingSettings ? 'جاري الحفظ...' : 'حفظ'}</span>
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* Check-In / Check-Out Action Modal Popup                   */}
            {/* ========================================================= */}
            {showActionModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
                    <div className="w-full max-w-md bg-gray-900 text-white rounded-3xl border border-white/15 shadow-2xl overflow-hidden animate-in zoom-in-95 space-y-5 p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                            <div className="flex items-center gap-2.5">
                                <div className={`p-2.5 rounded-xl border ${
                                    actionModalMode === 'check_in' 
                                        ? 'bg-emerald-600/20 text-emerald-400 border-emerald-500/30' 
                                        : 'bg-rose-600/20 text-rose-400 border-rose-500/30'
                                }`}>
                                    {actionModalMode === 'check_in' ? <LogIn size={20} /> : <LogOut size={20} />}
                                </div>
                                <div>
                                    <h3 className="font-black text-base sm:text-lg text-white">
                                        {actionModalMode === 'check_in' ? 'تسجيل الحضور والبريك' : 'تسجيل الانصراف'}
                                    </h3>
                                    <p className="text-xs text-gray-400 font-bold">
                                        {user.name || user.username}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setShowActionModal(false);
                                    setBranchSelectionError(null);
                                }}
                                className="text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition cursor-pointer"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Live Digital Clock */}
                        <div className="bg-gray-950/80 border border-white/10 p-4 rounded-2xl text-center space-y-1">
                            <span className="text-[11px] text-gray-400 font-bold block">الوقت المعتمد للتسجيل لحظياً</span>
                            <div className="text-3xl sm:text-4xl font-black font-mono text-emerald-400 tracking-wider">
                                {liveTimeObj.time}
                            </div>
                            <div className="text-xs font-bold text-gray-300">
                                {liveTimeObj.ampm} ({liveTimeObj.ampmArabic}) • {currentDayName} {todayDate}
                            </div>
                        </div>

                        {/* Branch Dropdown */}
                        <div className="space-y-1.5 text-right">
                            <label className="text-xs font-bold text-gray-300 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Building2 size={15} className="text-blue-400" />
                                    <span>اختر الفرع المسجل للحساب *</span>
                                </span>
                                {userRegisteredBranches.length > 0 && (
                                    <span className="text-[10px] text-gray-400 font-mono">
                                        ({userRegisteredBranches.length} فروع متاحة)
                                    </span>
                                )}
                            </label>
                            <select
                                value={actionModalSelectedBranch}
                                onChange={e => {
                                    setActionModalSelectedBranch(e.target.value);
                                    setBranchSelectionError(null);
                                }}
                                className="w-full bg-gray-800 text-white font-bold text-sm px-4 py-3 rounded-xl border border-white/10 focus:border-blue-500 outline-none cursor-pointer"
                            >
                                <option value="">-- اضغط لاختيار الفرع --</option>
                                {userRegisteredBranches.map((bName, idx) => (
                                    <option key={idx} value={bName}>
                                        {bName}
                                    </option>
                                ))}
                            </select>
                            {branchSelectionError && (
                                <p className="text-xs text-rose-400 font-bold flex items-center gap-1 mt-1">
                                    <AlertCircle size={14} />
                                    <span>{branchSelectionError}</span>
                                </p>
                            )}
                        </div>

                        {/* Action Buttons */}
                        <div className="space-y-2.5 pt-2">
                            {actionModalMode === 'check_in' ? (
                                <>
                                    <button
                                        type="button"
                                        disabled={isSubmitting || !!myRecord?.checkInTime}
                                        onClick={() => executeAttendanceAction('check_in')}
                                        className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 active:scale-95 transition cursor-pointer disabled:opacity-50"
                                    >
                                        {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
                                        <span>تسجيل حضور</span>
                                    </button>

                                    <button
                                        type="button"
                                        disabled={isSubmitting}
                                        onClick={() => executeAttendanceAction('break_return')}
                                        className="w-full py-3 px-4 rounded-xl bg-amber-600/90 hover:bg-amber-600 text-white font-black text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-amber-600/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
                                    >
                                        <Coffee size={17} />
                                        <span>حضور بريك</span>
                                    </button>

                                    <button
                                        type="button"
                                        disabled={isSubmitting || !myRecord?.checkInTime || !!myRecord?.checkOutTime}
                                        onClick={() => executeAttendanceAction('check_out')}
                                        className="w-full py-3 px-4 rounded-xl bg-rose-600/80 hover:bg-rose-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition cursor-pointer disabled:opacity-40"
                                    >
                                        <LogOut size={16} />
                                        <span>تسجيل انصراف</span>
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    disabled={isSubmitting || !myRecord?.checkInTime || !!myRecord?.checkOutTime}
                                    onClick={() => executeAttendanceAction('check_out')}
                                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-rose-600/30 active:scale-95 transition cursor-pointer disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <LogOut size={18} />}
                                    <span>تسجيل الانصراف وتأكيد الخروج</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => {
                                    setShowActionModal(false);
                                    setBranchSelectionError(null);
                                }}
                                className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold text-xs transition cursor-pointer"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Phase 5: Records and Reports Modal */}
            <AttendanceRecordsModal
                isOpen={showRecordsModal}
                onClose={() => setShowRecordsModal(false)}
                user={user}
                usersList={usersList}
                markets={markets}
            />
        </div>
    );
};

export default Attendance;
