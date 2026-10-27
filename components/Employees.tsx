import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { ref, onValue, set, remove } from 'firebase/database';
import { onCachedValue } from '../firebaseCache';
import { User, EmployeeProfile } from '../types';
import { 
    Users, UserPlus, Copy, Check, X, Search, Edit2, 
    Trash2, ChevronDown, ChevronUp, CreditCard, Wallet, 
    AtSign, ShieldAlert, Sparkles, Filter, FileDown, Loader2 
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface Props {
    user: User;
    theme: string;
}

const Employees: React.FC<Props> = ({ user }) => {
    const [usersList, setUsersList] = useState<User[]>([]);
    const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
    const [selectedNameFilter, setSelectedNameFilter] = useState('');

    // Selection for PDF printing
    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const employeesPrintContainerRef = useRef<HTMLDivElement>(null);
    
    // Modal states
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [fullName, setFullName] = useState('');
    const [nationalId, setNationalId] = useState('');
    const [wallet, setWallet] = useState('');
    const [instapay, setInstapay] = useState('');
    
    // Table dropdown / accordion state
    const [expandedProfileId, setExpandedProfileId] = useState<string | null>(null);
    
    // Copy feedback state
    const [copiedKey, setCopiedKey] = useState<string | null>(null);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3000);
    };

    const handleCopy = (text: string, keyIdentifier: string) => {
        if (!text) {
            showToast('لا توجد بيانات للنسخ');
            return;
        }
        navigator.clipboard.writeText(text);
        setCopiedKey(keyIdentifier);
        showToast('تم النسخ بنجاح');
        setTimeout(() => setCopiedKey(null), 2000);
    };

    // Load registered users (excluding admin accounts)
    useEffect(() => {
        const usersRef = ref(db, 'users');
        const unsub = onCachedValue(usersRef, 'users', (snapshot) => {
            if (snapshot.exists()) {
                const list: User[] = [];
                snapshot.forEach(child => {
                    list.push({ key: child.key || '', ...child.val() });
                });
                setUsersList(list);
            } else {
                setUsersList([]);
            }
        });
        return () => unsub();
    }, []);

    // Load employee profiles
    useEffect(() => {
        const profilesRef = ref(db, 'employee_profiles');
        const unsub = onCachedValue(profilesRef, 'employee_profiles', (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list: EmployeeProfile[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                setProfiles(list);
            } else {
                setProfiles([]);
            }
        });
        return () => unsub();
    }, []);

    // Non-admin registered accounts for the dropdown
    const nonAdminUsers = usersList.filter(u => u.role !== 'admin');

    // List of registered names that currently have saved data (for search dropdown)
    const registeredNamesWithData = useMemo(() => {
        const names = profiles.map(p => p.fullName?.trim()).filter(Boolean);
        return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'ar'));
    }, [profiles]);

    // When admin changes the selected account in the modal
    const handleAccountChange = (accountId: string) => {
        setSelectedAccountId(accountId);
        if (!accountId) {
            setFullName('');
            setNationalId('');
            setWallet('');
            setInstapay('');
            return;
        }

        const selectedUser = usersList.find(u => u.key === accountId || u.username === accountId);
        const existing = profiles.find(p => p.userId === accountId || p.accountUsername === selectedUser?.username);

        if (existing) {
            // Populate with existing saved data
            setFullName(existing.fullName || selectedUser?.name || '');
            setNationalId(existing.nationalId || '');
            setWallet(existing.wallet || '');
            setInstapay(existing.instapay || '');
        } else {
            // Blank fields ready for filling
            setFullName(selectedUser?.name || '');
            setNationalId('');
            setWallet('');
            setInstapay('');
        }
    };

    const openAddModal = (targetProfile?: EmployeeProfile) => {
        if (targetProfile) {
            setSelectedAccountId(targetProfile.userId);
            setFullName(targetProfile.fullName || '');
            setNationalId(targetProfile.nationalId || '');
            setWallet(targetProfile.wallet || '');
            setInstapay(targetProfile.instapay || '');
        } else {
            // Default to empty or first account
            setSelectedAccountId('');
            setFullName('');
            setNationalId('');
            setWallet('');
            setInstapay('');
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedAccountId) {
            alert('يرجى اختيار حساب الموظف من القائمة');
            return;
        }
        if (!fullName.trim()) {
            alert('يرجى إدخال الاسم كامل');
            return;
        }

        const selectedUser = usersList.find(u => u.key === selectedAccountId || u.username === selectedAccountId);
        const safeKey = selectedAccountId.replace(/[.#$/[\]]/g, "_");

        const payload: EmployeeProfile = {
            userId: selectedAccountId,
            accountUsername: selectedUser?.username || '',
            fullName: fullName.trim(),
            nationalId: nationalId.trim(),
            wallet: wallet.trim(),
            instapay: instapay.trim(),
            updatedAt: Date.now()
        };

        try {
            await set(ref(db, `employee_profiles/${safeKey}`), payload);
            showToast('تم حفظ بيانات الموظف بنجاح');
            setIsModalOpen(false);
        } catch (err) {
            console.error('Error saving employee profile:', err);
            alert('حدث خطأ أثناء الحفظ');
        }
    };

    const handleDelete = async (profileId: string, name: string) => {
        if (confirm(`هل أنت متأكد من حذف بيانات الموظف "${name}"؟`)) {
            try {
                await remove(ref(db, `employee_profiles/${profileId}`));
                showToast('تم حذف بيانات الموظف بنجاح');
                if (expandedProfileId === profileId) {
                    setExpandedProfileId(null);
                }
            } catch (err) {
                console.error(err);
                alert('فشل في حذف البيانات');
            }
        }
    };

    // Filter profiles based on selected dropdown name
    const filteredProfiles = profiles.filter(p => {
        if (!selectedNameFilter) return true;
        return p.fullName?.trim() === selectedNameFilter;
    });

    const toggleSelectEmployee = (id: string) => {
        setSelectedEmployeeIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const handleToggleSelectAll = () => {
        const allIds = filteredProfiles.map(p => p.id || '').filter(Boolean);
        if (selectedEmployeeIds.length === allIds.length && allIds.length > 0) {
            setSelectedEmployeeIds([]);
        } else {
            setSelectedEmployeeIds(allIds);
        }
    };

    const handleExportEmployeesPDF = async () => {
        if (!employeesPrintContainerRef.current) return;
        const targetEmployees = selectedEmployeeIds.length > 0
            ? filteredProfiles.filter(p => selectedEmployeeIds.includes(p.id!))
            : filteredProfiles;

        if (targetEmployees.length === 0) {
            showToast('لا توجد بيانات موظفين للتصدير');
            return;
        }

        setIsExportingPDF(true);
        try {
            const container = employeesPrintContainerRef.current;
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

            const dateStr = new Date().toISOString().split('T')[0];
            pdf.save(`كشف_بيانات_الموظفين_${dateStr}.pdf`);
            showToast('تم تصدير ملف PDF بنجاح');
        } catch (err) {
            console.error('Error exporting PDF:', err);
            showToast('حدث خطأ أثناء تصدير ملف PDF');
        } finally {
            setIsExportingPDF(false);
        }
    };

    if (user.role !== 'admin' && !user.permissions?.showEmployees) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center text-red-400">
                <ShieldAlert size={48} className="mb-4 opacity-80" />
                <h2 className="text-xl font-bold">غير مصرح لك بالدخول</h2>
                <p className="text-sm opacity-60 mt-1">هذه الصفحة متاحة فقط لحسابات المشرفين (Admin).</p>
            </div>
        );
    }

    return (
        <div className="space-y-4 sm:space-y-6 pb-20 max-w-7xl mx-auto w-full overflow-x-hidden">
            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-sm font-bold animate-in fade-in slide-in-from-bottom-4">
                    <Check size={18} />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gray-900/60 p-3 sm:p-5 rounded-3xl border border-white/10 shadow-xl overflow-hidden">
                <div className="flex items-center gap-3">
                    <div className="p-2 sm:p-3 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl shadow-inner shrink-0">
                        <Users size={24} className="sm:w-7 sm:h-7" />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-2xl font-black text-white flex items-center gap-2">
                            بيانات الموظفين
                            <span className="text-[10px] sm:text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-2 py-0.5 rounded-full font-normal">
                                {profiles.length} موظف مسجل
                            </span>
                        </h2>
                        <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
                            إدارة أرقام البطاقات، المحافظ، وعناوين إنستا باي للموظفين
                        </p>
                    </div>
                </div>

                {/* القائمة المنسدلة وزر أضف موظف وزر تصدير PDF في سطر واحد بدون مسطرة تحريك */}
                <div className="flex items-center gap-1.5 sm:gap-2.5 w-full md:w-auto">
                    {/* قائمة منسدلة للبحث بالاسم */}
                    <div className="relative flex-1 min-w-[100px] sm:w-56">
                        <select
                            value={selectedNameFilter}
                            onChange={e => setSelectedNameFilter(e.target.value)}
                            className="w-full bg-gray-800/95 text-white border border-white/15 rounded-xl sm:rounded-2xl px-2 sm:px-3 py-2 sm:py-2.5 text-[10px] sm:text-xs font-bold focus:outline-none focus:border-blue-500 transition shadow-inner cursor-pointer truncate"
                        >
                            <option value="">جميع الموظفين ({registeredNamesWithData.length})</option>
                            {registeredNamesWithData.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Add Employee Button */}
                    <button
                        type="button"
                        onClick={() => openAddModal()}
                        className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 shadow-lg shadow-blue-600/30 transition transform active:scale-95 shrink-0 whitespace-nowrap cursor-pointer"
                        title="إضافة موظف جديد"
                    >
                        <UserPlus size={14} className="shrink-0" />
                        <span>أضف موظف</span>
                    </button>

                    {/* Export PDF Button */}
                    <button
                        type="button"
                        onClick={handleExportEmployeesPDF}
                        disabled={isExportingPDF}
                        className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl sm:rounded-2xl font-bold text-[11px] sm:text-xs flex items-center justify-center gap-1 sm:gap-1.5 shadow-lg shadow-emerald-600/30 transition transform active:scale-95 shrink-0 whitespace-nowrap cursor-pointer"
                        title="تصدير كشف بيانات الموظفين (المحفظة - إنستاباي - البطاقة) كملف PDF"
                    >
                        {isExportingPDF ? (
                            <Loader2 size={14} className="animate-spin text-white shrink-0" />
                        ) : (
                            <FileDown size={14} className="shrink-0" />
                        )}
                        <span>{selectedEmployeeIds.length > 0 ? `تصدير PDF (${selectedEmployeeIds.length})` : 'تصدير PDF'}</span>
                    </button>
                </div>
            </div>

            {/* شريط تحديد الأسماء لطباعتها وتحديد الكل */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-2 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-[11px] font-bold text-blue-400 hover:text-blue-300 underline flex items-center gap-1 cursor-pointer"
                    >
                        {selectedEmployeeIds.length === filteredProfiles.length && filteredProfiles.length > 0 
                            ? 'إلغاء تحديد الكل' 
                            : 'تحديد كل الموظفين للطباعة'}
                    </button>
                    {selectedEmployeeIds.length > 0 && (
                        <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
                            تم تحديد {selectedEmployeeIds.length} من {filteredProfiles.length}
                        </span>
                    )}
                </div>
                <span className="text-[10px] text-gray-500">
                    💡 يمكنك تحديد مربعات بجانب الأسماء لاختيار موظفين محددين للطباعة
                </span>
            </div>

            {/* نسخة الهاتف المحمول (Mobile Cards View) - تمنع المسطرة تماماً وتظهر الاسم بسطر واحد والتفاصيل منسقة */}
            <div className="block md:hidden space-y-2.5 w-full overflow-hidden">
                <div className="px-2 text-[11px] text-gray-400 font-bold flex items-center justify-between">
                    <span>قائمة الموظفين ({filteredProfiles.length})</span>
                    <span>اضغط على الاسم لعرض البيانات</span>
                </div>

                {filteredProfiles.length === 0 ? (
                    <div className="bg-gray-900/60 border border-white/10 rounded-2xl p-8 text-center text-gray-400 text-xs italic">
                        {selectedNameFilter ? 'لا توجد بيانات لهذا الموظف' : 'لم يتم تسجيل أي بيانات موظفين بعد، اضغط على زر "أضف موظف" للبدء'}
                    </div>
                ) : (
                    filteredProfiles.map((emp, index) => {
                        const isExpanded = expandedProfileId === (emp.id || String(index));
                        return (
                            <div 
                                key={emp.id || index}
                                className="bg-gray-900/80 border border-white/10 rounded-2xl overflow-hidden transition-all shadow-lg w-full max-w-full"
                            >
                                {/* سطر الاسم في الهاتف في سطر واحد فقط */}
                                <div 
                                    onClick={() => setExpandedProfileId(isExpanded ? null : (emp.id || String(index)))}
                                    className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-white/5 active:bg-white/10 transition gap-2 w-full min-w-0"
                                >
                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {/* مربع صغير لتحديد الاسم للطباعة */}
                                        <div 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                toggleSelectEmployee(emp.id!);
                                            }}
                                            className="p-1 rounded-lg hover:bg-white/10 flex items-center justify-center shrink-0 cursor-pointer"
                                            title="تحديد لطباعة PDF"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={selectedEmployeeIds.includes(emp.id!)}
                                                onChange={() => {}}
                                                className="w-4 h-4 rounded border border-white/20 bg-gray-800 text-blue-600 focus:ring-blue-500 cursor-pointer pointer-events-none"
                                            />
                                        </div>

                                        <div className={`p-1.5 rounded-xl transition shrink-0 ${isExpanded ? 'bg-blue-600 text-white' : 'bg-blue-500/10 text-blue-400'}`}>
                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            {/* الاسم في سطر واحد دون التفاف */}
                                            <div className="font-bold text-white text-xs truncate whitespace-nowrap block">
                                                {emp.fullName || 'غير محدد'}
                                            </div>
                                            {emp.accountUsername && (
                                                <div className="text-[10px] text-gray-400 truncate whitespace-nowrap block">
                                                    @{emp.accountUsername}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* أزرار الإجراءات في سطر الاسم */}
                                    <div className="flex items-center gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => openAddModal(emp)}
                                            title="تعديل"
                                            className="p-1.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 hover:bg-blue-600 hover:text-white transition"
                                        >
                                            <Edit2 size={13} />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(emp.id!, emp.fullName)}
                                            title="حذف"
                                            className="p-1.5 rounded-xl bg-red-600/20 text-red-400 border border-red-500/30 hover:bg-red-600 hover:text-white transition"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>
                                </div>

                                {/* البيانات المسجلة تظهر بشكل واضح ومنسق بدون مسطرة تحريك يمين أو يسار */}
                                {isExpanded && (
                                    <div 
                                        onClick={() => setExpandedProfileId(null)}
                                        className="p-3.5 pt-1 border-t border-white/10 bg-black/40 space-y-2.5 animate-in fade-in duration-200 w-full max-w-full cursor-pointer"
                                    >
                                        <div className="text-[10px] text-gray-400 flex items-center justify-between pb-1 border-b border-white/5">
                                            <span>تفاصيل البيانات المسجلة:</span>
                                            <span className="text-blue-400">اضغط للغلق</span>
                                        </div>

                                        {/* 1. رقم البطاقة */}
                                        <div 
                                            onClick={e => e.stopPropagation()}
                                            className="bg-gray-900 border border-white/10 p-2.5 rounded-xl flex items-center justify-between gap-2 w-full"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[10px] text-gray-400 font-bold mb-0.5 flex items-center gap-1">
                                                    <CreditCard size={12} className="text-blue-400 shrink-0" />
                                                    <span>رقم البطاقة:</span>
                                                </div>
                                                <div className="font-mono text-xs text-white font-bold truncate">
                                                    {emp.nationalId || <span className="opacity-30 italic font-normal text-[11px]">غير مسجل</span>}
                                                </div>
                                            </div>
                                            {emp.nationalId && (
                                                <button
                                                    onClick={() => handleCopy(emp.nationalId, `mob-nid-${emp.id}`)}
                                                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 shrink-0 transition ${
                                                        copiedKey === `mob-nid-${emp.id}`
                                                            ? 'bg-emerald-600 text-white border-emerald-500'
                                                            : 'bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border-blue-500/40'
                                                    }`}
                                                >
                                                    {copiedKey === `mob-nid-${emp.id}` ? <Check size={13} /> : <Copy size={13} />}
                                                    <span>نسخ</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* 2. المحفظة */}
                                        <div 
                                            onClick={e => e.stopPropagation()}
                                            className="bg-gray-900 border border-white/10 p-2.5 rounded-xl flex items-center justify-between gap-2 w-full"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[10px] text-gray-400 font-bold mb-0.5 flex items-center gap-1">
                                                    <Wallet size={12} className="text-emerald-400 shrink-0" />
                                                    <span>المحفظة:</span>
                                                </div>
                                                <div className="font-mono text-xs text-white font-bold truncate">
                                                    {emp.wallet || <span className="opacity-30 italic font-normal text-[11px]">غير مسجل</span>}
                                                </div>
                                            </div>
                                            {emp.wallet && (
                                                <button
                                                    onClick={() => handleCopy(emp.wallet, `mob-wal-${emp.id}`)}
                                                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 shrink-0 transition ${
                                                        copiedKey === `mob-wal-${emp.id}`
                                                            ? 'bg-emerald-600 text-white border-emerald-500'
                                                            : 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border-emerald-500/40'
                                                    }`}
                                                >
                                                    {copiedKey === `mob-wal-${emp.id}` ? <Check size={13} /> : <Copy size={13} />}
                                                    <span>نسخ</span>
                                                </button>
                                            )}
                                        </div>

                                        {/* 3. انستا باي */}
                                        <div 
                                            onClick={e => e.stopPropagation()}
                                            className="bg-gray-900 border border-white/10 p-2.5 rounded-xl flex items-center justify-between gap-2 w-full"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <div className="text-[10px] text-gray-400 font-bold mb-0.5 flex items-center gap-1">
                                                    <AtSign size={12} className="text-purple-400 shrink-0" />
                                                    <span>انستا باي:</span>
                                                </div>
                                                <div className="font-mono text-xs text-purple-200 font-bold truncate dir-ltr text-right">
                                                    {emp.instapay || <span className="opacity-30 italic font-normal text-[11px]">غير مسجل</span>}
                                                </div>
                                            </div>
                                            {emp.instapay && (
                                                <button
                                                    onClick={() => handleCopy(emp.instapay, `mob-insta-${emp.id}`)}
                                                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-bold flex items-center gap-1 shrink-0 transition ${
                                                        copiedKey === `mob-insta-${emp.id}`
                                                            ? 'bg-emerald-600 text-white border-emerald-500'
                                                            : 'bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border-purple-500/40'
                                                    }`}
                                                >
                                                    {copiedKey === `mob-insta-${emp.id}` ? <Check size={13} /> : <Copy size={13} />}
                                                    <span>نسخ</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            {/* نسخة سطح المكتب (Desktop Table View) */}
            <div className="hidden md:block bg-gray-900/60 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
                <div className="p-4 border-b border-white/10 flex items-center justify-between text-xs text-gray-400">
                    <span className="flex items-center gap-1.5 font-bold">
                        <Sparkles size={14} className="text-blue-400" />
                        اضغط على اسم الموظف لفتح أو غلق القائمة المنسدلة للتفاصيل
                    </span>
                    <span className="opacity-70">
                        العدد: {filteredProfiles.length}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-right border-collapse text-xs">
                        <thead>
                            <tr className="bg-black/40 text-gray-400 border-b border-white/10 font-bold uppercase text-[11px]">
                                <th className="p-3 w-10 text-center">
                                    <input
                                        type="checkbox"
                                        checked={filteredProfiles.length > 0 && selectedEmployeeIds.length === filteredProfiles.length}
                                        onChange={handleToggleSelectAll}
                                        className="w-4 h-4 rounded border-white/20 bg-gray-800 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        title="تحديد الكل للطباعة"
                                    />
                                </th>
                                <th className="p-4 w-12 text-center">#</th>
                                <th className="p-4">الاسم (اضغط لعرض البيانات)</th>
                                <th className="p-4">رقم البطاقة</th>
                                <th className="p-4">المحفظة</th>
                                <th className="p-4">إنستا باي</th>
                                <th className="p-4 w-24 text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-gray-200">
                            {filteredProfiles.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-12 text-center text-gray-500 italic">
                                        {selectedNameFilter ? 'لا توجد بيانات لهذا الموظف' : 'لم يتم تسجيل أي بيانات موظفين بعد، اضغط على زر "أضف موظف" للبدء'}
                                    </td>
                                </tr>
                            ) : (
                                filteredProfiles.map((emp, index) => {
                                    const isExpanded = expandedProfileId === emp.id;
                                    return (
                                        <React.Fragment key={emp.id || index}>
                                            <tr className={`hover:bg-white/[0.03] transition-colors ${isExpanded ? 'bg-blue-600/10' : ''}`}>
                                                <td className="p-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedEmployeeIds.includes(emp.id!)}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            toggleSelectEmployee(emp.id!);
                                                        }}
                                                        className="w-4 h-4 rounded border-white/20 bg-gray-800 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                        title="تحديد الاسم لطباعة PDF"
                                                    />
                                                </td>
                                                <td className="p-4 text-center text-gray-500 font-mono text-[10px]">
                                                    {index + 1}
                                                </td>

                                                {/* Clickable Name to toggle accordion */}
                                                <td className="p-4">
                                                    <button
                                                        onClick={() => setExpandedProfileId(isExpanded ? null : (emp.id || String(index)))}
                                                        className="text-right flex items-center gap-2 group w-full focus:outline-none"
                                                    >
                                                        <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 group-hover:bg-blue-500/20 transition shrink-0">
                                                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-white group-hover:text-blue-400 transition text-sm">
                                                                {emp.fullName || 'غير محدد'}
                                                            </div>
                                                            {emp.accountUsername && (
                                                                <div className="text-[10px] text-gray-400">
                                                                    حساب: @{emp.accountUsername}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </button>
                                                </td>

                                                {/* National ID with Copy */}
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-gray-300">
                                                            {emp.nationalId || <span className="opacity-30 italic">غير مسجل</span>}
                                                        </span>
                                                        {emp.nationalId && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCopy(emp.nationalId, `table-nid-${emp.id}`);
                                                                }}
                                                                title="نسخ رقم البطاقة"
                                                                className={`p-1.5 rounded-lg border transition ${
                                                                    copiedKey === `table-nid-${emp.id}`
                                                                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                                                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                                                }`}
                                                            >
                                                                {copiedKey === `table-nid-${emp.id}` ? <Check size={13} /> : <Copy size={13} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Wallet with Copy */}
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-gray-300">
                                                            {emp.wallet || <span className="opacity-30 italic">غير مسجل</span>}
                                                        </span>
                                                        {emp.wallet && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCopy(emp.wallet, `table-wal-${emp.id}`);
                                                                }}
                                                                title="نسخ رقم المحفظة"
                                                                className={`p-1.5 rounded-lg border transition ${
                                                                    copiedKey === `table-wal-${emp.id}`
                                                                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                                                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                                                }`}
                                                            >
                                                                {copiedKey === `table-wal-${emp.id}` ? <Check size={13} /> : <Copy size={13} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* InstaPay with Copy */}
                                                <td className="p-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono text-purple-300 dir-ltr text-right">
                                                            {emp.instapay || <span className="opacity-30 italic text-gray-400">غير مسجل</span>}
                                                        </span>
                                                        {emp.instapay && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCopy(emp.instapay, `table-insta-${emp.id}`);
                                                                }}
                                                                title="نسخ إنستا باي"
                                                                className={`p-1.5 rounded-lg border transition ${
                                                                    copiedKey === `table-insta-${emp.id}`
                                                                        ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                                                                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                                                                }`}
                                                            >
                                                                {copiedKey === `table-insta-${emp.id}` ? <Check size={13} /> : <Copy size={13} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Actions */}
                                                <td className="p-4 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                openAddModal(emp);
                                                            }}
                                                            title="تعديل البيانات"
                                                            className="p-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 transition"
                                                        >
                                                            <Edit2 size={13} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(emp.id!, emp.fullName);
                                                            }}
                                                            title="حذف البيانات"
                                                            className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/30 transition"
                                                        >
                                                            <Trash2 size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Dropdown / Collapsible Details when clicking on the Name */}
                                            {isExpanded && (
                                                <tr className="bg-gradient-to-r from-blue-950/40 via-gray-900/80 to-purple-950/30 border-y border-blue-500/30">
                                                    <td colSpan={7} className="p-4 md:p-6">
                                                        <div 
                                                            onClick={() => setExpandedProfileId(null)}
                                                            className="cursor-pointer bg-gray-900/90 border border-blue-500/40 rounded-2xl p-5 shadow-2xl relative space-y-4 hover:border-blue-400 transition"
                                                        >
                                                            <div className="flex items-center justify-between border-b border-white/10 pb-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="p-2 bg-blue-600 text-white rounded-xl shadow">
                                                                        <Users size={18} />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-bold text-white text-base">
                                                                            تفاصيل بيانات: {emp.fullName}
                                                                        </h4>
                                                                        <span className="text-[10px] text-gray-400">
                                                                            اضغط هنا أو على الاسم بالأعلى لغلق هذه القائمة
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setExpandedProfileId(null);
                                                                    }}
                                                                    className="text-xs bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white px-3 py-1.5 rounded-xl transition flex items-center gap-1.5"
                                                                >
                                                                    <X size={14} /> غلق القائمة
                                                                </button>
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                                                {/* رقم البطاقة */}
                                                                <div 
                                                                    onClick={(e) => e.stopPropagation()} 
                                                                    className="bg-black/40 border border-white/10 p-3.5 rounded-xl flex items-center justify-between gap-3"
                                                                >
                                                                    <div className="min-w-0">
                                                                        <div className="text-[10px] text-gray-400 font-bold mb-1 flex items-center gap-1">
                                                                            <CreditCard size={13} className="text-blue-400" />
                                                                            رقم البطاقة:
                                                                        </div>
                                                                        <div className="font-mono text-sm text-white font-bold truncate">
                                                                            {emp.nationalId || <span className="opacity-40 italic text-xs font-normal">غير مسجل</span>}
                                                                        </div>
                                                                    </div>
                                                                    {emp.nationalId && (
                                                                        <button
                                                                            onClick={() => handleCopy(emp.nationalId, `exp-nid-${emp.id}`)}
                                                                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition ${
                                                                                copiedKey === `exp-nid-${emp.id}`
                                                                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                                                                    : 'bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border-blue-500/40'
                                                                            }`}
                                                                        >
                                                                            {copiedKey === `exp-nid-${emp.id}` ? <Check size={14} /> : <Copy size={14} />}
                                                                            <span>نسخ</span>
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                {/* المحفظة */}
                                                                <div 
                                                                    onClick={(e) => e.stopPropagation()} 
                                                                    className="bg-black/40 border border-white/10 p-3.5 rounded-xl flex items-center justify-between gap-3"
                                                                >
                                                                    <div className="min-w-0">
                                                                        <div className="text-[10px] text-gray-400 font-bold mb-1 flex items-center gap-1">
                                                                            <Wallet size={13} className="text-emerald-400" />
                                                                            المحفظة:
                                                                        </div>
                                                                        <div className="font-mono text-sm text-white font-bold truncate">
                                                                            {emp.wallet || <span className="opacity-40 italic text-xs font-normal">غير مسجل</span>}
                                                                        </div>
                                                                    </div>
                                                                    {emp.wallet && (
                                                                        <button
                                                                            onClick={() => handleCopy(emp.wallet, `exp-wal-${emp.id}`)}
                                                                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition ${
                                                                                copiedKey === `exp-wal-${emp.id}`
                                                                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                                                                    : 'bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border-emerald-500/40'
                                                                            }`}
                                                                        >
                                                                            {copiedKey === `exp-wal-${emp.id}` ? <Check size={14} /> : <Copy size={14} />}
                                                                            <span>نسخ</span>
                                                                        </button>
                                                                    )}
                                                                </div>

                                                                {/* انستا باي */}
                                                                <div 
                                                                    onClick={(e) => e.stopPropagation()} 
                                                                    className="bg-black/40 border border-white/10 p-3.5 rounded-xl flex items-center justify-between gap-3"
                                                                >
                                                                    <div className="min-w-0">
                                                                        <div className="text-[10px] text-gray-400 font-bold mb-1 flex items-center gap-1">
                                                                            <AtSign size={13} className="text-purple-400" />
                                                                            انستا باي (أرقام / عنوان دفع):
                                                                        </div>
                                                                        <div className="font-mono text-sm text-purple-200 font-bold truncate dir-ltr text-right">
                                                                            {emp.instapay || <span className="opacity-40 italic text-xs font-normal">غير مسجل</span>}
                                                                        </div>
                                                                    </div>
                                                                    {emp.instapay && (
                                                                        <button
                                                                            onClick={() => handleCopy(emp.instapay, `exp-insta-${emp.id}`)}
                                                                            className={`px-3 py-1.5 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition ${
                                                                                copiedKey === `exp-insta-${emp.id}`
                                                                                    ? 'bg-emerald-600 text-white border-emerald-500'
                                                                                    : 'bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border-purple-500/40'
                                                                            }`}
                                                                        >
                                                                            {copiedKey === `exp-insta-${emp.id}` ? <Check size={14} /> : <Copy size={14} />}
                                                                            <span>نسخ</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal: Add / Edit Employee Popup */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/20 w-full max-w-lg rounded-3xl p-5 sm:p-6 shadow-2xl animate-in zoom-in-95 my-auto space-y-4 sm:space-y-5">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-white/10 pb-3 sm:pb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 sm:p-2.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-2xl shrink-0">
                                    <UserPlus size={18} />
                                </div>
                                <div>
                                    <h3 className="font-black text-white text-sm sm:text-base">
                                        بيانات الموظف
                                    </h3>
                                    <p className="text-[10px] sm:text-[11px] text-gray-400">
                                        اختر الحساب المسجل واملأ البيانات مع إمكانية النسخ والحفظ
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-white p-1.5 rounded-xl hover:bg-white/10 transition"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Form */}
                        <form onSubmit={handleSave} className="space-y-3.5 sm:space-y-4">
                            {/* Dropdown with registered accounts (excluding admin) */}
                            <div>
                                <label className="block text-xs font-bold text-gray-300 mb-1">
                                    الحسابات المسجلة (مستبعد منها حسابات المشرفين)
                                    <span className="text-red-400 mr-1">*</span>
                                </label>
                                <select
                                    value={selectedAccountId}
                                    onChange={e => handleAccountChange(e.target.value)}
                                    className="w-full bg-gray-800 text-white border border-white/15 rounded-2xl p-2.5 sm:p-3 text-xs focus:outline-none focus:border-blue-500 transition shadow-inner font-bold"
                                    required
                                >
                                    <option value="">-- اختر حساب موظف من القائمة --</option>
                                    {nonAdminUsers.map(acc => {
                                        const hasProfile = profiles.some(p => p.userId === acc.key || p.accountUsername === acc.username);
                                        return (
                                            <option key={acc.key || acc.username} value={acc.key || acc.username}>
                                                {acc.name || acc.username} (@{acc.username}) {hasProfile ? '✓ مسجل' : ''}
                                            </option>
                                        );
                                    })}
                                </select>
                                <p className="text-[10px] text-gray-400 mt-1">
                                    عند اختيار اسم آخر يتم تحديث الصفحة فورياً بخانات فارغة أو بالبيانات المسجلة له
                                </p>
                            </div>

                            {/* 1. الاسم كامل + زر نسخ */}
                            <div>
                                <label className="block text-xs font-bold text-gray-300 mb-1">
                                    الاسم كامل
                                    <span className="text-red-400 mr-1">*</span>
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="اكتب الاسم الرباعي كاملاً..."
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                        className="flex-1 min-w-0 bg-gray-800 text-white placeholder-gray-500 border border-white/15 rounded-2xl p-2.5 sm:p-3 text-xs focus:outline-none focus:border-blue-500 transition shadow-inner font-bold"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(fullName, 'modal-fullname')}
                                        title="نسخ الاسم"
                                        className={`px-3 py-2.5 sm:py-3 rounded-2xl border text-xs font-bold flex items-center gap-1 transition shrink-0 ${
                                            copiedKey === 'modal-fullname'
                                                ? 'bg-emerald-600 text-white border-emerald-500'
                                                : 'bg-white/10 hover:bg-white/20 text-gray-200 border-white/10'
                                        }`}
                                    >
                                        {copiedKey === 'modal-fullname' ? <Check size={16} /> : <Copy size={16} />}
                                        <span className="hidden sm:inline">نسخ</span>
                                    </button>
                                </div>
                            </div>

                            {/* 2. رقم البطاقة + زر نسخ */}
                            <div>
                                <label className="block text-xs font-bold text-gray-300 mb-1">
                                    رقم البطاقة (الرقم القومي)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="الرقم القومي المكون من 14 رقم..."
                                        value={nationalId}
                                        onChange={e => setNationalId(e.target.value)}
                                        className="flex-1 min-w-0 bg-gray-800 text-white placeholder-gray-500 border border-white/15 rounded-2xl p-2.5 sm:p-3 text-xs focus:outline-none focus:border-blue-500 transition shadow-inner font-mono font-bold"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(nationalId, 'modal-nid')}
                                        title="نسخ رقم البطاقة"
                                        className={`px-3 py-2.5 sm:py-3 rounded-2xl border text-xs font-bold flex items-center gap-1 transition shrink-0 ${
                                            copiedKey === 'modal-nid'
                                                ? 'bg-emerald-600 text-white border-emerald-500'
                                                : 'bg-white/10 hover:bg-white/20 text-gray-200 border-white/10'
                                        }`}
                                    >
                                        {copiedKey === 'modal-nid' ? <Check size={16} /> : <Copy size={16} />}
                                        <span className="hidden sm:inline">نسخ</span>
                                    </button>
                                </div>
                            </div>

                            {/* 3. المحفظة + زر نسخ */}
                            <div>
                                <label className="block text-xs font-bold text-gray-300 mb-1">
                                    المحفظة (فودافون كاش / أورنج / اتصالات / وي)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="رقم المحفظة الإلكترونية..."
                                        value={wallet}
                                        onChange={e => setWallet(e.target.value)}
                                        className="flex-1 min-w-0 bg-gray-800 text-white placeholder-gray-500 border border-white/15 rounded-2xl p-2.5 sm:p-3 text-xs focus:outline-none focus:border-blue-500 transition shadow-inner font-mono font-bold"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(wallet, 'modal-wal')}
                                        title="نسخ رقم المحفظة"
                                        className={`px-3 py-2.5 sm:py-3 rounded-2xl border text-xs font-bold flex items-center gap-1 transition shrink-0 ${
                                            copiedKey === 'modal-wal'
                                                ? 'bg-emerald-600 text-white border-emerald-500'
                                                : 'bg-white/10 hover:bg-white/20 text-gray-200 border-white/10'
                                        }`}
                                    >
                                        {copiedKey === 'modal-wal' ? <Check size={16} /> : <Copy size={16} />}
                                        <span className="hidden sm:inline">نسخ</span>
                                    </button>
                                </div>
                            </div>

                            {/* 4. انستا باي (حروف وارقام ورموز) + زر نسخ */}
                            <div>
                                <label className="block text-xs font-bold text-gray-300 mb-1">
                                    انستا باي (أرقام أو عنوان دفع IPA: حروف، أرقام ورموز)
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        placeholder="مثال: name@instapay أو رقم الهاتف..."
                                        value={instapay}
                                        onChange={e => setInstapay(e.target.value)}
                                        className="flex-1 min-w-0 bg-gray-800 text-white placeholder-gray-500 border border-white/15 rounded-2xl p-2.5 sm:p-3 text-xs focus:outline-none focus:border-blue-500 transition shadow-inner font-mono font-bold dir-ltr text-right"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => handleCopy(instapay, 'modal-insta')}
                                        title="نسخ انستا باي"
                                        className={`px-3 py-2.5 sm:py-3 rounded-2xl border text-xs font-bold flex items-center gap-1 transition shrink-0 ${
                                            copiedKey === 'modal-insta'
                                                ? 'bg-emerald-600 text-white border-emerald-500'
                                                : 'bg-white/10 hover:bg-white/20 text-gray-200 border-white/10'
                                        }`}
                                    >
                                        {copiedKey === 'modal-insta' ? <Check size={16} /> : <Copy size={16} />}
                                        <span className="hidden sm:inline">نسخ</span>
                                    </button>
                                </div>
                            </div>

                            {/* Actions: Save Button */}
                            <div className="pt-2 sm:pt-3 flex gap-2.5 sm:gap-3">
                                <button
                                    type="submit"
                                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white py-3 rounded-2xl font-black text-xs sm:text-sm shadow-xl shadow-blue-600/30 transition transform active:scale-95"
                                >
                                    حفظ البيانات
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setFullName('');
                                        setNationalId('');
                                        setWallet('');
                                        setInstapay('');
                                    }}
                                    className="px-3 sm:px-4 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-2xl text-xs font-bold transition"
                                >
                                    تفريغ
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-3 sm:px-4 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white rounded-2xl text-xs font-bold transition"
                                >
                                    إلغاء
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Printable Container for Employees Data PDF */}
            <div
                ref={employeesPrintContainerRef}
                style={{ display: 'none', position: 'fixed', top: '-9999px', left: '-9999px', width: '1000px', backgroundColor: '#ffffff', color: '#111827', padding: '30px', fontFamily: 'sans-serif' }}
                dir="rtl"
            >
                <div style={{ textAlign: 'center', borderBottom: '2px solid #2563eb', paddingBottom: '16px', marginBottom: '20px' }}>
                    <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e3a8a', margin: '0 0 8px 0' }}>
                        كشف بيانات الموظفين
                    </h2>
                    <div style={{ fontSize: '13px', color: '#4b5563', fontWeight: 'bold', margin: '0 0 6px 0' }}>
                        أرقام البطاقات القومية - المحافظ الإلكترونية - حسابات إنستا باي (InstaPay)
                    </div>
                    <div style={{ fontSize: '11px', color: '#6b7280', display: 'flex', justifyContent: 'center', gap: '20px' }}>
                        <span>تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                        <span>•</span>
                        <span>
                            عدد الموظفين: {
                                (selectedEmployeeIds.length > 0 
                                    ? filteredProfiles.filter(p => selectedEmployeeIds.includes(p.id!)) 
                                    : filteredProfiles).length
                            }
                        </span>
                    </div>
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'right' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#1e3a8a', color: '#ffffff' }}>
                            <th style={{ padding: '10px 8px', border: '1px solid #1e40af', width: '40px', textAlign: 'center' }}>#</th>
                            <th style={{ padding: '10px 8px', border: '1px solid #1e40af', width: '220px' }}>اسم الموظف</th>
                            <th style={{ padding: '10px 8px', border: '1px solid #1e40af', width: '180px', textAlign: 'center' }}>الرقم القومي (البطاقة)</th>
                            <th style={{ padding: '10px 8px', border: '1px solid #1e40af', width: '180px', textAlign: 'center' }}>رقم المحفظة</th>
                            <th style={{ padding: '10px 8px', border: '1px solid #1e40af', textAlign: 'center' }}>حساب إنستا باي (InstaPay)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(selectedEmployeeIds.length > 0 
                            ? filteredProfiles.filter(p => selectedEmployeeIds.includes(p.id!)) 
                            : filteredProfiles
                        ).map((emp, idx) => (
                            <tr key={emp.id || idx} style={{ backgroundColor: idx % 2 === 0 ? '#f9fafb' : '#ffffff' }}>
                                <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                                <td style={{ padding: '8px', border: '1px solid #e5e7eb', fontWeight: 'bold' }}>
                                    <div>{emp.fullName || 'غير مسجل'}</div>
                                    {emp.accountUsername && (
                                        <div style={{ fontSize: '10px', color: '#6b7280' }}>@{emp.accountUsername}</div>
                                    )}
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                    {emp.nationalId || '-'}
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                    {emp.wallet || '-'}
                                </td>
                                <td style={{ padding: '8px', border: '1px solid #e5e7eb', textAlign: 'center', fontFamily: 'monospace', fontWeight: 'bold', color: '#6b21a8' }}>
                                    {emp.instapay || '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                <div style={{ marginTop: '24px', paddingTop: '12px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af' }}>
                    <span>نظام إدارة الحضور وبيانات الموظفين</span>
                    <span>كشف رسمي معتمد</span>
                </div>
            </div>
        </div>
    );
};

export default Employees;
