const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

// Replace all occurrences of the download logic
const oldDownloadPattern = /const link = document\.createElement\('a'\);\s*link\.download = (.*?);\s*link\.href = dataUrl;\s*link\.click\(\);/g;

content = content.replace(oldDownloadPattern, (match, downloadName) => {
    return `canvas.toBlob((blob) => {
                if (blob) {
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.download = ${downloadName};
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 100);
                }
            }, 'image/png', 1.0);`;
});

fs.writeFileSync('components/SalesLog.tsx', content);
