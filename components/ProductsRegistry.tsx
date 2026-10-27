import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { ref as dbRef, push, onValue, set, remove, update } from 'firebase/database';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { User } from '../types';
import { 
    Plus, Search, List, Grid, Image as ImageIcon, Link as LinkIcon, 
    Upload, X, Save, Copy, Check, Download, FileSpreadsheet, File as FilePdf, Trash2, Edit, ChevronRight, ChevronLeft
} from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import html2canvas from 'html2canvas';

// Type definitions for jspdf-autotable so TypeScript doesn't complain
interface jsPDFWithAutoTable extends jsPDF {
    autoTable: (options: any) => void;
}

interface Product {
    id: string;
    name: string;
    category: string;
}

interface RegistryItem {
    id: string;
    productId: string;
    productName: string;
    category: string;
    barcode: string;
    baleQuantity: string;
    imageUrl: string;
    images?: string[];
    createdAt: number;
}

interface ProductsRegistryProps {
    user: User | null;
    theme: string;
    products: Product[];
}

const CachedImage: React.FC<{ src: string; alt: string; className?: string }> = ({ src, alt, className }) => {
    const [loadedSrc, setLoadedSrc] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;
        if (!src) return;

        const fetchImage = async () => {
            try {
                if (src.startsWith('blob:') || src.startsWith('data:')) {
                    if (isMounted) setLoadedSrc(src);
                    return;
                }
                const cache = await caches.open('products-images-v1');
                const cachedResponse = await cache.match(src);
                
                if (cachedResponse) {
                    const blob = await cachedResponse.blob();
                    if (isMounted) setLoadedSrc(URL.createObjectURL(blob));
                } else {
                    const response = await fetch(src);
                    if (response.ok) {
                        cache.put(src, response.clone());
                        const blob = await response.blob();
                        if (isMounted) setLoadedSrc(URL.createObjectURL(blob));
                    } else {
                        if (isMounted) setLoadedSrc(src);
                    }
                }
            } catch (error) {
                if (isMounted) setLoadedSrc(src);
            }
        };
        
        fetchImage();
        return () => { isMounted = false; };
    }, [src]);

    return <img src={loadedSrc || src} alt={alt} className={className} loading="lazy" />;
};

