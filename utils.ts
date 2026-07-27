export const exportToCSV = (data: any[], filename: string) => {
    if (!data || !data.length) return;
    
    // Simple Flattening for the specific structures
    const csvRows = [];
    const headers = Object.keys(data[0]);
    csvRows.push(headers.join(','));

    for (const row of data) {
        const values = headers.map(header => {
            const escaped = ('' + row[header]).replace(/"/g, '\\"');
            return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
    }

    const csvContent = "\uFEFF" + csvRows.join('\n'); // BOM for Excel Arabic support
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

export const exportToExcel = (sheets: {name: string, data: any[], isAoa?: boolean}[], filename: string) => {
    import('xlsx').then(XLSX => {
        const wb = XLSX.utils.book_new();
        sheets.forEach(sheet => {
            let ws;
            if (sheet.isAoa) {
                ws = XLSX.utils.aoa_to_sheet(sheet.data);
            } else {
                ws = XLSX.utils.json_to_sheet(sheet.data);
            }
            // Add right-to-left
            if (!ws['!views']) {
                ws['!views'] = [{ rightToLeft: true }];
            }
            XLSX.utils.book_append_sheet(wb, ws, sheet.name);
        });
        XLSX.writeFile(wb, `${filename}.xlsx`);
    });
};

export const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('ar-EG');
};