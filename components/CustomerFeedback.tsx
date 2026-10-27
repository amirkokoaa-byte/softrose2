import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { ref, push, remove } from 'firebase/database';
import { onCachedValue } from '../firebaseCache';
import { User, CustomerFeedback } from '../types';
import { 
    MessageSquareQuote, Plus, FileText, Trash2, ChevronDown, 
    ChevronUp, X, Send, CheckSquare, Square, Phone, 
    Building2, Calendar, Clock, User as UserIcon, CheckCircle2,
    Eye, Download, Copy, Check
} from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Props {
    user: User;
    theme: string;
    markets: string[];
}

export const CustomerFeedbackComponent: React.FC<Props> = ({ user, theme, markets }) => {
    const [feedbacks, setFeedbacks] = useState<CustomerFeedback[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedFeedback, setSelectedFeedback] = useState<CustomerFeedback | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
    const [selectedExportIds, setSelectedExportIds] = useState<Set<string>>(new Set());
    const [isExportingPDF, setIsExportingPDF] = useState(false);
    const [copiedPhone, setCopiedPhone] = useState(false);

    const handleCopyPhone = (phone: string) => {
        if (!phone) return;
        navigator.clipboard.writeText(phone);
        setCopiedPhone(true);
        setTimeout(() => setCopiedPhone(false), 2000);
    };

    // Form state
    const [branchName, setBranchName] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [complaint, setComplaint] = useState('');
    const [opinionType, setOpinionType] = useState<'مقترح' | 'شكوى'>('شكوى');
    const [formSubmitting, setFormSubmitting] = useState(false);

    // Filter state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterBranch, setFilterBranch] = useState('all');
    const [filterType, setFilterType] = useState('all');

    useEffect(() => {
        const feedbackRef = ref(db, 'customer_feedback');
        const unsub = onCachedValue(feedbackRef, 'customer_feedback', (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const list: CustomerFeedback[] = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                }));
                // Sort by timestamp descending (newest first)
                list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
                setFeedbacks(list);
            } else {
                setFeedbacks([]);
            }
            setLoading(false);
        });

        return () => unsub();
    }, []);

    // Calculate word count
    const getWordCount = (text: string) => {
        const trimmed = text.trim();
        return trimmed ? trimmed.split(/\s+/).length : 0;
    };

    const handleComplaintChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = e.target.value;
        const words = getWordCount(val);
        if (words <= 1000) {
            setComplaint(val);
        } else {
            // Trim words to 1000
            const wordsArr = val.trim().split(/\s+/);
            if (wordsArr.length > 1000) {
                setComplaint(wordsArr.slice(0, 1000).join(' '));
            }
        }
    };

    const handleToggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleToggleSelectExport = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedExportIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleToggleSelectAll = () => {
        if (selectedExportIds.size === filteredFeedbacks.length && filteredFeedbacks.length > 0) {
            setSelectedExportIds(new Set());
        } else {
            setSelectedExportIds(new Set(filteredFeedbacks.map(f => f.id)));
        }
    };

    const handleAddBranch = async () => {
        if (user.role !== 'admin') return;
        const name = prompt("أدخل اسم الفرع الجديد:");
        if (!name || !name.trim()) return;
        try {
            await push(ref(db, 'settings/markets'), {
                name: name.trim(),
                createdBy: user.username || 'admin'
            });
            setBranchName(name.trim());
            alert("تمت إضافة الفرع بنجاح");
        } catch (err) {
            alert("حدث خطأ أثناء إضافة الفرع");
        }
    };

    const branchesWithFeedback = React.useMemo(() => {
        const set = new Set<string>();
        feedbacks.forEach(f => {
            if (f.branchName && f.branchName.trim()) {
                set.add(f.branchName.trim());
            }
        });
        return Array.from(set).sort();
    }, [feedbacks]);

    const handleSubmitFeedback = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!branchName.trim()) {
            return alert("يرجى اختيار الفرع");
        }
        if (!customerName.trim()) {
            return alert("يرجى إدخال اسم العميل");
        }
        if (!phoneNumber.trim()) {
            return alert("يرجى إدخال رقم الهاتف");
        }
        if (!complaint.trim()) {
            return alert("يرجى كتابة الشكوى أو الرأي");
        }

        const wordsCount = getWordCount(complaint);
        if (wordsCount > 1000) {
            return alert("لا يمكن أن تتجاوز الشكوى 1000 كلمة");
        }

        setFormSubmitting(true);
        try {
            const now = new Date();
            const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
            const dayName = arabicDays[now.getDay()];
            const date = now.toISOString().split('T')[0];
            const time = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', hour12: true });

            const newFeedback: Omit<CustomerFeedback, 'id'> = {
                branchName: branchName.trim(),
                customerName: customerName.trim(),
                phoneNumber: phoneNumber.trim(),
                complaint: complaint.trim(),
                opinionType,
                dayName,
                date,
                time,
                timestamp: Date.now(),
                createdBy: user.name || user.username || 'مستخدم',
                createdByRole: user.role
            };

            await push(ref(db, 'customer_feedback'), newFeedback);

            // Reset form
            setBranchName('');
            setCustomerName('');
            setPhoneNumber('');
            setComplaint('');
            setOpinionType('شكوى');
            setShowAddModal(false);
            alert("تم إرسال وحفظ رأي العميل بنجاح");
        } catch (error) {
            console.error("Error submitting feedback:", error);
            alert("حدث خطأ أثناء حفظ رأي العميل");
        } finally {
            setFormSubmitting(false);
        }
    };

    const handleDeleteFeedback = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (user.role !== 'admin') return;
        if (!confirm("هل أنت متأكد من حذف هذا الرأي؟ لا يمكن التراجع عن هذا الإجراء.")) return;

        try {
            await remove(ref(db, `customer_feedback/${id}`));
            if (selectedFeedback?.id === id) {
                setSelectedFeedback(null);
            }
            setSelectedExportIds(prev => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
            alert("تم حذف الرأي بنجاح");
        } catch (error) {
            console.error("Error deleting feedback:", error);
            alert("حدث خطأ أثناء حذف الرأي");
        }
    };

    // PDF Export function (Single or Bulk)
    const exportFeedbacksToPDF = async (itemsToExport: CustomerFeedback[], titlePrefix = "تقرير آراء وشكاوى العملاء") => {
        if (itemsToExport.length === 0) {
            return alert("لا توجد عناصر محددة للتصدير");
        }

        setIsExportingPDF(true);
        try {
            const container = document.createElement("div");
            container.style.position = "absolute";
            container.style.top = "-9999px";
            container.style.left = "-9999px";
            container.style.width = "800px";
            container.style.padding = "25px";
            container.style.direction = "rtl";
            container.style.fontFamily = "'Cairo', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
            container.style.backgroundColor = "#ffffff";
            container.style.color = "#111827";

            let html = `
                <div style="border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h1 style="color: #1e3a8a; margin: 0; font-size: 22px; font-weight: bold;">شركة سوفت روز للتجارة الحديثة</h1>
                        <h2 style="color: #4b5563; margin: 5px 0 0 0; font-size: 16px;">${titlePrefix}</h2>
                    </div>
                    <div style="text-align: left; font-size: 12px; color: #6b7280;">
                        <div>تاريخ التصدير: ${new Date().toLocaleDateString('ar-EG')}</div>
                        <div>العدد الإجمالي: ${itemsToExport.length} شكوى / رأي</div>
                    </div>
                </div>
            `;

            itemsToExport.forEach((item, index) => {
                html += `
                    <div style="border: 1px solid #e5e7eb; border-radius: 12px; margin-bottom: 16px; padding: 16px; background-color: ${index % 2 === 0 ? '#f9fafb' : '#ffffff'}; page-break-inside: avoid;">
                        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; margin-bottom: 10px;">
                            <div style="font-weight: bold; color: #1e40af; font-size: 15px; display: flex; align-items: center; gap: 8px;">
                                <span>#${index + 1} - فرع: ${item.branchName || '-'}</span>
                                <span style="background-color: ${item.opinionType === 'مقترح' ? '#d1fae5' : '#fee2e2'}; color: ${item.opinionType === 'مقترح' ? '#065f46' : '#991b1b'}; padding: 2px 8px; border-radius: 6px; font-size: 11px;">
                                    ${item.opinionType || 'شكوى'}
                                </span>
                            </div>
                            <div style="font-size: 12px; color: #4b5563; font-weight: bold;">
                                ${item.dayName || ''} | ${item.date || ''} | ${item.time || ''}
                            </div>
                        </div>
                        <div style="display: flex; gap: 20px; font-size: 13px; margin-bottom: 8px; color: #374151;">
                            <div><strong>اسم العميل:</strong> ${item.customerName || '-'}</div>
                            <div><strong>رقم الهاتف:</strong> <span style="direction: ltr; display: inline-block;">${item.phoneNumber || '-'}</span></div>
                            <div><strong>الموظف المسجل:</strong> ${item.createdBy || '-'}</div>
                        </div>
                        <div style="background-color: #ffffff; border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; font-size: 13px; line-height: 1.6; color: #1f2937; white-space: pre-wrap;">
                            <strong>نص الشكوى / الرأي:</strong><br/>
                            ${item.complaint || '-'}
                        </div>
                    </div>
                `;
            });

            container.innerHTML = html;
            document.body.appendChild(container);

            const canvas = await html2canvas(container, { scale: 2, useCORS: true });
            document.body.removeChild(container);

            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            let pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            const pageHeight = pdf.internal.pageSize.getHeight();
            let position = 0;

            if (pdfHeight > pageHeight) {
                while (pdfHeight > 0) {
                    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, (canvas.height * pdfWidth) / canvas.width);
                    pdfHeight -= pageHeight;
                    position -= pageHeight;
                    if (pdfHeight > 0) {
                        pdf.addPage();
                    }
                }
            } else {
                pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            }

            const fileName = itemsToExport.length === 1 
                ? `شكوى_عميل_${itemsToExport[0].customerName || 'عميل'}.pdf` 
                : `تقرير_اراء_العملاء_${new Date().toISOString().split('T')[0]}.pdf`;

            pdf.save(fileName);
        } catch (error) {
            console.error("PDF Export error:", error);
            alert("حدث خطأ أثناء تصدير ملف PDF.");
        } finally {
            setIsExportingPDF(false);
        }
    };

    // Filter feedbacks
    const filteredFeedbacks = feedbacks.filter(f => {
        const matchesBranch = filterBranch === 'all' || f.branchName === filterBranch;
        const matchesType = filterType === 'all' || (f.opinionType || 'شكوى') === filterType;
        const matchesQuery = !searchQuery.trim() || 
            (f.customerName && f.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (f.phoneNumber && f.phoneNumber.includes(searchQuery)) ||
            (f.branchName && f.branchName.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (f.complaint && f.complaint.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesBranch && matchesType && matchesQuery;
    });

    const isAllSelected = filteredFeedbacks.length > 0 && selectedExportIds.size === filteredFeedbacks.length;

    return (
        <div className="space-y-6">
            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-gray-900/80 p-5 rounded-3xl border border-white/10 shadow-2xl backdrop-blur-md">
                <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
                        <MessageSquareQuote size={26} />
                    </div>
                    <div>
                        <h2 className="text-xl md:text-2xl font-black text-white">الشكاوى والمقترحات</h2>
                        <p className="text-xs text-white/50 font-bold">تسجيل ومتابعة شكاوى ومقترحات العملاء في الفروع</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    {/* Add Button */}
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer"
                    >
                        <Plus size={20} />
                        <span>أضف</span>
                    </button>

                    {/* Bulk PDF Export Button (Admin Only) */}
                    {user.role === 'admin' && feedbacks.length > 0 && (
                        <button
                            onClick={() => {
                                const targetItems = selectedExportIds.size > 0 
                                    ? filteredFeedbacks.filter(f => selectedExportIds.has(f.id))
                                    : filteredFeedbacks;
                                exportFeedbacksToPDF(targetItems, selectedExportIds.size > 0 ? `تقرير آراء العملاء المحددة (${targetItems.length})` : 'تقرير شامل لآراء العملاء');
                            }}
                            disabled={isExportingPDF}
                            className="flex-1 md:flex-none bg-rose-600 hover:bg-rose-500 text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-rose-600/30 flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer disabled:opacity-50"
                        >
                            <Download size={18} />
                            <span>
                                {isExportingPDF ? 'جاري التصدير...' : selectedExportIds.size > 0 ? `تصدير PDF (${selectedExportIds.size})` : 'تصدير PDF'}
                            </span>
                        </button>
                    )}
                </div>
            </div>

            {/* Filter and Selection bar (Admin Only) */}
            {user.role === 'admin' && (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-gray-900/60 p-3.5 sm:p-4 rounded-2xl border border-white/5 overflow-hidden">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        {/* Branch filter and Opinion Type filter side-by-side in one line on mobile */}
                        <div className="grid grid-cols-2 gap-2 w-full sm:w-auto shrink-0">
                            <select
                                value={filterBranch}
                                onChange={e => setFilterBranch(e.target.value)}
                                className="bg-gray-800 text-white text-xs font-bold px-2.5 sm:px-4 py-2.5 rounded-xl border border-white/10 outline-none cursor-pointer truncate"
                            >
                                <option value="all">كل الفروع ({branchesWithFeedback.length})</option>
                                {branchesWithFeedback.map((m, idx) => (
                                    <option key={idx} value={m}>{m}</option>
                                ))}
                            </select>

                            <select
                                value={filterType}
                                onChange={e => setFilterType(e.target.value)}
                                className="bg-gray-800 text-white text-xs font-bold px-2.5 sm:px-4 py-2.5 rounded-xl border border-white/10 outline-none cursor-pointer truncate"
                            >
                                <option value="all">كل الأنواع</option>
                                <option value="شكوى">الشكاوى</option>
                                <option value="مقترح">المقترحات</option>
                            </select>
                        </div>

                        {/* Search Input */}
                        <input
                            type="text"
                            placeholder="بحث بالعميل أو الهاتف أو الفرع..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="bg-gray-800 text-white text-xs px-3 sm:px-4 py-2.5 rounded-xl border border-white/10 outline-none flex-1 min-w-0 w-full"
                        />
                    </div>

                    {/* Selection toggle for Admin */}
                    {filteredFeedbacks.length > 0 && (
                        <button
                            onClick={handleToggleSelectAll}
                            className="flex items-center justify-center gap-2 text-xs font-bold text-gray-300 hover:text-white px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition cursor-pointer shrink-0"
                        >
                            {isAllSelected ? <CheckSquare size={16} className="text-blue-400" /> : <Square size={16} />}
                            <span>{isAllSelected ? 'إلغاء تحديد الكل' : 'تحديد الكل للتصدير'}</span>
                        </button>
                    )}
                </div>
            )}

            {/* List of Feedbacks */}
            {loading ? (
                <div className="text-center py-16 text-white/50 font-bold">جاري تحميل آراء وشكاوى العملاء...</div>
            ) : filteredFeedbacks.length === 0 ? (
                <div className="text-center py-16 bg-gray-900/40 rounded-3xl border border-dashed border-white/10 p-8">
                    <MessageSquareQuote size={48} className="mx-auto text-white/20 mb-4" />
                    <p className="text-white/60 font-bold mb-2">لا توجد آراء أو شكاوى مسجلة حتى الآن</p>
                    <p className="text-xs text-white/40">اضغط على زر "أضف" بالأعلى لتسجيل رأي عميل جديد في أي وقت</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredFeedbacks.map((item, index) => {
                        const isExpanded = expandedIds.has(item.id);
                        const isSelected = selectedExportIds.has(item.id);

                        return (
                            <div
                                key={item.id}
                                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                                    isSelected 
                                        ? 'bg-blue-950/30 border-blue-500/50 shadow-lg' 
                                        : 'bg-gray-900/70 border-white/10 hover:border-white/20'
                                }`}
                            >
                                {/* Main Row (Click anywhere to open Detail Modal) */}
                                <div 
                                    onClick={() => setSelectedFeedback(item)}
                                    className="p-2.5 sm:p-4 flex items-center justify-between gap-1.5 sm:gap-3 cursor-pointer group select-none overflow-x-hidden"
                                >
                                    {/* Desktop View (sm:flex) */}
                                    <div className="hidden sm:flex items-center gap-3 min-w-0 flex-1">
                                        {/* Selection Checkbox (Admin Only) */}
                                        {user.role === 'admin' && (
                                            <div
                                                onClick={(e) => handleToggleSelectExport(item.id, e)}
                                                className="p-1 hover:text-blue-400 text-gray-400 transition cursor-pointer"
                                                title="تحديد للتصدير"
                                            >
                                                {isSelected ? <CheckSquare size={18} className="text-blue-400" /> : <Square size={18} />}
                                            </div>
                                        )}

                                        {/* Serial Number from #1 */}
                                        <div className="w-8 h-8 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-blue-400 shrink-0">
                                            {index + 1}
                                        </div>

                                        {/* Branch Name */}
                                        <div className="flex items-center gap-2 min-w-[120px] max-w-[200px] truncate">
                                            <Building2 size={16} className="text-emerald-400 shrink-0" />
                                            <span className="font-bold text-sm text-white truncate" title={item.branchName}>
                                                {item.branchName}
                                            </span>
                                        </div>

                                        {/* Opinion Type Badge (مقترح / شكوى) */}
                                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-black shrink-0 ${
                                            item.opinionType === 'مقترح'
                                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                        }`}>
                                            {item.opinionType || 'شكوى'}
                                        </span>

                                        {/* Day, Date, Time */}
                                        <div className="flex items-center gap-3 text-xs text-white/70">
                                            <span className="px-2.5 py-1 rounded-lg bg-white/5 font-bold text-amber-300">
                                                {item.dayName}
                                            </span>
                                            <span className="flex items-center gap-1 font-mono text-gray-300">
                                                <Calendar size={13} className="text-gray-400" />
                                                {item.date}
                                            </span>
                                            <span className="flex items-center gap-1 font-mono text-gray-300">
                                                <Clock size={13} className="text-gray-400" />
                                                {item.time}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Mobile View: اسم الفرع وبجانبه نوع الشكوى والتاريخ في سطر واحد بوضوح وبدون مسطرة */}
                                    <div className="flex sm:hidden items-center justify-between gap-1 w-full min-w-0">
                                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                            {user.role === 'admin' && (
                                                <div
                                                    onClick={(e) => handleToggleSelectExport(item.id, e)}
                                                    className="p-0.5 hover:text-blue-400 text-gray-400 transition cursor-pointer shrink-0"
                                                    title="تحديد للتصدير"
                                                >
                                                    {isSelected ? <CheckSquare size={15} className="text-blue-400" /> : <Square size={15} />}
                                                </div>
                                            )}
                                            {/* اسم الفرع */}
                                            <span className="font-bold text-xs text-emerald-400 whitespace-nowrap shrink-0">
                                                {item.branchName}
                                            </span>
                                            {/* نوع الشكوى */}
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-black shrink-0 whitespace-nowrap ${
                                                item.opinionType === 'مقترح'
                                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                    : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                            }`}>
                                                {item.opinionType || 'شكوى'}
                                            </span>
                                            {/* التاريخ */}
                                            <span className="text-[10px] font-mono text-gray-300 shrink-0 whitespace-nowrap">
                                                {item.date}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-0.5 shrink-0">
                                            {user.role === 'admin' && (
                                                <button
                                                    onClick={(e) => handleDeleteFeedback(item.id, e)}
                                                    className="p-1 text-rose-400 hover:text-rose-300 rounded transition"
                                                    title="حذف"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                            <button
                                                onClick={(e) => handleToggleExpand(item.id, e)}
                                                className="p-1 text-white/60 hover:text-white rounded transition"
                                                title={isExpanded ? "طي التفاصيل" : "عرض التفاصيل"}
                                            >
                                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Desktop Action Buttons & Expand Arrow on the far left */}
                                    <div className="hidden sm:flex items-center gap-2 shrink-0">
                                        {/* Delete Button (Admin Only) */}
                                        {user.role === 'admin' && (
                                            <button
                                                onClick={(e) => handleDeleteFeedback(item.id, e)}
                                                className="p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition"
                                                title="حذف الرأي"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        )}

                                        {/* Expand / Collapse Arrow on the far left */}
                                        <button
                                            onClick={(e) => handleToggleExpand(item.id, e)}
                                            className="p-2 text-white/60 hover:text-white hover:bg-white/10 rounded-xl transition"
                                            title={isExpanded ? "طي التفاصيل" : "عرض التفاصيل منسدلة"}
                                        >
                                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Inline Expandable Dropdown */}
                                {isExpanded && (
                                    <div className="px-4 sm:px-5 pb-5 pt-2 border-t border-white/5 bg-black/20 space-y-3 animate-in fade-in duration-200">
                                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                                            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                                <span className="text-white/40 block mb-1 font-bold">نوع الرأي:</span>
                                                <span className={`text-xs font-bold px-2 py-0.5 rounded inline-block ${
                                                    item.opinionType === 'مقترح'
                                                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                                }`}>
                                                    {item.opinionType || 'شكوى'}
                                                </span>
                                            </div>
                                            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                                <span className="text-white/40 block mb-1 font-bold">اسم العميل:</span>
                                                <span className="font-bold text-white text-sm">{item.customerName}</span>
                                            </div>
                                            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                                <span className="text-white/40 block mb-1 font-bold">رقم الهاتف:</span>
                                                <a 
                                                    href={`tel:${item.phoneNumber}`} 
                                                    onClick={e => e.stopPropagation()} 
                                                    className="font-bold text-blue-400 hover:underline text-sm font-mono block"
                                                    dir="ltr"
                                                >
                                                    {item.phoneNumber}
                                                </a>
                                            </div>
                                            <div className="p-3 bg-white/5 rounded-xl border border-white/5">
                                                <span className="text-white/40 block mb-1 font-bold">سجل بواسطة:</span>
                                                <span className="font-bold text-gray-300 text-sm">{item.createdBy}</span>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                            <div className="flex justify-between items-center mb-2 flex-wrap gap-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-white/70 text-xs font-bold">نص الرأي:</span>
                                                    <span className="text-xs font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30">
                                                        اليوم: {item.dayName}
                                                    </span>
                                                    <span className="text-xs font-mono text-gray-200 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                                                        التاريخ: {item.date}
                                                    </span>
                                                </div>
                                                <span className="text-[11px] text-white/40 font-mono">
                                                    {getWordCount(item.complaint)} كلمة
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                                                {item.complaint}
                                            </p>
                                        </div>

                                        {user.role === 'admin' && (
                                            <div className="flex justify-end pt-1">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        exportFeedbacksToPDF([item], `شكوى العميل - ${item.customerName}`);
                                                    }}
                                                    className="text-xs bg-rose-600/30 hover:bg-rose-600/50 text-rose-300 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-rose-500/30 transition"
                                                >
                                                    <Download size={14} />
                                                    <span>تصدير PDF لهذه الشكوى</span>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal 1: Add Feedback (Popup) */}
            {showAddModal && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
                    <div className="w-full max-w-lg p-5 sm:p-6 rounded-3xl border border-white/10 bg-gray-900 text-white shadow-2xl animate-in zoom-in-95 my-auto max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center gap-2 mb-6 border-b border-white/10 pb-4">
                            <div className="flex items-center gap-2 min-w-0">
                                <MessageSquareQuote className="text-blue-400 shrink-0" size={22} />
                                <h3 className="text-base sm:text-xl font-bold text-white whitespace-nowrap">إضافة رأي</h3>
                            </div>

                            {/* Dropdown نوع الرأي and X close button on the left */}
                            <div className="flex items-center gap-2 shrink-0">
                                <div className="flex items-center gap-1.5 bg-gray-800 px-2 sm:px-3 py-1.5 rounded-xl border border-white/10">
                                    <label className="text-[11px] sm:text-xs font-bold text-amber-300 whitespace-nowrap">نوع الرأي:</label>
                                    <select
                                        value={opinionType}
                                        onChange={e => setOpinionType(e.target.value as 'مقترح' | 'شكوى')}
                                        className="bg-gray-700 text-white text-xs font-bold px-1.5 py-1 rounded-lg border border-white/10 outline-none cursor-pointer focus:border-blue-500"
                                    >
                                        <option value="مقترح">مقترح</option>
                                        <option value="شكوى">شكوى</option>
                                    </select>
                                </div>
                                <button 
                                    onClick={() => setShowAddModal(false)} 
                                    className="text-white/50 hover:text-white p-1 rounded-lg hover:bg-white/10 transition cursor-pointer"
                                    title="إغلاق"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmitFeedback} className="space-y-4">
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                {/* Branch Selection Dropdown */}
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="block text-xs font-bold opacity-70 text-white truncate">اختر الفرع *</label>
                                        {user.role === 'admin' && (
                                            <button
                                                type="button"
                                                onClick={handleAddBranch}
                                                className="text-[10px] sm:text-[11px] text-blue-400 hover:text-blue-300 font-bold flex items-center gap-0.5 cursor-pointer shrink-0"
                                                title="إضافة فرع جديد"
                                            >
                                                <Plus size={12} />
                                                <span>أضف فرع</span>
                                            </button>
                                        )}
                                    </div>
                                    <select
                                        value={branchName}
                                        onChange={e => setBranchName(e.target.value)}
                                        className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10 font-bold text-xs sm:text-sm outline-none focus:border-blue-500 transition"
                                        required
                                    >
                                        <option value="">-- اختر الفرع --</option>
                                        {markets.map((m, idx) => (
                                            <option key={idx} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Customer Name */}
                                <div>
                                    <div className="h-[21px] mb-1 flex items-center">
                                        <label className="block text-xs font-bold opacity-70 text-white">اسم العميل *</label>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="أدخل اسم العميل..."
                                        value={customerName}
                                        onChange={e => setCustomerName(e.target.value)}
                                        className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10 font-bold text-xs sm:text-sm outline-none focus:border-blue-500 transition"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Phone Number */}
                            <div>
                                <label className="block text-xs font-bold mb-1 opacity-70 text-white">رقم الهاتف *</label>
                                <input
                                    type="tel"
                                    placeholder="أدخل رقم هاتف العميل..."
                                    value={phoneNumber}
                                    onChange={e => setPhoneNumber(e.target.value)}
                                    className="w-full p-3 rounded-xl bg-gray-800 text-white border border-white/10 font-bold text-xs sm:text-sm outline-none focus:border-blue-500 transition font-mono"
                                    dir="ltr"
                                    required
                                />
                            </div>

                            {/* Complaint / Feedback Textarea (Up to 1000 words) */}
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-xs font-bold opacity-70 text-white">الشكوى / ملاحظات العميل *</label>
                                    <span className={`text-[11px] font-bold ${getWordCount(complaint) >= 950 ? 'text-rose-400' : 'text-blue-400'}`}>
                                        {getWordCount(complaint)} / 1000 كلمة
                                    </span>
                                </div>
                                <textarea
                                    rows={6}
                                    placeholder="اكتب تفاصيل رأي أو شكوى العميل هنا (حتى 1000 كلمة)..."
                                    value={complaint}
                                    onChange={handleComplaintChange}
                                    className="w-full p-4 rounded-2xl bg-gray-800 text-white border border-white/10 font-medium outline-none focus:border-blue-500 transition leading-relaxed resize-none"
                                    required
                                />
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={formSubmitting}
                                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2 mt-6 disabled:opacity-50 cursor-pointer"
                            >
                                <Send size={20} />
                                <span>{formSubmitting ? 'جاري الإرسال...' : 'إرسال'}</span>
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal 2: Details Modal (When clicking any part of the row) */}
            {selectedFeedback && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
                    <div className="w-full max-w-xl p-6 rounded-3xl border border-white/10 bg-gray-900 text-white shadow-2xl animate-in zoom-in-95 my-auto max-h-[90vh] overflow-y-auto">
                        {/* Header: Title, PDF Export (admin only), Close button (X on top left) */}
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <div className="flex items-center gap-2">
                                <MessageSquareQuote className="text-blue-400" size={24} />
                                <h3 className="text-xl font-bold text-white">تفاصيل رأي / شكوى العميل</h3>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Top PDF Export Button (Admin Only) */}
                                {user.role === 'admin' && (
                                    <button
                                        onClick={() => exportFeedbacksToPDF([selectedFeedback], `شكوى العميل - ${selectedFeedback.customerName}`)}
                                        disabled={isExportingPDF}
                                        className="bg-rose-600 hover:bg-rose-500 text-white text-xs px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition cursor-pointer"
                                    >
                                        <Download size={16} />
                                        <span>تصدير PDF</span>
                                    </button>
                                )}

                                {/* Top Left X Close Button */}
                                <button
                                    onClick={() => setSelectedFeedback(null)}
                                    className="text-white/50 hover:text-white p-1 rounded-lg transition cursor-pointer"
                                    title="إغلاق"
                                >
                                    <X size={22} />
                                </button>
                            </div>
                        </div>

                        {/* Details content */}
                        <div className="space-y-4">
                            {/* Mobile View (sm:hidden): مطابقة دقيقة لطلب المستخدم */}
                            <div className="block sm:hidden space-y-3">
                                {/* السطر 1: الفرع بجانبه اسم العميل */}
                                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <span className="text-xs text-white/40 font-bold shrink-0">الفرع:</span>
                                        <span className="text-xs font-black text-emerald-400 truncate">{selectedFeedback.branchName}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
                                        <span className="text-xs text-white/40 font-bold shrink-0">العميل:</span>
                                        <span className="text-xs font-black text-white truncate">{selectedFeedback.customerName}</span>
                                    </div>
                                </div>

                                {/* السطر 2: رقم الهاتف والاتصال ونسخ الرقم وبجانبه الموظف المسجل */}
                                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                        <span className="text-xs font-bold text-blue-400 font-mono" dir="ltr">
                                            {selectedFeedback.phoneNumber}
                                        </span>
                                        <a
                                            href={`tel:${selectedFeedback.phoneNumber}`}
                                            className="p-1.5 bg-blue-600/30 text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-600/50 transition flex items-center justify-center shrink-0"
                                            title="اتصال بالعميل"
                                        >
                                            <Phone size={13} />
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => handleCopyPhone(selectedFeedback.phoneNumber)}
                                            className="p-1.5 bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-bold transition flex items-center justify-center shrink-0 cursor-pointer"
                                            title="نسخ الرقم"
                                        >
                                            {copiedPhone ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-1 min-w-0 shrink-0">
                                        <span className="text-[11px] text-white/40 font-bold">الموظف:</span>
                                        <span className="text-xs font-bold text-gray-300 truncate max-w-[100px]">{selectedFeedback.createdBy}</span>
                                    </div>
                                </div>

                                {/* السطر 3: نوع الرأي وإخفاء خانة توقيت التسجيل */}
                                <div className="p-3.5 bg-white/5 rounded-2xl border border-white/5 flex items-center justify-between">
                                    <span className="text-xs text-white/40 font-bold">نوع الرأي:</span>
                                    <span className={`text-xs font-black px-3 py-1 rounded-lg border ${
                                        selectedFeedback.opinionType === 'مقترح'
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                            : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                    }`}>
                                        {selectedFeedback.opinionType || 'شكوى'}
                                    </span>
                                </div>

                                {/* السطر 4: نص الرأي يكون اليوم والتاريخ والساعة واسفله الرأي */}
                                <div className="p-4 bg-white/5 rounded-2xl border border-white/10 space-y-2.5">
                                    <div className="flex flex-wrap items-center gap-1.5 pb-2 border-b border-white/5 text-[11px] font-bold">
                                        <span className="text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-lg border border-amber-500/30">
                                            {selectedFeedback.dayName}
                                        </span>
                                        <span className="font-mono text-gray-200 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                                            {selectedFeedback.date}
                                        </span>
                                        <span className="font-mono text-cyan-300 bg-cyan-500/15 px-2 py-0.5 rounded-lg border border-cyan-500/30">
                                            {selectedFeedback.time}
                                        </span>
                                        <span className="text-[10px] text-white/40 font-mono mr-auto">
                                            {getWordCount(selectedFeedback.complaint)} كلمة
                                        </span>
                                    </div>
                                    <div className="p-3 bg-black/30 rounded-xl border border-white/5 text-sm text-gray-100 whitespace-pre-wrap leading-relaxed max-h-[250px] overflow-y-auto">
                                        {selectedFeedback.complaint}
                                    </div>
                                </div>
                            </div>

                            {/* Desktop View (hidden sm:block): العرض الكامل للشاشات الكبيرة */}
                            <div className="hidden sm:block space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <span className="text-xs text-white/40 block mb-1 font-bold">الفرع</span>
                                        <span className="text-base font-black text-emerald-400">{selectedFeedback.branchName}</span>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <span className="text-xs text-white/40 block mb-1 font-bold">اسم العميل</span>
                                        <span className="text-base font-black text-white">{selectedFeedback.customerName}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <span className="text-xs text-white/40 block mb-1 font-bold">رقم الهاتف</span>
                                        <div className="flex items-center justify-between">
                                            <span className="text-base font-bold text-blue-400 font-mono" dir="ltr">
                                                {selectedFeedback.phoneNumber}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <a
                                                    href={`tel:${selectedFeedback.phoneNumber}`}
                                                    className="px-3 py-1 bg-blue-600/30 text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-600/50 transition flex items-center gap-1"
                                                >
                                                    <Phone size={12} />
                                                    <span>اتصال</span>
                                                </a>
                                                <button
                                                    type="button"
                                                    onClick={() => handleCopyPhone(selectedFeedback.phoneNumber)}
                                                    className="px-2.5 py-1 bg-white/10 text-gray-300 hover:text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                                    title="نسخ الرقم"
                                                >
                                                    {copiedPhone ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                                                    <span>{copiedPhone ? 'تم النسخ' : 'نسخ'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <span className="text-xs text-white/40 block mb-1 font-bold">الموظف المسجل</span>
                                        <span className="text-base font-bold text-gray-300">{selectedFeedback.createdBy}</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <span className="text-xs text-white/40 block mb-1 font-bold">نوع الرأي</span>
                                        <span className={`text-xs font-black px-3 py-1 rounded-lg inline-block border ${
                                            selectedFeedback.opinionType === 'مقترح'
                                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                        }`}>
                                            {selectedFeedback.opinionType || 'شكوى'}
                                        </span>
                                    </div>
                                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                                        <span className="text-xs text-white/40 block mb-1 font-bold">توقيت التسجيل</span>
                                        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-gray-300">
                                            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                                {selectedFeedback.dayName}
                                            </span>
                                            <span className="font-mono text-gray-300">{selectedFeedback.date}</span>
                                            <span className="font-mono text-gray-300">{selectedFeedback.time}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Complaint Full Text */}
                                <div className="p-5 bg-white/5 rounded-2xl border border-white/10 space-y-2">
                                    <div className="flex justify-between items-center flex-wrap gap-2">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm text-white font-bold">نص الرأي:</span>
                                            <span className="text-xs font-bold text-amber-300 bg-amber-500/20 px-2.5 py-1 rounded-lg border border-amber-500/30">
                                                اليوم: {selectedFeedback.dayName}
                                            </span>
                                            <span className="text-xs font-mono font-bold text-gray-200 bg-white/10 px-2.5 py-1 rounded-lg border border-white/10">
                                                التاريخ: {selectedFeedback.date}
                                            </span>
                                            <span className="text-xs font-mono font-bold text-cyan-300 bg-cyan-500/15 px-2.5 py-1 rounded-lg border border-cyan-500/30">
                                                الساعة: {selectedFeedback.time}
                                            </span>
                                        </div>
                                        <span className="text-[11px] text-white/40 font-mono">
                                            {getWordCount(selectedFeedback.complaint)} كلمة
                                        </span>
                                    </div>
                                    <div className="p-4 bg-black/30 rounded-xl border border-white/5 text-sm text-gray-100 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto">
                                        {selectedFeedback.complaint}
                                    </div>
                                </div>
                            </div>

                            {/* Bottom actions */}
                            <div className="flex items-center justify-between pt-2">
                                {user.role === 'admin' ? (
                                    <button
                                        onClick={(e) => handleDeleteFeedback(selectedFeedback.id, e)}
                                        className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 p-2 rounded-xl hover:bg-rose-500/10 transition font-bold"
                                    >
                                        <Trash2 size={16} />
                                        <span>حذف هذا الرأي</span>
                                    </button>
                                ) : <div />}

                                <button
                                    onClick={() => setSelectedFeedback(null)}
                                    className="px-6 py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-xl text-xs font-bold transition"
                                >
                                    إغلاق
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
