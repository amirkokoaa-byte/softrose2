const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

const captureLogic = `
    const handleDownloadImage = async (asShare = false) => {
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
            const link = document.createElement('a');
            link.download = \`targets-\${new Date().toISOString().split('T')[0]}.png\`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error("Failed to capture image", err);
            alert("حدث خطأ أثناء تحميل الصورة");
        }
    };
`;

content = content.replace(/const handleDownloadImage = async \(\) => \{[\s\S]*?catch \(err\) \{[\s\S]*?alert\("حدث خطأ أثناء تحميل الصورة"\);\s*\}\s*\};/, captureLogic.trim());

// Also replace handleDownloadPastMonthImage
const pastCaptureLogic = `
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
            const link = document.createElement('a');
            link.download = \`targets-\${mKey}.png\`;
            link.href = dataUrl;
            link.click();
        } catch (err) {
            console.error("Failed to capture image", err);
            alert("حدث خطأ أثناء تحميل الصورة");
        }
    };
`;
// Let's check if handleDownloadPastMonthImage exists
if (content.includes('const handleDownloadPastMonthImage')) {
    content = content.replace(/const handleDownloadPastMonthImage = async \(mKey: string\) => \{[\s\S]*?catch \(err\) \{[\s\S]*?alert\("حدث خطأ أثناء تحميل الصورة"\);\s*\}\s*\};/, pastCaptureLogic.trim());
} else {
    // Inject it if it doesn't exist? Wait, it is called in renderPastMonthTargetsList.
    content = content.replace(/const findExactEmployeeNames = \(\) => \{/, pastCaptureLogic.trim() + '\n\n    const findExactEmployeeNames = () => {');
}


fs.writeFileSync('components/SalesLog.tsx', content);
