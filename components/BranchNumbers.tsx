import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { ref, onValue, set, push, update, get } from 'firebase/database';
import { onCachedValue } from '../firebaseCache';
import { User, ContactPerson, BranchContactRecord } from '../types';
import { 
    PhoneCall, Plus, Trash2, Save, FileSpreadsheet, FileDown, 
    Printer, Copy, Check, User as UserIcon, Shield, Briefcase, 
    Building2, Phone, X, Search, CheckCircle2, ChevronDown, 
    ChevronLeft, ExternalLink, RefreshCw, LayoutGrid, List, Edit2
} from 'lucide-react';
import { exportToExcel } from '../utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Props {
    user: User;
    theme: string;
    markets?: string[];
}

export const BranchNumbers: React.FC<Props> = ({ user, theme, markets = [] }) => {
    // Firebase Data States
    const [allEmployeeLocations, setAllEmployeeLocations] = useState<Record<string, any>>({});
    const [customBranches, setCustomBranches] = useState<string[]>([]);
    const [branchContactsMap, setBranchContactsMap] = useState<Record<string, BranchContactRecord>>({});
    const [usersList, setUsersList] = useState<User[]>([]);
    
    // UI & Form States
    const [selectedBranch, setSelectedBranch] = useState<string>('');
    const [adminSelectedEmployee, setAdminSelectedEmployee] = useState<string>('all');
    
    // Current Form Contacts for Selected Branch
    const [supervisors, setSupervisors] = useState<ContactPerson[]>([
        { id: 'sup-1', name: '', phone: '' }
    ]);
    const [managers, setManagers] = useState<ContactPerson[]>([
        { id: 'man-1', name: '', phone: '' }
    ]);

    // Modal & Toast States
    const [showAddBranchModal, setShowAddBranchModal] = useState<boolean>(false);
    const [newBranchInput, setNewBranchInput] = useState<string>('');
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [saveToast, setSaveToast] = useState<string | null>(null);
    const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
    const [searchFilter, setSearchFilter] = useState<string>('');
    const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

    // View mode: 'grid' (2 cards per row on mobile) or 'list' (stacked rows with left arrow)
    const [directoryViewMode, setDirectoryViewMode] = useState<'grid' | 'list'>('grid');
    // Branch details modal for viewing and 1-tap copying
    const [activeDetailBranch, setActiveDetailBranch] = useState<string | null>(null);
    // Editing modal for updating branch names and numbers
    const [editingBranchData, setEditingBranchData] = useState<{
        branchName: string;
        supervisors: ContactPerson[];
        managers: ContactPerson[];
    } | null>(null);
    const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);

    const printContainerRef = useRef<HTMLDivElement>(null);

    const userIdentifier = user.key || user.username || 'unknown_user';

    // Helper: sanitize Firebase Realtime Database path key
    const sanitizeKey = (name: string): string => {
        if (!name) return '';
        return name.trim().replace(/[.#$/[\]]/g, '_');
    };

    // 1. Listen to employee locations (فروع ولوكيشن الموظف)
    useEffect(() => {
        const locationsRef = ref(db, 'attendance_settings/employee_locations');
        const unsub = onCachedValue(locationsRef, 'attendance_employee_locations', (snapshot) => {
            if (snapshot.exists()) {
                setAllEmployeeLocations(snapshot.val() || {});
            } else {
                setAllEmployeeLocations({});
            }
        });
        return () => unsub();
    }, []);

    // 2. Listen to custom added branches for this user (or all if admin)
    useEffect(() => {
        const customRef = ref(db, `branch_numbers_custom_branches/${userIdentifier}`);
        const unsub = onValue(customRef, (snapshot) => {
            if (snapshot.exists()) {
                const val = snapshot.val();
                if (typeof val === 'object' && val !== null) {
                    const list: string[] = Object.values(val).map((item: any) => {
                        return typeof item === 'string' ? item : item?.name || '';
                    }).filter(Boolean);
                    setCustomBranches(Array.from(new Set(list)));
                }
            } else {
                setCustomBranches([]);
            }
        });
        return () => unsub();
    }, [userIdentifier]);

    // 3. Listen to all branch contacts in real-time
    useEffect(() => {
        const contactsRef = ref(db, 'branch_contacts');
        const unsub = onValue(contactsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val() || {};
                setBranchContactsMap(data);
            } else {
                setBranchContactsMap({});
            }
        });
        return () => unsub();
    }, []);

    // 4. Listen to users list if admin
    useEffect(() => {
        if (user.role === 'admin') {
            const usersRef = ref(db, 'users');
            const unsub = onCachedValue(usersRef, 'users', (snapshot) => {
                if (snapshot.exists()) {
                    const list: User[] = [];
                    snapshot.forEach((child) => {
                        list.push({ key: child.key!, ...child.val() });
                    });
                    setUsersList(list.filter(u => !u.isArchived));
                }
            });
            return () => unsub();
        }
    }, [user.role]);

    // 5. Compute available branches for the user
    // CRITICAL: Normal employee (e.g., Hasan) ONLY sees their own registered branches from employee_locations + customBranches
    const employeeRegisteredBranches = useMemo(() => {
        const branchSet = new Set<string>();

        if (user.role === 'admin' && adminSelectedEmployee !== 'all') {
            // Admin selected a specific employee
            const empSlots = allEmployeeLocations[adminSelectedEmployee] || [];
            if (Array.isArray(empSlots)) {
                empSlots.forEach((slot: any) => {
                    if (slot && slot.branchName && slot.branchName.trim()) {
                        branchSet.add(slot.branchName.trim());
                    }
                });
            }
        } else if (user.role === 'admin' && adminSelectedEmployee === 'all') {
            // Admin sees all branches from all employees + markets
            Object.values(allEmployeeLocations).forEach((empSlots: any) => {
                if (Array.isArray(empSlots)) {
                    empSlots.forEach((slot: any) => {
                        if (slot && slot.branchName && slot.branchName.trim()) {
                            branchSet.add(slot.branchName.trim());
                        }
                    });
                }
            });
            markets.forEach(m => {
                if (m && m.trim()) branchSet.add(m.trim());
            });
            customBranches.forEach(b => {
                if (b && b.trim()) branchSet.add(b.trim());
            });
        } else {
            // REGULAR EMPLOYEE (Hasan, Malak, etc.):
            // Strictly fetch only the slots belonging to this user!
            const mySlots = allEmployeeLocations[userIdentifier] || 
                           (user.key ? allEmployeeLocations[user.key] : null) || 
                           (user.username ? allEmployeeLocations[user.username] : null) || 
                           [];
            
            if (Array.isArray(mySlots)) {
                mySlots.forEach((slot: any) => {
                    if (slot && slot.branchName && slot.branchName.trim()) {
                        branchSet.add(slot.branchName.trim());
                    }
                });
            }

            // Include custom branches added by this employee
            customBranches.forEach(b => {
                if (b && b.trim()) branchSet.add(b.trim());
            });
        }

        const sorted = Array.from(branchSet).sort((a, b) => a.localeCompare(b, 'ar'));
        return sorted;
    }, [user.role, adminSelectedEmployee, allEmployeeLocations, userIdentifier, user.key, user.username, markets, customBranches]);

    // Auto-select first branch if none selected or selected not in list
    useEffect(() => {
        if (employeeRegisteredBranches.length > 0) {
            if (!selectedBranch || !employeeRegisteredBranches.includes(selectedBranch)) {
                setSelectedBranch(employeeRegisteredBranches[0]);
            }
        } else {
            setSelectedBranch('');
        }
    }, [employeeRegisteredBranches, selectedBranch]);

    // When selectedBranch changes or branchContactsMap updates, populate form
    useEffect(() => {
        if (!selectedBranch) {
            setSupervisors([{ id: 'sup-1', name: '', phone: '' }]);
            setManagers([{ id: 'man-1', name: '', phone: '' }]);
            return;
        }

        const key = sanitizeKey(selectedBranch);
        const savedData = branchContactsMap[key];

        if (savedData) {
            if (Array.isArray(savedData.supervisors) && savedData.supervisors.length > 0) {
                setSupervisors(savedData.supervisors.map(s => ({
                    id: s.id || Math.random().toString(36).substr(2, 6),
                    name: s.name || '',
                    phone: s.phone || ''
                })));
            } else {
                setSupervisors([{ id: 'sup-1', name: '', phone: '' }]);
            }

            if (Array.isArray(savedData.managers) && savedData.managers.length > 0) {
                setManagers(savedData.managers.map(m => ({
                    id: m.id || Math.random().toString(36).substr(2, 6),
                    name: m.name || '',
                    phone: m.phone || ''
                })));
            } else {
                setManagers([{ id: 'man-1', name: '', phone: '' }]);
            }
        } else {
            setSupervisors([{ id: 'sup-1', name: '', phone: '' }]);
            setManagers([{ id: 'man-1', name: '', phone: '' }]);
        }
    }, [selectedBranch, branchContactsMap]);

    // Add Supervisor Row
    const handleAddSupervisorRow = () => {
        setSupervisors(prev => [
            ...prev,
            { id: 'sup-' + Date.now().toString(), name: '', phone: '' }
        ]);
    };

    // Remove Supervisor Row
    const handleRemoveSupervisorRow = (id: string) => {
        if (supervisors.length <= 1) {
            setSupervisors([{ id: 'sup-1', name: '', phone: '' }]);
            return;
        }
        setSupervisors(prev => prev.filter(s => s.id !== id));
    };

    // Update Supervisor field
    const handleUpdateSupervisorField = (id: string, field: 'name' | 'phone', val: string) => {
        setSupervisors(prev => prev.map(s => s.id === id ? { ...s, [field]: val } : s));
    };

    // Add Manager Row
    const handleAddManagerRow = () => {
        setManagers(prev => [
            ...prev,
            { id: 'man-' + Date.now().toString(), name: '', phone: '' }
        ]);
    };

    // Remove Manager Row
    const handleRemoveManagerRow = (id: string) => {
        if (managers.length <= 1) {
            setManagers([{ id: 'man-1', name: '', phone: '' }]);
            return;
        }
        setManagers(prev => prev.filter(m => m.id !== id));
    };

    // Update Manager field
    const handleUpdateManagerField = (id: string, field: 'name' | 'phone', val: string) => {
        setManagers(prev => prev.map(m => m.id === id ? { ...m, [field]: val } : m));
    };

    // Save contacts for selected branch
    const handleSaveContacts = async () => {
        if (!selectedBranch || !selectedBranch.trim()) {
            alert('يرجى اختيار الفرع أولاً');
            return;
        }

        setIsSaving(true);
        try {
            const key = sanitizeKey(selectedBranch);
            
            // Clean empty entries
            const validSupervisors = supervisors
                .map(s => ({ id: s.id, name: s.name.trim(), phone: s.phone.trim() }))
                .filter(s => s.name || s.phone);
                
            const validManagers = managers
                .map(m => ({ id: m.id, name: m.name.trim(), phone: m.phone.trim() }))
                .filter(m => m.name || m.phone);

            const record: BranchContactRecord = {
                branchName: selectedBranch.trim(),
                supervisors: validSupervisors,
                managers: validManagers,
                updatedAt: Date.now(),
                updatedBy: user.name || user.username || 'مستخدم'
            };

            await set(ref(db, `branch_contacts/${key}`), record);

            // Show instant success notification
            setSaveToast(`تم حفظ وتحديث أرقام فرع "${selectedBranch}" بنجاح لحظياً!`);
            setTimeout(() => setSaveToast(null), 4000);
        } catch (error) {
            console.error('Save branch contact error:', error);
            alert('حدث خطأ أثناء حفظ البيانات، يرجى المحاولة مرة أخرى');
        } finally {
            setIsSaving(false);
        }
    };

    // Add new custom branch
    const handleConfirmAddBranch = async () => {
        const trimmed = newBranchInput.trim();
        if (!trimmed) {
            alert('يرجى إدخال اسم الفرع');
            return;
        }

        try {
            // Save under user's custom branches
            await push(ref(db, `branch_numbers_custom_branches/${userIdentifier}`), {
                name: trimmed,
                createdAt: Date.now()
            });

            // Also check if user has empty slot in employee_locations and add it there
            const mySlots = allEmployeeLocations[userIdentifier] || [];
            if (Array.isArray(mySlots)) {
                const emptySlotIndex = mySlots.findIndex((s: any) => !s.branchName || !s.branchName.trim());
                if (emptySlotIndex >= 0) {
                    const updated = [...mySlots];
                    updated[emptySlotIndex] = {
                        ...updated[emptySlotIndex],
                        branchName: trimmed
                    };
                    await set(ref(db, `attendance_settings/employee_locations/${userIdentifier}`), updated);
                }
            }

            setSelectedBranch(trimmed);
            setNewBranchInput('');
            setShowAddBranchModal(false);
            setSaveToast(`تمت إضافة فرع "${trimmed}" وتحديده بنجاح!`);
            setTimeout(() => setSaveToast(null), 3500);
        } catch (error) {
            console.error('Error adding branch:', error);
            alert('حدث خطأ أثناء إضافة الفرع');
        }
    };

    // Copy phone number to clipboard
    const handleCopyPhone = (phone: string) => {
        if (!phone) return;
        navigator.clipboard.writeText(phone);
        setCopiedPhone(phone);
        setTimeout(() => setCopiedPhone(null), 2000);
    };

    // Export to Excel
    const handleExportExcel = () => {
        const rows: any[] = [];

        employeeRegisteredBranches.forEach(branch => {
            const key = sanitizeKey(branch);
            const data = branchContactsMap[key];

            const sups = data?.supervisors || [];
            const mans = data?.managers || [];

            if (sups.length === 0 && mans.length === 0) {
                rows.push({
                    'اسم الفرع': branch,
                    'الصفة / المنصب': 'غير مسجل',
                    'الاسم': '-',
                    'رقم الهاتف': '-',
                    'تاريخ التحديث': data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString('ar-EG') : '-'
                });
            } else {
                sups.forEach(s => {
                    rows.push({
                        'اسم الفرع': branch,
                        'الصفة / المنصب': 'مشرف الفرع',
                        'الاسم': s.name || '-',
                        'رقم الهاتف': s.phone || '-',
                        'تاريخ التحديث': data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString('ar-EG') : '-'
                    });
                });

                mans.forEach(m => {
                    rows.push({
                        'اسم الفرع': branch,
                        'الصفة / المنصب': 'مدير الفرع',
                        'الاسم': m.name || '-',
                        'رقم الهاتف': m.phone || '-',
                        'تاريخ التحديث': data?.updatedAt ? new Date(data.updatedAt).toLocaleDateString('ar-EG') : '-'
                    });
                });
            }
        });

        if (rows.length === 0) {
            alert('لا توجد بيانات فروع متاحة للتصدير');
            return;
        }

        exportToExcel(
            [{ name: 'أرقام_الفروع', data: rows }],
            `دليل_ارقام_فروع_${user.name || user.username}_${new Date().toISOString().split('T')[0]}`
        );
    };

    // Export to PDF with clean layout (prints distinct names/cards without messy page cuts)
    const handleExportPdf = async () => {
        if (!printContainerRef.current) return;
        setIsExportingPdf(true);

        try {
            const container = printContainerRef.current;
            container.style.display = 'block';

            // Allow DOM to render print container completely
            await new Promise(r => setTimeout(r, 250));

            const canvas = await html2canvas(container, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#111827',
                windowWidth: 1000
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

            pdf.save(`دليل_ارقام_فروع_${user.name || user.username}_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('PDF export error:', error);
            alert('حدث خطأ أثناء تصدير ملف PDF');
        } finally {
            setIsExportingPdf(false);
            if (printContainerRef.current) {
                printContainerRef.current.style.display = 'none';
            }
        }
    };

    // Native Browser Print (allows direct print or Save as PDF)
    const handleNativePrint = () => {
        window.print();
    };

    // Open Edit Modal for any branch
    const handleOpenEditBranch = (branchName: string) => {
        const key = sanitizeKey(branchName);
        const saved = branchContactsMap[key];
        const sups = saved?.supervisors && saved.supervisors.length > 0 
            ? saved.supervisors.map(s => ({ ...s, id: s.id || Math.random().toString(36).substr(2, 6) }))
            : [{ id: 'sup-' + Date.now(), name: '', phone: '' }];
        const mans = saved?.managers && saved.managers.length > 0 
            ? saved.managers.map(m => ({ ...m, id: m.id || Math.random().toString(36).substr(2, 6) }))
            : [{ id: 'man-' + Date.now(), name: '', phone: '' }];

        setEditingBranchData({
            branchName,
            supervisors: sups,
            managers: mans
        });
    };

    // Save edited branch data from Edit Modal
    const handleSaveEditedBranch = async () => {
        if (!editingBranchData) return;
        const { branchName, supervisors: editSups, managers: editMans } = editingBranchData;
        setIsSavingEdit(true);

        try {
            const key = sanitizeKey(branchName);
            const validSupervisors = editSups
                .map(s => ({ id: s.id, name: (s.name || '').trim(), phone: (s.phone || '').trim() }))
                .filter(s => s.name || s.phone);
                
            const validManagers = editMans
                .map(m => ({ id: m.id, name: (m.name || '').trim(), phone: (m.phone || '').trim() }))
                .filter(m => m.name || m.phone);

            const record: BranchContactRecord = {
                branchName: branchName.trim(),
                supervisors: validSupervisors,
                managers: validManagers,
                updatedAt: Date.now(),
                updatedBy: user.name || user.username || 'مستخدم'
            };

            await set(ref(db, `branch_contacts/${key}`), record);

            // Sync with main form if identical to currently selectedBranch
            if (selectedBranch === branchName) {
                setSupervisors(validSupervisors.length > 0 ? validSupervisors : [{ id: 'sup-1', name: '', phone: '' }]);
                setManagers(validManagers.length > 0 ? validManagers : [{ id: 'man-1', name: '', phone: '' }]);
            }

            setSaveToast(`تم تحديث أرقام فرع "${branchName}" بنجاح لحظياً!`);
            setTimeout(() => setSaveToast(null), 3500);
            setEditingBranchData(null);
        } catch (err) {
            console.error('Error saving edited branch:', err);
            alert('حدث خطأ أثناء حفظ التعديلات');
        } finally {
            setIsSavingEdit(false);
        }
    };

    // Delete Branch and its contact record
    const handleDeleteBranch = async (branchNameToDelete: string) => {
        if (!branchNameToDelete) return;
        const confirmDelete = window.confirm(`هل أنت متأكد من حذف فرع "${branchNameToDelete}" وجميع أرقامه المسجلة؟`);
        if (!confirmDelete) return;

        try {
            const key = sanitizeKey(branchNameToDelete);

            // 1. Remove contact data from Firebase
            await set(ref(db, `branch_contacts/${key}`), null);

            // 2. Remove from user's custom branches
            const customRef = ref(db, `branch_numbers_custom_branches/${userIdentifier}`);
            const customSnap = await get(customRef);
            if (customSnap.exists()) {
                const val = customSnap.val();
                for (const childKey in val) {
                    const item = val[childKey];
                    const name = typeof item === 'string' ? item : item?.name;
                    if (name === branchNameToDelete) {
                        await set(ref(db, `branch_numbers_custom_branches/${userIdentifier}/${childKey}`), null);
                    }
                }
            }

            // 3. If admin, check all custom branches
            if (user.role === 'admin') {
                const allCustomRef = ref(db, 'branch_numbers_custom_branches');
                const allSnap = await get(allCustomRef);
                if (allSnap.exists()) {
                    const allData = allSnap.val();
                    for (const uKey in allData) {
                        for (const cKey in allData[uKey]) {
                            const item = allData[uKey][cKey];
                            const name = typeof item === 'string' ? item : item?.name;
                            if (name === branchNameToDelete) {
                                await set(ref(db, `branch_numbers_custom_branches/${uKey}/${cKey}`), null);
                            }
                        }
                    }
                }
            }

            setSaveToast(`تم حذف فرع "${branchNameToDelete}" بنجاح!`);
            setTimeout(() => setSaveToast(null), 3500);

            if (activeDetailBranch === branchNameToDelete) {
                setActiveDetailBranch(null);
            }
            if (editingBranchData?.branchName === branchNameToDelete) {
                setEditingBranchData(null);
            }
            if (selectedBranch === branchNameToDelete) {
                const remaining = employeeRegisteredBranches.filter(b => b !== branchNameToDelete);
                setSelectedBranch(remaining[0] || '');
            }
        } catch (err) {
            console.error('Delete branch error:', err);
            alert('حدث خطأ أثناء حذف الفرع');
        }
    };

    // Filter branches in directory view
    const filteredDirectoryBranches = useMemo(() => {
        if (!searchFilter.trim()) return employeeRegisteredBranches;
        const q = searchFilter.trim().toLowerCase();
        return employeeRegisteredBranches.filter(b => {
            if (b.toLowerCase().includes(q)) return true;
            const key = sanitizeKey(b);
            const data = branchContactsMap[key];
            if (!data) return false;
            const hasSup = (data.supervisors || []).some(s => s.name.toLowerCase().includes(q) || s.phone.includes(q));
            const hasMan = (data.managers || []).some(m => m.name.toLowerCase().includes(q) || m.phone.includes(q));
            return hasSup || hasMan;
        });
    }, [employeeRegisteredBranches, searchFilter, branchContactsMap]);

    return (
        <div className="space-y-6 pb-24 text-white">
            {/* Header with Title and Action Buttons */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-900/90 border border-white/10 p-4 sm:p-6 rounded-3xl shadow-xl">
                <div>
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-600/20 text-blue-400 p-2.5 sm:p-3 rounded-2xl border border-blue-500/30">
                            <PhoneCall size={26} />
                        </div>
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                                <span>أرقام الفروع</span>
                                <span className="text-xs font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
                                    {employeeRegisteredBranches.length} فرع
                                </span>
                            </h2>
                            <p className="text-xs text-gray-400 font-bold mt-1">
                                {user.role === 'admin' 
                                    ? 'دليل أرقام المشرفين ومديري الفروع مع التحكم الكامل والتسجيل الفوري'
                                    : `دليل أرقام المشرفين والمديرين الخاص بفروعك المسجلة (${user.name || user.username})`
                                }
                            </p>
                        </div>
                    </div>
                </div>

                {/* Export Buttons: Strictly for Admin only */}
                {user.role === 'admin' && (
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            onClick={handleExportExcel}
                            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white px-3 sm:px-4 py-2.5 rounded-2xl font-bold flex items-center justify-center gap-1.5 transition text-xs shadow-lg active:scale-95 cursor-pointer"
                            title="تصدير جدول الفروع والأرقام إلى ملف إكسيل"
                        >
                            <FileSpreadsheet size={16} />
                            <span>تصدير Excel</span>
                        </button>
                        <button
                            onClick={handleExportPdf}
                            disabled={isExportingPdf}
                            className="flex-1 sm:flex-none bg-rose-600 hover:bg-rose-500 text-white px-3 sm:px-4 py-2.5 rounded-2xl font-bold flex items-center justify-center gap-1.5 transition text-xs shadow-lg active:scale-95 cursor-pointer disabled:opacity-50"
                            title="تصدير تقرير أرقام الفروع كملف PDF"
                        >
                            <FileDown size={16} />
                            <span>{isExportingPdf ? 'جاري التحميل...' : 'تصدير PDF'}</span>
                        </button>
                        <button
                            onClick={handleNativePrint}
                            className="hidden sm:flex bg-gray-800 hover:bg-gray-700 text-gray-200 border border-white/10 px-3 py-2.5 rounded-2xl font-bold items-center justify-center gap-1.5 transition text-xs shadow active:scale-95 cursor-pointer"
                            title="طباعة الدليل"
                        >
                            <Printer size={16} />
                            <span>طباعة</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Instant Toast Notification */}
            {saveToast && (
                <div className="bg-emerald-600/90 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-400 flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-2 text-sm font-bold">
                        <CheckCircle2 size={20} className="shrink-0 text-emerald-200" />
                        <span>{saveToast}</span>
                    </div>
                    <button onClick={() => setSaveToast(null)} className="text-white/80 hover:text-white">
                        <X size={18} />
                    </button>
                </div>
            )}

            {/* Admin Filter: Select Employee to view their specific branches */}
            {user.role === 'admin' && usersList.length > 0 && (
                <div className="bg-gray-900/70 border border-purple-500/20 p-4 rounded-3xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-300">
                        <Shield size={16} />
                        <span>تصفية الفروع حسب الموظف المسجل له (اختياري للإدارة):</span>
                    </div>
                    <select
                        value={adminSelectedEmployee}
                        onChange={e => setAdminSelectedEmployee(e.target.value)}
                        className="bg-gray-800 text-white border border-white/10 rounded-xl p-2.5 text-xs font-bold outline-none focus:border-purple-500"
                    >
                        <option value="all">عرض كل الفروع المسجلة لجميع الموظفين</option>
                        {usersList.map(u => (
                            <option key={u.key || u.username} value={u.key || u.username}>
                                فروع الموظف: {u.name} ({u.username})
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Main Interactive Form Card: Branch Selection & Contact Registration */}
            <div className="bg-gray-900/90 border border-white/10 p-4 sm:p-6 rounded-3xl shadow-2xl space-y-6">
                {/* Top Section: اختر الفرع + زر أضف فرع */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end justify-between gap-3 pb-4 border-b border-white/10">
                    <div className="flex-1 min-w-0">
                        <label className="block text-xs sm:text-sm font-bold text-gray-300 mb-2 flex items-center gap-1.5">
                            <Building2 size={16} className="text-blue-400" />
                            <span>اختر الفرع:</span>
                        </label>
                        <select
                            value={selectedBranch}
                            onChange={e => setSelectedBranch(e.target.value)}
                            className="w-full bg-gray-800 text-white border border-white/20 p-3 sm:p-3.5 rounded-2xl text-sm font-bold outline-none focus:border-blue-500 transition shadow-inner"
                        >
                            {employeeRegisteredBranches.length === 0 ? (
                                <option value="">لا توجد فروع مسجلة لك حالياً</option>
                            ) : (
                                employeeRegisteredBranches.map(branch => (
                                    <option key={branch} value={branch}>
                                        {branch}
                                    </option>
                                ))
                            )}
                        </select>
                    </div>

                    {/* زر أضف فرع بجانب القائمة المنسدلة كما هو مطلوب */}
                    <button
                        type="button"
                        onClick={() => setShowAddBranchModal(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-3 sm:py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 transition text-sm shadow-xl active:scale-95 cursor-pointer shrink-0"
                    >
                        <Plus size={18} />
                        <span>أضف فرع</span>
                    </button>
                </div>

                {selectedBranch ? (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* 1. قسم المشرف (اسم المشرف ورقم المشرف + أضف اسم) */}
                        <div className="bg-gray-800/80 border border-blue-500/20 p-4 sm:p-5 rounded-3xl space-y-4 shadow-lg">
                            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-blue-600/30 text-blue-400 flex items-center justify-center border border-blue-500/30">
                                        <Shield size={16} />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-white text-sm sm:text-base">مشرف الفرع</h3>
                                        <p className="text-[11px] text-gray-400 font-bold">بيانات المشرف أو المشرفين المسند إليهم الفرع</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddSupervisorRow}
                                    className="bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white border border-blue-500/40 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                                    title="إضافة مشرف آخر لنفس الفرع"
                                >
                                    <Plus size={14} />
                                    <span>أضف اسم</span>
                                </button>
                            </div>

                            <div className="space-y-3">
                                {supervisors.map((sup, idx) => (
                                    <div 
                                        key={sup.id} 
                                        className="bg-gray-900/70 p-2.5 sm:p-4 rounded-2xl border border-white/5 space-y-2 transition hover:border-blue-500/30"
                                    >
                                        <div className="grid grid-cols-2 gap-2 sm:gap-3 items-center">
                                            {/* اسم المشرف */}
                                            <div className="min-w-0">
                                                <label className="block text-[10px] sm:text-xs font-bold text-gray-300 mb-1 truncate">
                                                    اسم المشرف {supervisors.length > 1 ? `(${idx + 1})` : ''}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={sup.name}
                                                    onChange={e => handleUpdateSupervisorField(sup.id, 'name', e.target.value)}
                                                    placeholder="اسم المشرف..."
                                                    className="w-full bg-gray-800 text-white border border-white/10 px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold outline-none focus:border-blue-500 transition"
                                                />
                                            </div>

                                            {/* رقم المشرف بجانبه تماماً في الهاتف */}
                                            <div className="min-w-0">
                                                <label className="block text-[10px] sm:text-xs font-bold text-gray-300 mb-1 truncate">
                                                    رقم المشرف {supervisors.length > 1 ? `(${idx + 1})` : ''}
                                                </label>
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="tel"
                                                        value={sup.phone}
                                                        onChange={e => handleUpdateSupervisorField(sup.id, 'phone', e.target.value)}
                                                        placeholder="01012345678"
                                                        className="w-full min-w-0 bg-gray-800 text-white border border-white/10 px-2 sm:px-2.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold outline-none focus:border-blue-500 transition dir-ltr text-right"
                                                    />
                                                    {sup.phone && (
                                                        <a
                                                            href={`tel:${sup.phone}`}
                                                            className="p-2 sm:p-2.5 bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white rounded-xl transition shrink-0"
                                                            title="اتصال مباشر"
                                                        >
                                                            <Phone size={14} />
                                                        </a>
                                                    )}
                                                    {sup.phone && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopyPhone(sup.phone)}
                                                            className="p-2 sm:p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl border border-white/10 transition shrink-0"
                                                            title="نسخ الرقم"
                                                        >
                                                            {copiedPhone === sup.phone ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                                        </button>
                                                    )}
                                                    {supervisors.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveSupervisorRow(sup.id)}
                                                            className="p-2 sm:p-2.5 text-rose-400 hover:bg-rose-500/20 rounded-xl transition shrink-0"
                                                            title="حذف هذا المشرف"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. قسم مدير الفرع (اسم مدير الفرع ورقم مدير الفرع + أضف اسم) */}
                        <div className="bg-gray-800/80 border border-emerald-500/20 p-4 sm:p-5 rounded-3xl space-y-4 shadow-lg">
                            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-xl bg-emerald-600/30 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
                                        <Briefcase size={16} />
                                    </div>
                                    <div>
                                        <h3 className="font-extrabold text-white text-sm sm:text-base">مدير الفرع</h3>
                                        <p className="text-[11px] text-gray-400 font-bold">بيانات مدير أو مسؤولي إدارة الفرع</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAddManagerRow}
                                    className="bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white border border-emerald-500/40 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 cursor-pointer"
                                    title="إضافة مدير آخر لنفس الفرع"
                                >
                                    <Plus size={14} />
                                    <span>أضف اسم</span>
                                </button>
                            </div>

                            <div className="space-y-3">
                                {managers.map((man, idx) => (
                                    <div 
                                        key={man.id} 
                                        className="bg-gray-900/70 p-2.5 sm:p-4 rounded-2xl border border-white/5 space-y-2 transition hover:border-emerald-500/30"
                                    >
                                        <div className="grid grid-cols-2 gap-2 sm:gap-3 items-center">
                                            {/* اسم مدير الفرع */}
                                            <div className="min-w-0">
                                                <label className="block text-[10px] sm:text-xs font-bold text-gray-300 mb-1 truncate">
                                                    اسم مدير الفرع {managers.length > 1 ? `(${idx + 1})` : ''}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={man.name}
                                                    onChange={e => handleUpdateManagerField(man.id, 'name', e.target.value)}
                                                    placeholder="اسم مدير الفرع..."
                                                    className="w-full bg-gray-800 text-white border border-white/10 px-2 sm:px-3 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold outline-none focus:border-emerald-500 transition"
                                                />
                                            </div>

                                            {/* رقم مدير الفرع بجانبه تماماً في الهاتف */}
                                            <div className="min-w-0">
                                                <label className="block text-[10px] sm:text-xs font-bold text-gray-300 mb-1 truncate">
                                                    رقم مدير الفرع {managers.length > 1 ? `(${idx + 1})` : ''}
                                                </label>
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="tel"
                                                        value={man.phone}
                                                        onChange={e => handleUpdateManagerField(man.id, 'phone', e.target.value)}
                                                        placeholder="01012345678"
                                                        className="w-full min-w-0 bg-gray-800 text-white border border-white/10 px-2 sm:px-2.5 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-mono font-bold outline-none focus:border-emerald-500 transition dir-ltr text-right"
                                                    />
                                                    {man.phone && (
                                                        <a
                                                            href={`tel:${man.phone}`}
                                                            className="p-2 sm:p-2.5 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white rounded-xl transition shrink-0"
                                                            title="اتصال مباشر"
                                                        >
                                                            <Phone size={14} />
                                                        </a>
                                                    )}
                                                    {man.phone && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopyPhone(man.phone)}
                                                            className="p-2 sm:p-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-xl border border-white/10 transition shrink-0"
                                                            title="نسخ الرقم"
                                                        >
                                                            {copiedPhone === man.phone ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                                                        </button>
                                                    )}
                                                    {managers.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveManagerRow(man.id)}
                                                            className="p-2 sm:p-2.5 text-rose-400 hover:bg-rose-500/20 rounded-xl transition shrink-0"
                                                            title="حذف هذا المدير"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* زر حفظ الذي يظهر لحظياً عند الحفظ كما طلب المستخدم */}
                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={handleSaveContacts}
                                disabled={isSaving}
                                className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white py-4 rounded-2xl font-black text-base shadow-xl flex items-center justify-center gap-2 transition active:scale-95 cursor-pointer disabled:opacity-50"
                            >
                                <Save size={20} />
                                <span>{isSaving ? 'جاري الحفظ اللحظي...' : `حفظ أرقام (${selectedBranch})`}</span>
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="p-8 text-center text-gray-400 border border-dashed border-white/10 rounded-2xl space-y-2">
                        <Building2 size={36} className="mx-auto text-gray-600" />
                        <p className="font-bold text-sm">لا يوجد فرع محدد حالياً، يرجى اختيار الفرع أو إضافة فرع جديد للبدء في تسجيل الأرقام.</p>
                    </div>
                )}
            </div>

            {/* دليل الفروع المحفوظة (Directory View: Grid 2-per-row in phone OR List view stacked with arrow) */}
            <div className="space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 px-1">
                    <div className="flex items-center gap-2">
                        <Building2 size={20} className="text-blue-400" />
                        <h3 className="font-black text-base sm:text-lg text-white">دليل أرقام فروعك المسجلة</h3>
                        <span className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full font-mono border border-white/10">
                            {filteredDirectoryBranches.length}
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* View Switcher: كروت (2 بالهاتف) vs قائمة (أسفل بعض) */}
                        <div className="flex items-center bg-gray-900 border border-white/10 p-1 rounded-2xl">
                            <button
                                type="button"
                                onClick={() => setDirectoryViewMode('grid')}
                                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                    directoryViewMode === 'grid'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                                title="عرض كروت (فرعان بجانب بعض في الهاتف)"
                            >
                                <LayoutGrid size={14} />
                                <span>كروت (2 بالهاتف)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setDirectoryViewMode('list')}
                                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                    directoryViewMode === 'list'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-gray-400 hover:text-white'
                                }`}
                                title="عرض قائمة (الفروع أسفل بعض مع سهم لفتح البيانات)"
                            >
                                <List size={14} />
                                <span>قائمة (أسفل بعض)</span>
                            </button>
                        </div>

                        {/* Search in Directory */}
                        <div className="relative flex-1 sm:w-56">
                            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchFilter}
                                onChange={e => setSearchFilter(e.target.value)}
                                placeholder="بحث بالفرع أو الرقم..."
                                className="w-full bg-gray-900 border border-white/10 pr-9 pl-3 py-1.5 sm:py-2 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {filteredDirectoryBranches.length === 0 ? (
                    <div className="bg-gray-900/60 border border-white/5 p-8 rounded-3xl text-center text-gray-400 font-bold text-sm">
                        لا توجد فروع مسجلة تطابق البحث
                    </div>
                ) : directoryViewMode === 'list' ? (
                    /* طريقة العرض الأخرى: الفروع أسفل بعض ويظهر اسم الفرع وبجانبه سهم على اليسار عند الضغط عليها يظهر بيانات الفرع وزر حذف أو تعديل */
                    <div className="space-y-2.5">
                        {filteredDirectoryBranches.map(branchName => {
                            const key = sanitizeKey(branchName);
                            const rec = branchContactsMap[key];
                            const sups = rec?.supervisors || [];
                            const mans = rec?.managers || [];
                            const supsCount = sups.filter(s => s.name || s.phone).length;
                            const mansCount = mans.filter(m => m.name || m.phone).length;

                            return (
                                <div
                                    key={branchName}
                                    onClick={() => setActiveDetailBranch(branchName)}
                                    className="bg-gray-900/90 border border-white/10 hover:border-blue-500/50 p-3 sm:p-4 rounded-2xl sm:rounded-3xl shadow-xl transition flex items-center justify-between cursor-pointer active:scale-[0.99] group"
                                >
                                    <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                                        <div className="w-10 h-10 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
                                            <Building2 size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-black text-white text-sm sm:text-base truncate group-hover:text-blue-300 transition">
                                                {branchName}
                                            </h4>
                                            <p className="text-[11px] text-gray-400 font-bold flex items-center gap-2 mt-0.5">
                                                <span>المشرفين: {supsCount}</span>
                                                <span>•</span>
                                                <span>المديرين: {mansCount}</span>
                                                {rec?.updatedAt && (
                                                    <span className="hidden sm:inline text-gray-500">
                                                        • محدث: {new Date(rec.updatedAt).toLocaleDateString('ar-EG')}
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {/* سهم على اليسار عند الضغط عليه يفتح بيانات الفرع */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="hidden sm:inline text-xs text-blue-400 font-bold">عرض البيانات والأرقام</span>
                                        <div className="w-8 h-8 rounded-xl bg-gray-800 text-gray-400 group-hover:text-white group-hover:bg-blue-600 flex items-center justify-center border border-white/10 transition">
                                            <ChevronLeft size={18} />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    /* طريقة عرض الكروت: تظهر 2 فرع بجانب بعض في الهاتف مع جميع التفاصيل */
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
                        {filteredDirectoryBranches.map(branchName => {
                            const key = sanitizeKey(branchName);
                            const rec = branchContactsMap[key];
                            const sups = rec?.supervisors || [];
                            const mans = rec?.managers || [];
                            const isCurrentSelected = selectedBranch === branchName;

                            return (
                                <div 
                                    key={branchName}
                                    onClick={() => setActiveDetailBranch(branchName)}
                                    className={`bg-gray-900/90 border rounded-2xl sm:rounded-3xl p-2.5 sm:p-4 shadow-xl transition flex flex-col justify-between cursor-pointer active:scale-[0.98] group ${
                                        isCurrentSelected ? 'border-blue-500/60 ring-2 ring-blue-500/20' : 'border-white/10 hover:border-blue-500/40'
                                    }`}
                                >
                                    <div className="space-y-2">
                                        {/* Top Header of Card */}
                                        <div className="flex items-start justify-between gap-1 border-b border-white/10 pb-2">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
                                                    <Building2 size={15} />
                                                </div>
                                                <div className="min-w-0">
                                                    <h4 className="font-black text-white text-xs sm:text-sm truncate" title={branchName}>
                                                        {branchName}
                                                    </h4>
                                                    <p className="text-[9px] sm:text-[10px] text-gray-400 truncate">
                                                        {rec?.updatedAt ? new Date(rec.updatedAt).toLocaleDateString('ar-EG') : 'غير مسجل'}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Action Icon to open details & copy */}
                                            <div className="text-gray-400 group-hover:text-blue-400 p-1 shrink-0">
                                                <ChevronLeft size={15} />
                                            </div>
                                        </div>

                                        {/* Contact Details on Card */}
                                        <div className="space-y-2 text-right">
                                            {/* المشرفين */}
                                            <div>
                                                <div className="text-[10px] sm:text-[11px] font-bold text-blue-400 flex items-center gap-1 mb-1">
                                                    <Shield size={11} />
                                                    <span>المشرفين:</span>
                                                </div>
                                                {sups.length > 0 && sups.some(s => s.name || s.phone) ? (
                                                    <div className="space-y-1">
                                                        {sups.filter(s => s.name || s.phone).slice(0, 2).map((s, sIdx) => (
                                                            <div key={s.id || sIdx} className="bg-gray-800/90 p-1.5 sm:p-2 rounded-xl border border-white/5 flex items-center justify-between gap-1 text-[10px] sm:text-xs">
                                                                <span className="font-bold text-white truncate max-w-[80px] sm:max-w-[110px]">{s.name || 'مشرف'}</span>
                                                                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                                                    <span className="font-mono text-gray-300 font-bold dir-ltr text-[9px] sm:text-xs">{s.phone || '-'}</span>
                                                                    {s.phone && (
                                                                        <button 
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); handleCopyPhone(s.phone); }}
                                                                            className="p-1 text-gray-400 hover:text-white rounded"
                                                                            title="نسخ"
                                                                        >
                                                                            {copiedPhone === s.phone ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {sups.filter(s => s.name || s.phone).length > 2 && (
                                                            <span className="text-[9px] text-blue-300 block font-bold">+{sups.filter(s => s.name || s.phone).length - 2} آخرين...</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-500 text-[10px] italic block">لا يوجد</span>
                                                )}
                                            </div>

                                            {/* مديرو الفرع */}
                                            <div>
                                                <div className="text-[10px] sm:text-[11px] font-bold text-emerald-400 flex items-center gap-1 mb-1">
                                                    <Briefcase size={11} />
                                                    <span>المديرين:</span>
                                                </div>
                                                {mans.length > 0 && mans.some(m => m.name || m.phone) ? (
                                                    <div className="space-y-1">
                                                        {mans.filter(m => m.name || m.phone).slice(0, 2).map((m, mIdx) => (
                                                            <div key={m.id || mIdx} className="bg-gray-800/90 p-1.5 sm:p-2 rounded-xl border border-white/5 flex items-center justify-between gap-1 text-[10px] sm:text-xs">
                                                                <span className="font-bold text-white truncate max-w-[80px] sm:max-w-[110px]">{m.name || 'مدير'}</span>
                                                                <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                                                    <span className="font-mono text-gray-300 font-bold dir-ltr text-[9px] sm:text-xs">{m.phone || '-'}</span>
                                                                    {m.phone && (
                                                                        <button 
                                                                            type="button"
                                                                            onClick={(e) => { e.stopPropagation(); handleCopyPhone(m.phone); }}
                                                                            className="p-1 text-gray-400 hover:text-white rounded"
                                                                            title="نسخ"
                                                                        >
                                                                            {copiedPhone === m.phone ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {mans.filter(m => m.name || m.phone).length > 2 && (
                                                            <span className="text-[9px] text-emerald-300 block font-bold">+{mans.filter(m => m.name || m.phone).length - 2} آخرين...</span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-500 text-[10px] italic block">لا يوجد</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Footer with Edit and Delete options */}
                                    <div className="pt-2.5 mt-2 border-t border-white/10 flex items-center justify-between gap-1" onClick={e => e.stopPropagation()}>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleOpenEditBranch(branchName);
                                            }}
                                            className="flex-1 bg-gray-800 hover:bg-gray-700 text-blue-400 hover:text-white py-1 sm:py-1.5 px-2 rounded-xl text-[10px] sm:text-xs font-bold border border-white/5 flex items-center justify-center gap-1 transition"
                                        >
                                            <Edit2 size={11} />
                                            <span>تعديل</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteBranch(branchName);
                                            }}
                                            className="bg-gray-800 hover:bg-rose-900/40 text-rose-400 py-1 sm:py-1.5 px-2 rounded-xl text-[10px] sm:text-xs font-bold border border-white/5 flex items-center justify-center transition"
                                            title="حذف الفرع"
                                        >
                                            <Trash2 size={11} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal: أضف فرع */}
            {showAddBranchModal && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-gray-900 border border-white/20 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4 animate-in zoom-in-95">
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <h3 className="font-black text-lg text-white flex items-center gap-2">
                                <Plus size={20} className="text-blue-400" />
                                <span>إضافة فرع جديد</span>
                            </h3>
                            <button
                                onClick={() => setShowAddBranchModal(false)}
                                className="text-gray-400 hover:text-white p-1 rounded-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-300">
                                اسم الفرع الجديد:
                            </label>
                            <input
                                type="text"
                                value={newBranchInput}
                                onChange={e => setNewBranchInput(e.target.value)}
                                placeholder="مثال: محلاوي العبور، فرجاني النزهة..."
                                autoFocus
                                className="w-full bg-gray-800 text-white border border-white/20 p-3 rounded-2xl text-base font-bold outline-none focus:border-blue-500 shadow-inner"
                            />
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={handleConfirmAddBranch}
                                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-2xl font-bold transition shadow-lg active:scale-95 text-sm"
                            >
                                إضافة وتحديد
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowAddBranchModal(false)}
                                className="bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 px-5 rounded-2xl font-bold transition text-sm"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: عرض وتفاصيل الفرع لنسخ أي رقم بضغطة واحدة مع زري تعديل وحذف */}
            {activeDetailBranch && (
                <div 
                    className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
                    onClick={() => setActiveDetailBranch(null)}
                >
                    <div 
                        className="bg-gray-900 border border-white/20 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header with Title and Edit / Delete / Close actions */}
                        <div className="flex items-start justify-between border-b border-white/10 pb-4 gap-2">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-12 h-12 rounded-2xl bg-blue-600/20 text-blue-400 flex items-center justify-center border border-blue-500/30 shrink-0">
                                    <Building2 size={24} />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="font-black text-lg sm:text-xl text-white truncate">
                                        {activeDetailBranch}
                                    </h3>
                                    <p className="text-xs text-gray-400 font-bold">
                                        بيانات وأرقام المشرفين والمديرين
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const b = activeDetailBranch;
                                        setActiveDetailBranch(null);
                                        handleOpenEditBranch(b);
                                    }}
                                    className="bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-bold border border-blue-500/40 flex items-center gap-1.5 transition cursor-pointer"
                                    title="تعديل أرقام هذا الفرع"
                                >
                                    <Edit2 size={13} />
                                    <span>تعديل</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleDeleteBranch(activeDetailBranch)}
                                    className="bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white px-2.5 py-1.5 rounded-xl text-xs font-bold border border-rose-500/40 flex items-center gap-1 transition cursor-pointer"
                                    title="حذف هذا الفرع"
                                >
                                    <Trash2 size={13} />
                                    <span className="hidden sm:inline">حذف</span>
                                </button>
                                <button
                                    onClick={() => setActiveDetailBranch(null)}
                                    className="text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-white/5 transition"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Contacts Content */}
                        {(() => {
                            const key = sanitizeKey(activeDetailBranch);
                            const rec = branchContactsMap[key];
                            const sups = (rec?.supervisors || []).filter(s => s.name || s.phone);
                            const mans = (rec?.managers || []).filter(m => m.name || m.phone);

                            return (
                                <div className="space-y-4">
                                    {/* المشرفين */}
                                    <div className="bg-gray-800/80 border border-blue-500/20 p-4 rounded-2xl space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-bold text-blue-400 border-b border-white/5 pb-2">
                                            <Shield size={14} />
                                            <span>مشرفو الفرع ({sups.length})</span>
                                        </div>

                                        {sups.length === 0 ? (
                                            <p className="text-xs text-gray-500 italic py-1">لا يوجد مشرفين مسجلين لهذا الفرع حالياً.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {sups.map((s, idx) => (
                                                    <div key={s.id || idx} className="bg-gray-900/80 p-3 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                                        <div>
                                                            <div className="font-extrabold text-white text-sm">{s.name || 'مشرف غير محدد'}</div>
                                                            <div className="text-xs font-mono font-bold text-blue-300 dir-ltr text-right mt-0.5">{s.phone || '-'}</div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {s.phone && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCopyPhone(s.phone)}
                                                                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border ${
                                                                        copiedPhone === s.phone 
                                                                            ? 'bg-emerald-600 text-white border-emerald-400' 
                                                                            : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-white/10'
                                                                    }`}
                                                                >
                                                                    {copiedPhone === s.phone ? <Check size={14} className="text-white" /> : <Copy size={14} />}
                                                                    <span>{copiedPhone === s.phone ? 'تم النسخ!' : 'نسخ الرقم'}</span>
                                                                </button>
                                                            )}
                                                            {s.phone && (
                                                                <a
                                                                    href={`tel:${s.phone}`}
                                                                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                                                                >
                                                                    <Phone size={14} />
                                                                    <span>اتصال</span>
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    {/* المديرين */}
                                    <div className="bg-gray-800/80 border border-emerald-500/20 p-4 rounded-2xl space-y-3">
                                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 border-b border-white/5 pb-2">
                                            <Briefcase size={14} />
                                            <span>مديرو الفرع ({mans.length})</span>
                                        </div>

                                        {mans.length === 0 ? (
                                            <p className="text-xs text-gray-500 italic py-1">لا يوجد مديرين مسجلين لهذا الفرع حالياً.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {mans.map((m, idx) => (
                                                    <div key={m.id || idx} className="bg-gray-900/80 p-3 rounded-xl border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                                        <div>
                                                            <div className="font-extrabold text-white text-sm">{m.name || 'مدير غير محدد'}</div>
                                                            <div className="text-xs font-mono font-bold text-emerald-300 dir-ltr text-right mt-0.5">{m.phone || '-'}</div>
                                                        </div>

                                                        <div className="flex items-center gap-2">
                                                            {m.phone && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleCopyPhone(m.phone)}
                                                                    className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition border ${
                                                                        copiedPhone === m.phone 
                                                                            ? 'bg-emerald-600 text-white border-emerald-400' 
                                                                            : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-white/10'
                                                                    }`}
                                                                >
                                                                    {copiedPhone === m.phone ? <Check size={14} className="text-white" /> : <Copy size={14} />}
                                                                    <span>{copiedPhone === m.phone ? 'تم النسخ!' : 'نسخ الرقم'}</span>
                                                                </button>
                                                            )}
                                                            {m.phone && (
                                                                <a
                                                                    href={`tel:${m.phone}`}
                                                                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition"
                                                                >
                                                                    <Phone size={14} />
                                                                    <span>اتصال</span>
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Modal: تعديل أرقام وأسماء الفرع من الدليل مباشرة مع تناسق الهاتف */}
            {editingBranchData && (
                <div 
                    className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
                    onClick={() => setEditingBranchData(null)}
                >
                    <div 
                        className="bg-gray-900 border border-white/20 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in zoom-in-95 max-h-[90vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-3">
                            <div className="flex items-center gap-2">
                                <Edit2 size={18} className="text-blue-400" />
                                <h3 className="font-black text-base sm:text-lg text-white">
                                    تعديل بيانات فرع: {editingBranchData.branchName}
                                </h3>
                            </div>
                            <button
                                onClick={() => setEditingBranchData(null)}
                                className="text-gray-400 hover:text-white p-1 rounded-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Supervisors List in Edit Modal */}
                        <div className="bg-gray-800/80 border border-blue-500/20 p-3 sm:p-4 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                                    <Shield size={14} />
                                    <span>مشرفو الفرع:</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingBranchData(prev => prev ? ({
                                            ...prev,
                                            supervisors: [...prev.supervisors, { id: 'sup-' + Date.now(), name: '', phone: '' }]
                                        }) : null);
                                    }}
                                    className="bg-blue-600/30 hover:bg-blue-600 text-blue-200 hover:text-white px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                                >
                                    <Plus size={13} />
                                    <span>أضف اسم</span>
                                </button>
                            </div>

                            <div className="space-y-2.5">
                                {editingBranchData.supervisors.map((s, idx) => (
                                    <div key={s.id} className="bg-gray-900/80 p-2 sm:p-2.5 rounded-xl border border-white/5 space-y-1.5">
                                        <div className="grid grid-cols-2 gap-2 items-center">
                                            {/* الاسم */}
                                            <div className="min-w-0">
                                                <label className="block text-[10px] font-bold text-gray-400 mb-0.5 truncate">
                                                    اسم المشرف {editingBranchData.supervisors.length > 1 ? `(${idx + 1})` : ''}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={s.name}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setEditingBranchData(prev => prev ? ({
                                                            ...prev,
                                                            supervisors: prev.supervisors.map(item => item.id === s.id ? { ...item, name: val } : item)
                                                        }) : null);
                                                    }}
                                                    placeholder="اسم المشرف"
                                                    className="w-full bg-gray-800 text-white border border-white/10 px-2 py-1.5 rounded-lg text-xs font-bold outline-none focus:border-blue-500"
                                                />
                                            </div>

                                            {/* الرقم بجانبه في الهاتف */}
                                            <div className="min-w-0">
                                                <label className="block text-[10px] font-bold text-gray-400 mb-0.5 truncate">
                                                    رقم المشرف {editingBranchData.supervisors.length > 1 ? `(${idx + 1})` : ''}
                                                </label>
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="tel"
                                                        value={s.phone}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setEditingBranchData(prev => prev ? ({
                                                                ...prev,
                                                                supervisors: prev.supervisors.map(item => item.id === s.id ? { ...item, phone: val } : item)
                                                            }) : null);
                                                        }}
                                                        placeholder="01012345678"
                                                        className="w-full min-w-0 bg-gray-800 text-white border border-white/10 px-2 py-1.5 rounded-lg text-xs font-mono font-bold outline-none focus:border-blue-500 dir-ltr text-right"
                                                    />
                                                    {editingBranchData.supervisors.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingBranchData(prev => prev ? ({
                                                                    ...prev,
                                                                    supervisors: prev.supervisors.filter(item => item.id !== s.id)
                                                                }) : null);
                                                            }}
                                                            className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-lg shrink-0"
                                                            title="حذف هذا المشرف"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Managers List in Edit Modal */}
                        <div className="bg-gray-800/80 border border-emerald-500/20 p-3 sm:p-4 rounded-2xl space-y-3">
                            <div className="flex items-center justify-between border-b border-white/10 pb-2">
                                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                                    <Briefcase size={14} />
                                    <span>مديرو الفرع:</span>
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setEditingBranchData(prev => prev ? ({
                                            ...prev,
                                            managers: [...prev.managers, { id: 'man-' + Date.now(), name: '', phone: '' }]
                                        }) : null);
                                    }}
                                    className="bg-emerald-600/30 hover:bg-emerald-600 text-emerald-200 hover:text-white px-2.5 py-1 rounded-xl text-xs font-bold flex items-center gap-1 transition"
                                >
                                    <Plus size={13} />
                                    <span>أضف اسم</span>
                                </button>
                            </div>

                            <div className="space-y-2.5">
                                {editingBranchData.managers.map((m, idx) => (
                                    <div key={m.id} className="bg-gray-900/80 p-2 sm:p-2.5 rounded-xl border border-white/5 space-y-1.5">
                                        <div className="grid grid-cols-2 gap-2 items-center">
                                            {/* الاسم */}
                                            <div className="min-w-0">
                                                <label className="block text-[10px] font-bold text-gray-400 mb-0.5 truncate">
                                                    اسم مدير الفرع {editingBranchData.managers.length > 1 ? `(${idx + 1})` : ''}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={m.name}
                                                    onChange={e => {
                                                        const val = e.target.value;
                                                        setEditingBranchData(prev => prev ? ({
                                                            ...prev,
                                                            managers: prev.managers.map(item => item.id === m.id ? { ...item, name: val } : item)
                                                        }) : null);
                                                    }}
                                                    placeholder="اسم المدير"
                                                    className="w-full bg-gray-800 text-white border border-white/10 px-2 py-1.5 rounded-lg text-xs font-bold outline-none focus:border-emerald-500"
                                                />
                                            </div>

                                            {/* الرقم بجانبه في الهاتف */}
                                            <div className="min-w-0">
                                                <label className="block text-[10px] font-bold text-gray-400 mb-0.5 truncate">
                                                    رقم مدير الفرع {editingBranchData.managers.length > 1 ? `(${idx + 1})` : ''}
                                                </label>
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="tel"
                                                        value={m.phone}
                                                        onChange={e => {
                                                            const val = e.target.value;
                                                            setEditingBranchData(prev => prev ? ({
                                                                ...prev,
                                                                managers: prev.managers.map(item => item.id === m.id ? { ...item, phone: val } : item)
                                                            }) : null);
                                                        }}
                                                        placeholder="01012345678"
                                                        className="w-full min-w-0 bg-gray-800 text-white border border-white/10 px-2 py-1.5 rounded-lg text-xs font-mono font-bold outline-none focus:border-emerald-500 dir-ltr text-right"
                                                    />
                                                    {editingBranchData.managers.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingBranchData(prev => prev ? ({
                                                                    ...prev,
                                                                    managers: prev.managers.filter(item => item.id !== m.id)
                                                                }) : null);
                                                            }}
                                                            className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-lg shrink-0"
                                                            title="حذف هذا المدير"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Save & Cancel */}
                        <div className="flex items-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={handleSaveEditedBranch}
                                disabled={isSavingEdit}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 rounded-2xl font-bold transition shadow-lg active:scale-95 text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                            >
                                <Save size={16} />
                                <span>{isSavingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setEditingBranchData(null)}
                                className="bg-gray-800 hover:bg-gray-700 text-gray-300 py-3 px-5 rounded-2xl font-bold transition text-sm cursor-pointer"
                            >
                                إلغاء
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Offscreen Container for Clean PDF Generation with Pagination Isolation */}
            <div 
                ref={printContainerRef} 
                style={{ display: 'none', width: '900px', backgroundColor: '#111827', color: '#ffffff', padding: '30px', direction: 'rtl', fontFamily: 'sans-serif' }}
            >
                {/* PDF Header */}
                <div style={{ textAlign: 'center', borderBottom: '2px solid rgba(255,255,255,0.2)', paddingBottom: '20px', marginBottom: '25px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#60a5fa', margin: '0 0 10px 0' }}>
                        دليل أرقام ومشرفي ومديري الفروع
                    </h1>
                    <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0 }}>
                        المستخدم: {user.name || user.username} | التاريخ: {new Date().toLocaleDateString('ar-EG')}
                    </p>
                </div>

                {/* PDF Cards - Each branch in its own distinct card with page break protection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {employeeRegisteredBranches.map((branch, bIdx) => {
                        const key = sanitizeKey(branch);
                        const data = branchContactsMap[key];
                        const sups = data?.supervisors || [];
                        const mans = data?.managers || [];

                        return (
                            <div 
                                key={`pdf-branch-${branch}-${bIdx}`}
                                style={{ 
                                    backgroundColor: '#1f2937', 
                                    borderRadius: '16px', 
                                    border: '1px solid rgba(255,255,255,0.15)', 
                                    padding: '18px', 
                                    pageBreakInside: 'avoid',
                                    breakInside: 'avoid',
                                    marginBottom: '15px'
                                }}
                            >
                                <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '12px' }}>
                                    <h3 style={{ fontSize: '18px', fontWeight: 'bold', color: '#93c5fd', margin: 0 }}>
                                        {branch}
                                    </h3>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                                    {/* المشرفين */}
                                    <div style={{ backgroundColor: 'rgba(59, 130, 246, 0.08)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#60a5fa', marginBottom: '8px' }}>
                                            مشرفو الفرع:
                                        </div>
                                        {sups.length > 0 && sups.some(s => s.name || s.phone) ? (
                                            sups.filter(s => s.name || s.phone).map((s, idx) => (
                                                <div key={idx} style={{ fontSize: '12px', color: '#ffffff', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                                                    <span style={{ fontWeight: 'bold' }}>{s.name || 'بدون اسم'}</span>: <span style={{ direction: 'ltr', display: 'inline-block', fontFamily: 'monospace' }}>{s.phone || '-'}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>- لا يوجد -</span>
                                        )}
                                    </div>

                                    {/* مديري الفرع */}
                                    <div style={{ backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: '12px', padding: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#34d399', marginBottom: '8px' }}>
                                            مديرو الفرع:
                                        </div>
                                        {mans.length > 0 && mans.some(m => m.name || m.phone) ? (
                                            mans.filter(m => m.name || m.phone).map((m, idx) => (
                                                <div key={idx} style={{ fontSize: '12px', color: '#ffffff', marginBottom: '6px', paddingBottom: '4px', borderBottom: '1px dashed rgba(255,255,255,0.05)' }}>
                                                    <span style={{ fontWeight: 'bold' }}>{m.name || 'بدون اسم'}</span>: <span style={{ direction: 'ltr', display: 'inline-block', fontFamily: 'monospace' }}>{m.phone || '-'}</span>
                                                </div>
                                            ))
                                        ) : (
                                            <span style={{ fontSize: '11px', color: '#94a3b8' }}>- لا يوجد -</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
export default BranchNumbers;