const ProductsRegistry: React.FC<ProductsRegistryProps> = ({ user, theme, products }) => {
    const [items, setItems] = useState<RegistryItem[]>([]);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    
    // Add Form State
    const [selectedProductId, setSelectedProductId] = useState('');
    const [barcode, setBarcode] = useState('');
    const [baleQuantity, setBaleQuantity] = useState('');
    
    type ImageEntry = {
        id: string;
        isExisting: boolean;
        url: string;
        file: File | null;
        preview: string;
    };
    const [imageEntries, setImageEntries] = useState<ImageEntry[]>([]);
    const [primaryImageId, setPrimaryImageId] = useState<string>('');
    const [imageType, setImageType] = useState<'url' | 'upload'>('upload');
    const [tempUrl, setTempUrl] = useState('');
    
    const [isSaving, setIsSaving] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Lightbox State
    const [lightboxImages, setLightboxImages] = useState<string[]>([]);
    const [lightboxIndex, setLightboxIndex] = useState<number>(0);

    // Toast State
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    useEffect(() => {
        const itemsRef = dbRef(db, 'products_registry');
        const unsubscribe = onValue(itemsRef, (snapshot) => {
            if (snapshot.exists()) {
                const data = snapshot.val();
                const loadedItems = Object.keys(data).map(key => ({
                    id: key,
                    ...data[key]
                })).sort((a, b) => a.createdAt - b.createdAt);
                setItems(loadedItems);
            } else {
                setItems([]);
            }
        });
        return () => unsubscribe();
    }, []);

    const showToast = (msg: string) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 2500);
    };

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        showToast(`تم نسخ ${label} بنجاح`);
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleSave = async () => {
        if (!selectedProductId) return alert("الرجاء اختيار الصنف");
        if (!barcode.trim()) return alert("الرجاء إدخال كود الصنف");
        
        setIsSaving(true);
        try {
            let finalUrls: string[] = [];
            
            for (const entry of imageEntries) {
                if (entry.isExisting || (entry.url && !entry.file)) {
                    finalUrls.push(entry.url);
                } else if (entry.file) {
                    const formData = new FormData();
                    formData.append('image', entry.file);
                    const k = atob('ODUyYWQ4MWQ4NmMxNWU2Y2QxODI0NTAyMWZmOTQ0OTM=');
                    
                    try {
                        const response = await fetch(`https://api.imgbb.com/1/upload?key=${k}`, {
                            method: 'POST',
                            body: formData
                        });
                        
                        const data = await response.json();
                        if (data && data.success) {
                            finalUrls.push(data.data.url);
                        } else {
                            throw new Error(data.error?.message || "فشل رفع الصورة");
                        }
                    } catch (uploadError) {
                        console.error("Upload error:", uploadError);
                        alert(`حدث خطأ أثناء رفع إحدى الصور. قد يكون السبب مشكلة في الاتصال أو استخدام مانع إعلانات (AdBlocker) يمنع الرفع.`);
                        setIsSaving(false);
                        return;
                    }
                }
            }

            let finalPrimaryUrl = finalUrls.length > 0 ? finalUrls[0] : '';
            const primaryIndex = imageEntries.findIndex(e => e.id === primaryImageId);
            if (primaryIndex !== -1 && finalUrls[primaryIndex]) {
                finalPrimaryUrl = finalUrls[primaryIndex];
            }

            const selectedProduct = products.find(p => p.id === selectedProductId);

            const itemData = {
                productId: selectedProductId,
                productName: selectedProduct?.name || 'غير معروف',
                category: selectedProduct?.category || 'Uncategorized',
                barcode: barcode.trim(),
                baleQuantity: baleQuantity.trim(),
                imageUrl: finalPrimaryUrl,
                images: finalUrls,
            };

            if (editingItemId) {
                await update(dbRef(db, `products_registry/${editingItemId}`), {
                    ...itemData,
                    updatedAt: Date.now()
                });
                showToast("تم تعديل الصنف بنجاح");
            } else {
                const itemsRef = dbRef(db, 'products_registry');
                const newRef = push(itemsRef);
                await set(newRef, {
                    ...itemData,
                    createdAt: Date.now()
                });
                showToast("تمت إضافة الصنف بنجاح");
            }

            setShowAddModal(false);
            setEditingItemId(null);
            setSelectedProductId('');
            setBarcode('');
            setBaleQuantity('');
            setImageEntries([]);
            setPrimaryImageId('');
            setTempUrl('');
        } catch (error) {
            console.error("Error saving product:", error);
            alert("حدث خطأ أثناء الحفظ. يرجى المحاولة مرة أخرى.");
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("هل أنت متأكد من حذف هذا الصنف من السجل؟")) {
            await remove(dbRef(db, `products_registry/${id}`));
            showToast("تم الحذف بنجاح");
        }
    };

    // Filter items
    const filteredItems = items.filter(item => 
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.barcode.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Base64 image encoding helper for PDF
    const getBase64ImageFromUrl = async (imageUrl: string) => {
        const res = await fetch(imageUrl);
        if (!res.ok) throw new Error("Failed to fetch image");
        const blob = await res.blob();
        if (!blob.type.startsWith("image/")) throw new Error("Not an image");
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    };

    // Exports
    const exportExcel = () => {
        const dataToExport = filteredItems.map(item => ({
            "اسم الصنف": item.productName,
            "الباركود": item.barcode
        }));
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        
        // Add styling/formatting for printing
        worksheet['!cols'] = [
            { wch: 40 }, // اسم الصنف
            { wch: 30 }  // الباركود
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "المنتجات");
        XLSX.writeFile(workbook, "سجل_المنتجات.xlsx");
    };

    const exportPDF = async () => {
        showToast("جاري تجهيز ملف PDF...");
        try {
            // إنشاء جدول HTML مخفي للتصدير لضمان دعم اللغة العربية وتنسيقات CSS
            const container = document.createElement("div");
            container.style.position = "absolute";
            container.style.top = "-9999px";
            container.style.left = "-9999px";
            container.style.width = "800px";
            container.style.backgroundColor = "#ffffff";
            container.style.color = "#000000";
            container.style.padding = "20px";
            container.style.direction = "rtl";
            container.style.fontFamily = "sans-serif";
            
            let html = `
                <h1 style="text-align: center; color: #1e3a8a; margin-bottom: 20px;">سجل المنتجات</h1>
                <table style="width: 100%; border-collapse: collapse; text-align: right;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="padding: 10px; border: 1px solid #d1d5db;">الصنف</th>
                            <th style="padding: 10px; border: 1px solid #d1d5db;">الباركود</th>
                            <th style="padding: 10px; border: 1px solid #d1d5db;">العدد في البالة</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            for (let item of filteredItems) {
                html += `
                    <tr>
                        <td style="padding: 10px; border: 1px solid #d1d5db;">${item.productName || '-'}</td>
                        <td style="padding: 10px; border: 1px solid #d1d5db;">${item.barcode || '-'}</td>
                        <td style="padding: 10px; border: 1px solid #d1d5db;">${item.baleQuantity || '-'}</td>
                    </tr>
                `;
            }
            
            html += `</tbody></table>`;
            container.innerHTML = html;
            document.body.appendChild(container);
            
            const canvas = await html2canvas(container, { scale: 2, useCORS: true });
            document.body.removeChild(container);
            
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            pdf.save("سجل_المنتجات.pdf");
        } catch (error) {
            console.error("PDF Export error:", error);
            alert("حدث خطأ أثناء تصدير ملف PDF.");
        }
    };

    // Advanced PDF Export with Images
    const exportPDFWithImages = async () => {
        showToast("جاري تحميل الصور وتجهيز ملف PDF، قد يستغرق بعض الوقت...");
        try {
            // إنشاء جدول HTML مخفي للتصدير لضمان دعم اللغة العربية والصور
            const container = document.createElement("div");
            container.style.position = "absolute";
            container.style.top = "-9999px";
            container.style.left = "-9999px";
            container.style.width = "800px";
            container.style.backgroundColor = "#ffffff";
            container.style.color = "#000000";
            container.style.padding = "20px";
            container.style.direction = "rtl";
            container.style.fontFamily = "sans-serif";
            
            let html = `
                <h1 style="text-align: center; color: #1e3a8a; margin-bottom: 20px;">سجل المنتجات (بالصور)</h1>
                <table style="width: 100%; border-collapse: collapse; text-align: right;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="padding: 10px; border: 1px solid #d1d5db; width: 80px;">الصورة</th>
                            <th style="padding: 10px; border: 1px solid #d1d5db;">الصنف</th>
                            <th style="padding: 10px; border: 1px solid #d1d5db;">الباركود</th>
                            <th style="padding: 10px; border: 1px solid #d1d5db;">العدد في البالة</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
            
            for (let item of filteredItems) {
                let imgSrc = "";
                if (item.imageUrl) {
                    try {
                        imgSrc = await getBase64ImageFromUrl(item.imageUrl);
                    } catch (e) {
                        console.log("Failed to load image for PDF", e);
                    }
                }
                
                const imgTag = imgSrc ? `<img src="${imgSrc}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px;" />` : '';
                
                html += `
                    <tr>
                        <td style="padding: 10px; border: 1px solid #d1d5db; text-align: center;">${imgTag}</td>
                        <td style="padding: 10px; border: 1px solid #d1d5db; vertical-align: middle;">${item.productName || '-'}</td>
                        <td style="padding: 10px; border: 1px solid #d1d5db; vertical-align: middle;">${item.barcode || '-'}</td>
                        <td style="padding: 10px; border: 1px solid #d1d5db; vertical-align: middle;">${item.baleQuantity || '-'}</td>
                    </tr>
                `;
            }
            
            html += `</tbody></table>`;
            container.innerHTML = html;
            document.body.appendChild(container);
            
            // Wait a small moment to ensure images in DOM are fully rendered
            await new Promise(resolve => setTimeout(resolve, 500));
            
            const canvas = await html2canvas(container, { scale: 2, useCORS: true });
            document.body.removeChild(container);
            
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pdfWidth = pdf.internal.pageSize.getWidth();
            let pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            
            // Handle multi-page if table is too long
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
            
            pdf.save("سجل_المنتجات_بالصور.pdf");
        } catch (error) {
            console.error("PDF Export error:", error);
            alert("حدث خطأ أثناء تصدير ملف PDF بالصور.");
        }
    };

    const downloadOriginalImage = async (url: string, filename: string) => {
        try {
            // Because of strict CORS on imgbb and similar CDNs, a direct fetch often fails.
            // A more robust client-side approach is to load the image into a hidden canvas
            // and then export it as a data URL. This requires the image to be loaded with crossOrigin = "anonymous".
            
            const image = new Image();
            image.crossOrigin = "anonymous";
            image.src = url;
            
            image.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = image.width;
                    canvas.height = image.height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) throw new Error("Could not get canvas context");
                    
                    ctx.drawImage(image, 0, 0);
                    
                    // We'll default to jpeg since we are drawing to canvas
                    const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
                    
                    const a = document.createElement('a');
                    a.style.display = 'none';
                    a.href = dataUrl;
                    a.download = `${filename}_${Date.now()}.jpg`;
                    document.body.appendChild(a);
                    a.click();
                    
                    setTimeout(() => {
                        document.body.removeChild(a);
                    }, 100);
                } catch (canvasError) {
                    console.error("Canvas export failed (likely tainted by CORS):", canvasError);
                    window.open(url, '_blank');
                }
            };
            
            image.onerror = () => {
                console.error("Image failed to load for downloading");
                window.open(url, '_blank');
            };

        } catch (error) {
            console.error("Download error:", error);
            window.open(url, '_blank');
        }
    };

    // Group products for dropdown
    const categories = Array.from(new Set(products.map(p => p.category)));

    return (
        <div className="flex flex-col h-full animate-in fade-in zoom-in-95 duration-300 w-full relative">
            {/* Header section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white flex items-center gap-3">
                        <List size={32} className="text-blue-500" />
                        سجل المنتجات
                    </h1>
                    <p className="text-white/50 text-sm mt-1">عرض وتسجيل المنتجات مع الباركود وتفاصيل التعبئة</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                    {user?.role === 'admin' && (
                        <>
                            <button onClick={exportExcel} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition text-sm">
                                <FileSpreadsheet size={16} /> Excel
                            </button>
                            <button onClick={exportPDFWithImages} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition text-sm">
                                <FilePdf size={16} /> PDF
                            </button>
                            <button onClick={() => {
                                setEditingItemId(null);
                                setSelectedProductId('');
                                setBarcode('');
                                setBaleQuantity('');
                                setImageEntries([]);
                                setPrimaryImageId('');
                                setTempUrl('');
                                setImageType('upload');
                                setShowAddModal(true);
                            }} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition text-sm shadow-lg shadow-blue-500/20 ml-2">
                                <Plus size={18} /> أضف صنف
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Controls section */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 bg-white/5 p-4 rounded-2xl border border-white/10">
                <div className="relative w-full md:w-96">
                    <input 
                        type="text" 
                        placeholder="ابحث عن صنف أو باركود..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 text-white px-10 py-3 rounded-xl focus:outline-none focus:border-blue-500 transition placeholder:text-white/30"
                    />
                    <Search className="absolute right-3 top-3.5 text-white/40" size={18} />
                </div>

                <div className="flex bg-black/40 rounded-xl border border-white/10 overflow-hidden shrink-0">
                    <button 
                        onClick={() => setViewMode('grid')}
                        className={`px-4 py-2 flex items-center gap-2 transition ${viewMode === 'grid' ? 'bg-blue-600 text-white font-bold' : 'text-white/60 hover:bg-white/5'}`}
                    >
                        <Grid size={18} /> شبكي
                    </button>
                    <button 
                        onClick={() => setViewMode('list')}
                        className={`px-4 py-2 flex items-center gap-2 transition ${viewMode === 'list' ? 'bg-blue-600 text-white font-bold' : 'text-white/60 hover:bg-white/5'}`}
                    >
                        <List size={18} /> طولي
                    </button>
                </div>
            </div>

            {/* Products List */}
            {filteredItems.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center opacity-40 py-20">
                    <List size={64} className="mb-4" />
                    <p className="text-xl font-bold">لا يوجد منتجات في السجل حالياً</p>
                </div>
            ) : (
                <div className={`overflow-y-auto custom-scrollbar flex-1 pb-20 ${viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-6' : 'grid grid-cols-2 sm:flex sm:flex-col gap-2 sm:gap-4'}`}>
                    {filteredItems.map(item => (
                        <div key={item.id} className={`bg-gray-800/80 border border-white/10 rounded-2xl overflow-hidden shadow-xl hover:border-white/20 transition group flex flex-col ${viewMode === 'list' ? 'sm:flex-row' : ''}`}>
                            
                            {/* Image Section */}
                            <div 
                                className={`relative bg-black/40 flex items-center justify-center overflow-hidden cursor-pointer ${viewMode === 'list' ? 'w-full sm:w-48 h-28 sm:h-48 shrink-0' : 'w-full h-28 sm:h-52'}`}
                                onClick={() => {
                                    const imgs = item.images && item.images.length > 0 ? item.images : (item.imageUrl ? [item.imageUrl] : []);
                                    if (imgs.length > 0) {
                                        setLightboxImages(imgs);
                                        setLightboxIndex(0);
                                    }
                                }}
                            >
                                {item.imageUrl ? (
                                    <CachedImage src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                                ) : (
                                    <ImageIcon size={32} className="text-white/20" />
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition duration-300 flex items-center justify-center">
                                    <Search size={24} className="text-white opacity-0 group-hover:opacity-100 transition duration-300 scale-75 group-hover:scale-100 drop-shadow-lg" />
                                </div>
                            </div>

                            {/* Details Section */}
                            <div className="p-2 sm:p-4 flex-1 flex flex-col justify-between min-w-0">
                                <div>
                                    <div className="flex justify-between items-start gap-1 mb-1">
                                        <div 
                                            className="text-xs sm:text-base font-black text-white cursor-pointer hover:text-blue-400 transition leading-snug line-clamp-2 break-words" 
                                            onClick={() => handleCopy(item.productName, "اسم الصنف")}
                                            title={item.productName}
                                        >
                                            {item.productName}
                                        </div>
                                        {user?.role === 'admin' && (
                                            <div className="flex items-center gap-0.5 shrink-0">
                                                <button 
                                                    onClick={() => {
                                                        setEditingItemId(item.id);
                                                        setSelectedProductId(item.productId);
                                                        setBarcode(item.barcode || '');
                                                        setBaleQuantity(item.baleQuantity || '');
                                                        const imgs = item.images && item.images.length > 0 ? item.images : (item.imageUrl ? [item.imageUrl] : []);
                                                        const entries = imgs.map((url, i) => ({
                                                            id: `img_${i}`,
                                                            isExisting: true,
                                                            url: url,
                                                            file: null,
                                                            preview: url
                                                        }));
                                                        setImageEntries(entries);
                                                        setPrimaryImageId(entries.find(e => e.url === item.imageUrl)?.id || (entries.length > 0 ? entries[0].id : ''));
                                                        setShowAddModal(true);
                                                    }} 
                                                    className="text-blue-400 hover:bg-blue-500/20 p-1 sm:p-2 rounded-lg transition"
                                                    title="تعديل"
                                                >
                                                    <Edit size={13} />
                                                </button>
                                                <button 
                                                    onClick={() => handleDelete(item.id)} 
                                                    className="text-red-400 hover:bg-red-500/20 p-1 sm:p-2 rounded-lg transition"
                                                    title="حذف"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-[10px] sm:text-xs text-white/50 mb-1.5 sm:mb-3 truncate">{item.category}</div>
                                </div>

                                <div className="space-y-1.5 sm:space-y-2.5">
                                    <div 
                                        className="bg-black/40 border border-white/10 p-1.5 sm:p-2.5 rounded-xl flex items-center justify-between cursor-pointer hover:border-blue-500/50 transition group/code min-w-0"
                                        onClick={() => handleCopy(item.barcode, "الباركود")}
                                        title="انقر للنسخ"
                                    >
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[9px] sm:text-[10px] text-white/60 mb-0.5 font-bold">الكود</span>
                                            <span className="font-mono font-bold text-white text-[10px] sm:text-xs tracking-wider truncate">{item.barcode || '-'}</span>
                                        </div>
                                        <Copy size={12} className="text-white/30 group-hover/code:text-blue-400 transition shrink-0 ml-1" />
                                    </div>

                                    <div className="bg-blue-500/10 border border-blue-500/20 p-1.5 sm:p-2.5 rounded-xl flex items-center justify-between min-w-0">
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-[9px] sm:text-[10px] text-blue-300/80 mb-0.5 font-bold">العدد بالبالة</span>
                                            <span className="font-bold text-blue-200 text-[10px] sm:text-xs truncate">{item.baleQuantity || 'غير محدد'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Lightbox */}
            {lightboxImages.length > 0 && (
                <div className="fixed inset-0 z-[99999] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4">
                    <button 
                        onClick={() => { setLightboxImages([]); setLightboxIndex(0); }}
                        className="absolute top-6 right-6 text-white/50 hover:text-white bg-white/10 p-2 rounded-full transition"
                    >
                        <X size={24} />
                    </button>
                    
                    <button 
                        onClick={() => downloadOriginalImage(lightboxImages[lightboxIndex], "product_image")}
                        className="absolute top-6 left-6 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition shadow-lg"
                    >
                        <Download size={18} /> تحميل بجودة أصلية
                    </button>

                    {lightboxImages.length > 1 && (
                        <button 
                            onClick={() => setLightboxIndex(i => (i - 1 + lightboxImages.length) % lightboxImages.length)}
                            className="absolute left-6 top-1/2 -translate-y-1/2 text-white hover:text-blue-400 bg-white/10 hover:bg-white/20 p-4 rounded-full transition"
                        >
                            <ChevronLeft size={32} />
                        </button>
                    )}

                    <CachedImage 
                        src={lightboxImages[lightboxIndex]} 
                        alt="صورة مكبرة" 
                        className="max-w-full max-h-[80vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300"
                    />

                    {lightboxImages.length > 1 && (
                        <button 
                            onClick={() => setLightboxIndex(i => (i + 1) % lightboxImages.length)}
                            className="absolute right-6 top-1/2 -translate-y-1/2 text-white hover:text-blue-400 bg-white/10 hover:bg-white/20 p-4 rounded-full transition"
                        >
                            <ChevronRight size={32} />
                        </button>
                    )}

                    {lightboxImages.length > 1 && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
                            {lightboxImages.map((_, idx) => (
                                <div key={idx} className={`w-3 h-3 rounded-full ${idx === lightboxIndex ? 'bg-blue-500' : 'bg-white/30'}`} />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Add Modal */}
            {showAddModal && user?.role === 'admin' && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
                    <div className="w-full max-w-lg bg-gray-900 border border-white/20 rounded-3xl p-6 shadow-2xl animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-white flex items-center gap-2">
                                <Plus className="text-blue-500" />
                                {editingItemId ? 'تعديل بيانات الصنف' : 'إضافة صنف جديد للسجل'}
                            </h2>
                            <button onClick={() => setShowAddModal(false)} className="text-white/50 hover:text-white transition"><X size={24}/></button>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-white/60 mb-2">الصنف (سوفت روز)</label>
                                <select 
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold outline-none focus:border-blue-500"
                                    value={selectedProductId}
                                    onChange={(e) => setSelectedProductId(e.target.value)}
                                >
                                    <option value="">-- اختر الصنف --</option>
                                    {categories.map(cat => (
                                        <optgroup key={cat} label={cat}>
                                            {products.filter(p => p.category === cat).map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </optgroup>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-white/60 mb-2">كود الصنف (الباركود)</label>
                                <input 
                                    type="text" 
                                    placeholder="أدخل كود الصنف هنا..."
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-mono tracking-wider outline-none focus:border-blue-500"
                                    value={barcode}
                                    onChange={(e) => setBarcode(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-white/60 mb-2">العدد في البالة</label>
                                <input 
                                    type="text" 
                                    placeholder="مثال: 12 * 6 ، 48 حبة..."
                                    className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white font-bold outline-none focus:border-blue-500"
                                    value={baleQuantity}
                                    onChange={(e) => setBaleQuantity(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-white/60 mb-2">صور الصنف (الحد الأقصى 4 صور)</label>
                                {imageEntries.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                        {imageEntries.map(entry => (
                                            <div key={entry.id} className={`relative border-2 rounded-xl p-2 flex flex-col items-center justify-center ${primaryImageId === entry.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/20 bg-black/20'}`}>
                                                <CachedImage src={entry.preview} alt="preview" className="w-full h-20 object-cover rounded-lg mb-2" />
                                                <div className="flex w-full justify-between items-center px-1">
                                                    <button 
                                                        type="button" 
                                                        onClick={() => setPrimaryImageId(entry.id)} 
                                                        className={`text-[10px] p-1 rounded ${primaryImageId === entry.id ? 'text-blue-400 font-bold' : 'text-white/50 hover:text-white'}`}
                                                    >
                                                        {primaryImageId === entry.id ? 'الرئيسية ✓' : 'تعيين كرئيسية'}
                                                    </button>
                                                    <button 
                                                        type="button" 
                                                        onClick={() => {
                                                            const newEntries = imageEntries.filter(e => e.id !== entry.id);
                                                            setImageEntries(newEntries);
                                                            if (primaryImageId === entry.id) {
                                                                setPrimaryImageId(newEntries.length > 0 ? newEntries[0].id : '');
                                                            }
                                                        }} 
                                                        className="text-red-400 hover:text-red-300 p-1"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {imageEntries.length < 4 && (
                                    <div className="bg-black/40 rounded-xl border border-white/10 p-4">
                                        <div className="flex bg-black/40 rounded-xl border border-white/10 p-1 mb-3">
                                            <button 
                                                className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition ${imageType === 'upload' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'}`}
                                                onClick={() => setImageType('upload')}
                                            >
                                                <Upload size={16} /> رفع من الجهاز
                                            </button>
                                            <button 
                                                className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition ${imageType === 'url' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/80'}`}
                                                onClick={() => setImageType('url')}
                                            >
                                                <LinkIcon size={16} /> رابط
                                            </button>
                                        </div>

                                        {imageType === 'url' ? (
                                            <div className="flex gap-2">
                                                <input 
                                                    type="url" 
                                                    placeholder="https://example.com/image.jpg"
                                                    className="flex-1 bg-black/40 border border-white/10 rounded-xl p-3 text-white outline-none focus:border-blue-500"
                                                    value={tempUrl}
                                                    onChange={(e) => setTempUrl(e.target.value)}
                                                    dir="ltr"
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={() => {
                                                        if (!tempUrl.trim()) return;
                                                        const newId = `img_${Date.now()}`;
                                                        const newEntry: ImageEntry = { id: newId, isExisting: false, url: tempUrl, file: null, preview: tempUrl };
                                                        const newEntries = [...imageEntries, newEntry];
                                                        setImageEntries(newEntries);
                                                        if (!primaryImageId) setPrimaryImageId(newId);
                                                        setTempUrl('');
                                                    }}
                                                    className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-xl font-bold transition"
                                                >
                                                    إضافة
                                                </button>
                                            </div>
                                        ) : (
                                            <div 
                                                className="w-full border-2 border-dashed border-white/20 rounded-xl p-4 flex flex-col items-center justify-center text-center cursor-pointer hover:border-blue-500/50 hover:bg-blue-500/5 transition bg-black/20"
                                                onClick={() => fileInputRef.current?.click()}
                                            >
                                                <input 
                                                    type="file" 
                                                    ref={fileInputRef} 
                                                    className="hidden" 
                                                    accept="image/*"
                                                    onChange={(e) => {
                                                        if (e.target.files && e.target.files[0]) {
                                                            const file = e.target.files[0];
                                                            const newId = `img_${Date.now()}`;
                                                            const newEntry: ImageEntry = { id: newId, isExisting: false, url: '', file, preview: URL.createObjectURL(file) };
                                                            const newEntries = [...imageEntries, newEntry];
                                                            setImageEntries(newEntries);
                                                            if (!primaryImageId) setPrimaryImageId(newId);
                                                        }
                                                        // Reset file input so same file can be selected again
                                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                                    }}
                                                />
                                                <Upload size={24} className="text-white/40 mb-2" />
                                                <p className="text-sm font-bold text-white mb-1">انقر لاختيار صورة</p>
                                                <p className="text-[10px] text-white/40">يمكنك إضافة {4 - imageEntries.length} صور أخرى</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={handleSave} 
                                disabled={isSaving}
                                className="w-full mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl shadow-xl transition flex items-center justify-center gap-2"
                            >
                                {isSaving ? 'جاري الحفظ والرفع...' : <><Save size={20} /> {editingItemId ? 'حفظ التعديلات' : 'حفظ البيانات'}</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {toastMessage && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 border border-white/20 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-3 z-[99999] animate-in slide-in-from-bottom-5">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Check size={16} />
                    </div>
                    <span className="font-bold text-sm">{toastMessage}</span>
                </div>
            )}
        </div>
    );
};

export default ProductsRegistry;
