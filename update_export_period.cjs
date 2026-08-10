const fs = require('fs');
let content = fs.readFileSync('components/SalesLog.tsx', 'utf8');

const oldHandleExportPeriod = `    const handleExportPeriod = () => {
        if (!exportStart || !exportEnd) return alert("اختر الفترة الزمنية");
        const startTS = new Date(exportStart).getTime();
        const endTS = new Date(exportEnd).getTime() + 86400000;
        const periodSales = sales.filter(s => s.timestamp >= startTS && s.timestamp <= endTS && (!exportMarket || s.market === exportMarket) && (!exportEmployee || s.employeeName === exportEmployee || s.username === exportEmployee));
        
        if (periodSales.length === 0) return alert("لا توجد مبيعات");

        const itemsGrouped: Record<string, { price: number, qty: number, total: number }> = {};
        let grandTotalQty = 0;
        let grandTotalValue = 0;

        periodSales.forEach(s => {
            (s.items || []).forEach(i => {
                const nName = normalizeName(i.name);
                if (/[a-zA-Z]/.test(nName)) return;
                if (!itemsGrouped[nName]) {
                    itemsGrouped[nName] = { price: i.price, qty: 0, total: 0 };
                }
                itemsGrouped[nName].qty += i.qty;
                itemsGrouped[nName].total += (i.qty * i.price);
                itemsGrouped[nName].price = i.price; // Keep latest price or maybe not needed if it's constant
                grandTotalQty += i.qty;
                grandTotalValue += (i.qty * i.price);
            });
        });

        const exportData: any[] = Object.entries(itemsGrouped).map(([name, stats]) => ({
            "الصنف": name,
            "سعر القطعة": stats.price,
            "عدد القطع المباعة": stats.qty,
            "الإجمالي": stats.total
        }));

        exportData.push({
            "الصنف": "الإجمالي العام",
            "سعر القطعة": "",
            "عدد القطع المباعة": grandTotalQty,
            "الإجمالي": grandTotalValue
        });

        exportToCSV(exportData, \`Sales_Report_\${exportStart}_to_\${exportEnd}\`);
        setShowExportModal(false);
    };`;

const newHandleExportPeriod = `    const handleExportPeriod = () => {
        if (!exportStart || !exportEnd) return alert("اختر الفترة الزمنية");
        const startTS = new Date(exportStart).getTime();
        const endTS = new Date(exportEnd).getTime() + 86400000;
        const periodSales = sales.filter(s => s.timestamp >= startTS && s.timestamp <= endTS && (!exportMarket || s.market === exportMarket) && (!exportEmployee || s.employeeName === exportEmployee || s.username === exportEmployee));
        
        if (periodSales.length === 0) return alert("لا توجد مبيعات");

        let grandTotalValue = 0;
        const exportData: any[] = periodSales.map(s => {
            grandTotalValue += s.total;
            return {
                "اسم الموظف": s.employeeName || s.username || "System",
                "التاريخ": s.date,
                "اسم الماركت": s.market,
                "إجمالي المبيعات": s.total
            };
        });

        exportData.push({
            "اسم الموظف": "الإجمالي العام",
            "التاريخ": "",
            "اسم الماركت": "",
            "إجمالي المبيعات": grandTotalValue
        });

        exportToCSV(exportData, \`Sales_Report_\${exportStart}_to_\${exportEnd}\`);
        setShowExportModal(false);
    };`;

content = content.replace(oldHandleExportPeriod, newHandleExportPeriod);
fs.writeFileSync('components/SalesLog.tsx', content);
