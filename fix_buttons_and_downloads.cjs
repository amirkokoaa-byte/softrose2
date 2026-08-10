const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

// Replace handleDownloadImage
const oldHandleDownloadImage = `    const handleDownloadImage = async (asShare = false) => {
        let element = document.getElementById('current-targets-print-area');
        if (!element || element.offsetParent === null) {
            element = document.getElementById('hidden-print-area');
        }
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
                    const file = new File([blob], 'targets.png', { type: 'image/png' });
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
                    link.download = \`targets-\${new Date().toISOString().split('T')[0]}.png\`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                }
            }, 'image/png', 1.0);
        } catch (err) {
            console.error("Failed to capture image", err);
            alert("حدث خطأ أثناء تحميل الصورة");
        }
    };`;

const newHandleDownloadImage = `    const handleDownloadImage = async (isLowQuality = false) => {
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
                    link.download = \`targets-\${new Date().toISOString().split('T')[0]}.png\`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                }
            }, 'image/png', isLowQuality ? 0.8 : 1.0);
        } catch (err) {
            console.error("Failed to capture image", err);
            alert("حدث خطأ أثناء تحميل الصورة");
        }
    };`;

content = content.replace(oldHandleDownloadImage, newHandleDownloadImage);

// Replace handleShareSales
const oldHandleShareSales = `    const handleShareSales = async (asPdf: boolean) => {
        let element = document.getElementById('selected-sales-print-area');
        if (!element) return;
        try {
            const canvas = await html2canvas(element, {
                backgroundColor: '#111827',
                scale: 8000 / 1000, // 8K resolution assuming 1000px container width
                width: 1000
            });
            const dataUrl = canvas.toDataURL('image/png', 1.0);
            
            // if we need pdf we could use jspdf, but they asked for 8K image exported.
            // "يتم التقاط صورة للعناصر المحددة وإرسالها أو تصديرها كصورة فائقة الجودة"
            // So we'll just download the image for both cases, or use Share API for Share.
            if (!asPdf && navigator.share) {
                const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 1.0));
                if (blob) {
                    const file = new File([blob], 'sales.png', { type: 'image/png' });
                    if (navigator.canShare && navigator.canShare({ files: [file] })) {
                        await navigator.share({ files: [file], title: 'مبيعات' });
                        return;
                    }
                }
            }
            canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = \`sales_export_\${new Date().getTime()}.png\`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                }
            }, 'image/png', 1.0);
        } catch (err) {
            console.error("Failed to capture image", err);
            alert("حدث خطأ أثناء استخراج الصورة");
        }
    };`;

const newHandleShareSales = `    const handleShareSales = async (isHighQuality: boolean) => {
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
                    link.download = \`sales_export_\${new Date().getTime()}.png\`;
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                }
            }, 'image/png', isHighQuality ? 1.0 : 0.8);
        } catch (err) {
            console.error("Failed to capture image", err);
            alert("حدث خطأ أثناء استخراج الصورة");
        }
    };`;

content = content.replace(oldHandleShareSales, newHandleShareSales);

// Replace button for Sales Log
content = content.replace(
    `<button onClick={() => handleShareSales(false)} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition text-xs shadow-xl"><Share2 size={14}/> مشاركة WhatsApp</button>`,
    `<button onClick={() => handleShareSales(false)} className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition text-xs shadow-xl"><Download size={14}/> تحميل للهاتف</button>`
);

// Replace button for Targets Log
content = content.replace(
    `                                <button 
                                    onClick={() => handleDownloadImage(true)}
                                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition h-[40px]"
                                    title="مشاركة WhatsApp"
                                >
                                    <Share2 size={14}/> WhatsApp
                                </button>`,
    `                                <button 
                                    onClick={() => handleDownloadImage(true)}
                                    className="bg-green-600 hover:bg-green-500 text-white px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition h-[40px]"
                                    title="تحميل بجودة للهاتف"
                                >
                                    <Download size={14}/> للهاتف
                                </button>`
);

fs.writeFileSync('components/SalesLog.tsx', content);
