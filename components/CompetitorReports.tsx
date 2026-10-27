import { onCachedValue } from "../firebaseCache";

import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase';
import { ref, onValue, remove, update, push } from "firebase/database";
import { User, CompetitorPrice } from '../types';
import { exportToCSV, exportToExcel } from '../utils';
import { COMPANIES, FINE_FACIAL, FINE_KITCHEN, FINE_TOILET, ZEINA_FACIAL, ZEINA_KITCHEN, ZEINA_TOILET, PAPIA_FACIAL, PAPIA_KITCHEN, PAPIA_TOILET, WHITE_FACIAL, WHITE_KITCHEN, WHITE_TOILET } from '../constants';
import { Trash2, Edit, Save, X, FileSpreadsheet, User as UserIcon, Calendar, Building, Scale, Search, Filter, Plus, Receipt, Printer, Clock } from 'lucide-react';

interface Props {
    user: User;
    markets: string[];
    theme: string;
    products?: any[];
}

const CompetitorReports: React.FC<Props> = ({ user, markets, theme, products = [] }) => {
    const [data, setData] = useState<CompetitorPrice[]>([]);
    const [competitorProductsDB, setCompetitorProductsDB] = useState<any>({});
    const [selectedMarket, setSelectedMarket] = useState('');
    const [selectedCompany, setSelectedCompany] = useState('');
    const [editingReport, setEditingReport] = useState<CompetitorPrice | null>(null);
    const [customCompanies, setCustomCompanies] = useState<string[]>([]);
    
    // Price Comparison State
    const [showComparisonModal, setShowComparisonModal] = useState(false);
    const [showComparisonDataModal, setShowComparisonDataModal] = useState(false);
    const [compMarket, setCompMarket] = useState('all');
    const [compCompany, setCompCompany] = useState(COMPANIES[0]);
    const [compProduct, setCompProduct] = useState('all');

    // أسعار من المبيعات
    const [salesList, setSalesList] = useState<any[]>([]);
    const [showSalesPricesModal, setShowSalesPricesModal] = useState(false);
    const [salesPriceBranch, setSalesPriceBranch] = useState('');
    const [salesPricePeriod, setSalesPricePeriod] = useState('week');

    useEffect(() => {
        const unsubProducts = onCachedValue(ref(db, 'settings/competitor_products'), 'settings_competitor_products', snap => {
            if (snap.exists()) setCompetitorProductsDB(snap.val());
            else setCompetitorProductsDB({});
        });
        const unsub = onCachedValue(ref(db, 'settings/companies'), 'settings_companies', snapshot => {
            if (snapshot.exists()) {
                const companies = Object.values(snapshot.val()).map((c: any) => {
                    if (typeof c === 'string') return c;
                    if (c && typeof c === 'object') {
                        let extractedName = c.name;
                        if (typeof extractedName === 'object' && extractedName !== null) {
                            extractedName = extractedName.name || String(extractedName);
                        }
                        return extractedName;
                    }
                    return String(c);
                }).filter(n => typeof n === 'string' && n !== '[object Object]');
                setCustomCompanies(companies);
            } else {
                setCustomCompanies([]);
            }
        });
        return () => { unsub(); unsubProducts(); };
    }, []);

    const allCompanies = Array.from(new Set([...COMPANIES, ...customCompanies]));

    useEffect(() => {
        const unsub = onCachedValue(ref(db, 'competitor_prices'), 'competitor_prices', s => {
            if(s.exists()) {
                let arr = Object.keys(s.val()).map(key => ({
                    id: key,
                    ...s.val()[key]
                })) as CompetitorPrice[];
                
                if (user.role !== 'admin') {
                    arr = arr.filter(d => markets.includes(d.market));
                }
                
                setData([...arr].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
            } else {
                setData([]);
            }
        });
    }, [user, markets]);

    // الاستماع إلى مبيعات سجل المبيعات
    useEffect(() => {
        const unsubSales = onCachedValue(ref(db, 'sales'), 'sales', s => {
            if (s.exists()) {
                const val = s.val();
                const arr = Object.keys(val).map(key => ({
                    id: key,
                    ...val[key]
                }));
                setSalesList(arr);
            } else {
                setSalesList([]);
            }
        });
        return () => { unsubSales(); };
    }, []);

    // خريطة أحدث أسعار مبيعات منتجات سوفت روز لكل ماركت من سجل المبيعات
    const latestSoftRoseSalesByMarket = useMemo(() => {
        const map: Record<string, Record<string, { price: number; date: string; timestamp: number }>> = {};
        const sortedSales = [...salesList].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        sortedSales.forEach(s => {
            if (!s.market || typeof s.market !== 'string') return;
            const m = s.market.trim();
            if (!map[m]) map[m] = {};
            (s.items || []).forEach((item: any) => {
                const name = (item.name || '').trim();
                if (!name || /[a-zA-Z]/.test(name)) return;
                if (!map[m][name] && Number(item.price) > 0) {
                    map[m][name] = {
                        price: Number(item.price),
                        date: s.date || (s.timestamp ? new Date(s.timestamp).toLocaleDateString('ar-EG') : ''),
                        timestamp: s.timestamp || 0
                    };
                }
            });
        });
        return map;
    }, [salesList]);

    // في تقارير أسعار المنافسين: في حالة تسجيل موظف سعر غير متوافق مع المسجل في سجل المبيعات يتم تغييره أوتوماتيكياً
    // وفي حالة عدم وجود منتج في شركة سوفت روز في تقارير أسعار المنافسين يتم تحديثه لحظياً وإضافته
    useEffect(() => {
        if (data.length === 0 || Object.keys(latestSoftRoseSalesByMarket).length === 0) return;
        if (user.role !== 'admin') return;

        data.forEach(report => {
            if (report.company === 'Soft Rose' && report.market && latestSoftRoseSalesByMarket[report.market.trim()]) {
                const marketSales = latestSoftRoseSalesByMarket[report.market.trim()];
                let needsUpdate = false;
                const updatedItems = (report.items || []).map(item => {
                    const salesInfo = marketSales[item.name.trim()];
                    if (salesInfo && salesInfo.price > 0 && item.price !== salesInfo.price) {
                        needsUpdate = true;
                        return { ...item, price: salesInfo.price };
                    }
                    return item;
                });

                // إضافة أي منتج مسجل في المبيعات وغير مسجل في تقرير سوفت روز لهذا الماركت
                Object.entries(marketSales).forEach(([prodName, prodInfo]) => {
                    if (!updatedItems.some(i => i.name.trim() === prodName)) {
                        needsUpdate = true;
                        updatedItems.push({
                            name: prodName,
                            price: prodInfo.price,
                            category: 'Facial'
                        } as any);
                    }
                });

                if (needsUpdate && report.id) {
                    update(ref(db, `competitor_prices/${report.id}`), { items: updatedItems });
                }
            }
        });
    }, [data, latestSoftRoseSalesByMarket, user.role]);

    // في كل أسبوع يوم السبت: يظهر لحظياً في تقارير أسعار المنافسين تسجيل من حساب admin اسم الماركت وآخر أسعار تم تسجيلها في سجل المبيعات لشركة سوفت روز
    useEffect(() => {
        if (user.role !== 'admin' || Object.keys(latestSoftRoseSalesByMarket).length === 0) return;
        const today = new Date();
        const isSaturday = today.getDay() === 6;
        if (!isSaturday) return;

        const todayStr = today.toLocaleDateString('ar-EG');
        Object.entries(latestSoftRoseSalesByMarket).forEach(([marketName, productsMap]) => {
            const existing = data.find(d => 
                d.company === 'Soft Rose' && 
                d.market === marketName && 
                d.date === todayStr &&
                (d.employeeName === 'Admin' || d.employeeName === user.name)
            );
            if (!existing) {
                const items = Object.entries(productsMap).map(([pName, pInfo]) => ({
                    name: pName,
                    price: pInfo.price,
                    category: 'General'
                }));
                if (items.length > 0) {
                    push(ref(db, 'competitor_prices'), {
                        market: marketName,
                        company: 'Soft Rose',
                        date: todayStr,
                        timestamp: Date.now(),
                        employeeName: 'Admin',
                        items: items
                    });
                }
            }
        });
    }, [latestSoftRoseSalesByMarket, data, user]);

    const filtered = data.filter(d => 
        (!selectedMarket || d.market === selectedMarket) &&
        (!selectedCompany || d.company === selectedCompany)
    ).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // منطق مقارنة الأسعار: استخراج أحدث سعر لكل منتج في كل ماركت
    const comparisonResults = useMemo(() => {
        const results: { market: string; product: string; price: number; date: string; timestamp: number }[] = [];
        
        // ترتيب البيانات من الأحدث للأقدم لمعالجة أحدث سعر أولاً مع ضمان وجود التايم ستامب
        const sortedData = [...data].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        sortedData.forEach(record => {
            if (record.company === compCompany) {
                if (compMarket === 'all' || record.market === compMarket) {
                    record.items.forEach(item => {
                        // إخفاء منتجات Soft Rose الإنجليزية من نتائج المقارنة الشاملة
                        if (compCompany === 'Soft Rose' && /[a-zA-Z]/.test(item.name)) return;
                        if (compProduct === 'all' || item.name === compProduct) {
                            const key = `${record.market}_${item.name}`;
                            // إذا لم يتم تسجيل أحدث سعر لهذا المنتج في هذا الماركت بعد
                            if (!results.find(r => r.market === record.market && r.product === item.name)) {
                                results.push({
                                    market: record.market,
                                    product: item.name,
                                    price: item.price,
                                    date: record.date,
                                    timestamp: record.timestamp
                                });
                            }
                        }
                    });
                }
            }
        });

        // Sort the final results by timestamp (newest first) instead of alphabetically
        return results.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    }, [data, compCompany, compMarket, compProduct]);

    // قائمة المنتجات المتاحة للشركة المختارة في المقارنة
    const availableProducts = useMemo(() => {
        const set = new Set<string>();
        data.filter(d => d.company === compCompany).forEach(d => d.items.forEach(i => set.add(i.name)));
        return Array.from(set).sort();
    }, [data, compCompany]);

    const groupedAvailableProducts = useMemo(() => {
        const groups: Record<string, string[]> = {
            'Facial': [],
            'Kitchen': [],
            'Toilet': [],
            'Dolphin': [],
            'Uncategorized': []
        };
        
        availableProducts.forEach(itemName => {
            // إخفاء منتجات Soft Rose باللغة الإنجليزية من القوائم ومحركات البحث الداخلية
            if (compCompany === 'Soft Rose' && /[a-zA-Z]/.test(itemName)) return;
            let cat = 'Uncategorized';
            // Find category from data
            for (const d of data) {
                if (d.company === compCompany) {
                    const item = d.items.find(i => i.name === itemName);
                    if (item && item.category) {
                        cat = item.category;
                        break;
                    }
                }
            }
            
            // If soft rose, check products
            if (compCompany === 'Soft Rose' && products) {
                const prod = products.find(p => p.name === itemName);
                if (prod && prod.category) {
                    cat = prod.category;
                }
            }
            
            if (groups[cat]) {
                groups[cat].push(itemName);
            } else {
                if (!groups['Uncategorized']) groups['Uncategorized'] = [];
                groups['Uncategorized'].push(itemName);
            }
        });
        
        return groups;
    }, [availableProducts, data, compCompany, products]);

    const categoryLabels: Record<string, string> = {
        'Facial': 'مناديل السحب (Facial)',
        'Kitchen': 'مناديل المطبخ (Kitchen)',
        'Toilet': 'تواليت (Toilet)',
        'Dolphin': 'دولفن (Dolphin)',
        'Uncategorized': 'أصناف أخرى'
    };

        const handleExport = () => {
            // 1. All Historical Prices (Sheet 3)
            const allPricesData = filtered.flatMap(d => (d.items || []).map(i => ({
                "التاريخ": d.date,
                "اليوم": new Date(d.timestamp).toLocaleDateString('ar-EG', { weekday: 'long' }),
                "اسم الفرع": d.market,
                "الموظف": d.employeeName || "غير معروف",
                "الشركة": d.company,
                "الصنف": i.name,
                "الفئة": i.category,
                "السعر": i.price
            })));
    
            // 2. Maps for Latest & Old Prices
            const latestPricesMap = new Map();
            const oldPricesMap = new Map();
            const sortedData = [...filtered].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
            
            sortedData.forEach(record => {
                (record.items || []).forEach(item => {
                    const key = `${record.company}_${item.name}`;
                    if (!latestPricesMap.has(key)) {
                        latestPricesMap.set(key, { ...item, date: record.date });
                    } else if (!oldPricesMap.has(key)) {
                        oldPricesMap.set(key, { ...item, date: record.date });
                    }
                });
            });
    
            const getCompanyProducts = (company: string) => {
                if (company === 'Soft Rose') {
                    return (products || []).filter(p => !/[a-zA-Z]/.test(p.name));
                }
                if (competitorProductsDB[company]) {
                    return Object.values(competitorProductsDB[company]).map((p: any) => ({ name: p.name, category: p.category }));
                }
                const gen = (facial: string[], kitchen: string[], toilet: string[]) => [
                    ...facial.map(n => ({ category: 'Facial', name: n })),
                    ...kitchen.map(n => ({ category: 'Kitchen', name: n })),
                    ...toilet.map(n => ({ category: 'Toilet', name: n }))
                ];
                switch(company) {
                    case 'Fine': return gen(FINE_FACIAL, FINE_KITCHEN, FINE_TOILET);
                    case 'Zeina': return gen(ZEINA_FACIAL, ZEINA_KITCHEN, ZEINA_TOILET);
                    case 'Papia Familia': return gen(PAPIA_FACIAL, PAPIA_KITCHEN, PAPIA_TOILET);
                    case 'White': return gen(WHITE_FACIAL, WHITE_KITCHEN, WHITE_TOILET);
                    default: return [];
                }
            };
    
            const generateSheetAOA = (pricesMap: Map<string, any>, title: string, fillWithHistoricalIfMissing: boolean = false) => {
                const aoa: any[][] = [];
                const companiesOrder = ['Soft Rose', 'Fine', 'Zeina', 'Papia Familia', 'White', 'Classy'];
                const customAdded = (allCompanies || []).filter(c => !companiesOrder.includes(c));
                companiesOrder.push(...customAdded);
                
                aoa.push([title]);
                
                const compNameRow: any[] = [];
                companiesOrder.forEach(c => {
                    compNameRow.push(c, "");
                });
                aoa.push(compNameRow);
                
                const headersRow: any[] = [];
                companiesOrder.forEach(() => {
                    headersRow.push("الصنف", "السعر");
                });
                aoa.push(headersRow);
                
                const categories = [
                    { key: 'Facial', label: 'Facial' },
                    { key: 'Kitchen', label: 'مناديل مطبخ (Kitchen)' },
                    { key: 'Toilet', label: 'تواليت (Toilet)' },
                    { key: 'Dolphin', label: 'دولفن (Dolphin)' }
                ];
                
                categories.forEach(cat => {
                    const catHeaderRow: any[] = [];
                    companiesOrder.forEach(() => {
                        catHeaderRow.push(`--- ${cat.label} ---`, "");
                    });
                    aoa.push(catHeaderRow);
                    
                    const compItems: Record<string, any[]> = {};
                    let maxItems = 0;
                    companiesOrder.forEach(comp => {
                        const allItems = getCompanyProducts(comp).filter(p => p.category === cat.key);
                        compItems[comp] = allItems;
                        if (allItems.length > maxItems) maxItems = allItems.length;
                    });
                    
                    if (maxItems === 0) return; // Skip category if completely empty across all companies
                    
                    for (let i = 0; i < maxItems; i++) {
                        const row: any[] = [];
                        companiesOrder.forEach(comp => {
                            const item = compItems[comp][i];
                            if (item) {
                                let priceInfo = pricesMap.get(`${comp}_${item.name}`);
                                
                                // إذا لم يكن موجوداً وطلبنا البحث في التاريخ كله لتعويضه
                                if (!priceInfo && fillWithHistoricalIfMissing) {
                                    priceInfo = latestPricesMap.get(`${comp}_${item.name}`);
                                }

                                row.push(item.name, priceInfo ? priceInfo.price : "");
                            } else {
                                row.push("", "");
                            }
                        });
                        aoa.push(row);
                    }
                });
                return aoa;
            };
    
            const todayStr = new Date().toLocaleDateString('ar-EG');
            // استخدام true للـ Sheet الأحدث لتعويض الفراغات من أحدث سعر مسجل تاريخياً
            const sheet1Aoa = generateSheetAOA(latestPricesMap, `أحدث الأسعار - تاريخ: ${todayStr}`, true);
            const sheet2Aoa = generateSheetAOA(oldPricesMap, `أسعار قديمة (قبل التحديث الأخير)`, false);
    
            exportToExcel([
                { name: "أحدث الأسعار", data: sheet1Aoa, isAoa: true },
                { name: "أسعار قديمة", data: sheet2Aoa, isAoa: true },
                { name: "كل الأسعار (سجل)", data: allPricesData, isAoa: false }
            ], 'تقرير_المنافسين_التفصيلي');
        };

    const handleExportComparison = () => {
        const exportData = comparisonResults.map(r => ({
            "الماركت / الفرع": r.market,
            "المنتج": r.product,
            "أحدث سعر مسجل": r.price,
            "تاريخ التسجيل": r.date
        }));
        exportToCSV(exportData, `Price_Comparison_${compCompany}`);
    };

    const handleUpdate = async () => {
        if(!editingReport || !editingReport.id) return;
        const updatedReport = editingReport;
        setData(prev => prev.map(d => d.id === updatedReport.id ? updatedReport : d));
        setEditingReport(null);
        await update(ref(db, `competitor_prices/${updatedReport.id}`), { items: updatedReport.items });
        alert("تم التعديل بنجاح");
    };

    const updateEditingItem = (index: number, field: 'name' | 'price', value: any) => {
        if (!editingReport) return;
        const newItems = [...editingReport.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setEditingReport({ ...editingReport, items: newItems });
    };

    const handleInlineEdit = async (record: CompetitorPrice, itemIdx: number) => {
        const newPrice = prompt("أدخل السعر الجديد:", record.items[itemIdx].price.toString());
        if (newPrice !== null && !isNaN(Number(newPrice)) && Number(newPrice) > 0) {
            const newItems = [...record.items];
            newItems[itemIdx].price = Number(newPrice);
            setData(prev => prev.map(d => d.id === record.id ? { ...d, items: newItems } : d));
            await update(ref(db, `competitor_prices/${record.id}`), { items: newItems });
        }
    };

    const handleInlineDelete = async (record: CompetitorPrice, itemIdx: number) => {
        if (confirm("هل أنت متأكد من حذف هذا الصنف؟")) {
            const newItems = record.items.filter((_, i) => i !== itemIdx);
            if (newItems.length === 0) {
                setData(prev => prev.filter(d => d.id !== record.id));
                await remove(ref(db, `competitor_prices/${record.id}`));
            } else {
                setData(prev => prev.map(d => d.id === record.id ? { ...d, items: newItems } : d));
                await update(ref(db, `competitor_prices/${record.id}`), { items: newItems });
            }
        }
    };

    const handleAddMarket = async () => {
        const newMarket = prompt("أدخل اسم الماركت الجديد:");
        if (newMarket && newMarket.trim()) {
            await push(ref(db, 'settings/markets'), { name: newMarket.trim(), createdBy: 'system' });
            alert("تم إضافة الماركت بنجاح");
        }
    };

    const handleAddCompany = async () => {
        const newCompany = prompt("أدخل اسم الشركة الجديدة:");
        if (newCompany && newCompany.trim()) {
            await push(ref(db, 'settings/companies'), { name: newCompany.trim(), createdBy: 'system' });
            alert("تم إضافة الشركة بنجاح");
        }
    };

    // فروع مسجل لها مبيعات فقط
    const salesBranches = useMemo(() => {
        const branches = new Set<string>();
        salesList.forEach(s => {
            if (s.market && typeof s.market === 'string' && s.market.trim()) {
                branches.add(s.market.trim());
            }
        });
        return Array.from(branches).sort();
    }, [salesList]);

    const periodDaysMap: Record<string, number> = {
        'week': 7,
        'month': 30,
        '2months': 60,
        '3months': 90,
        '4months': 120,
        '5months': 150,
        '6months': 180,
    };

    const periodLabelsMap: Record<string, string> = {
        'week': 'أسبوع',
        'month': 'شهر',
        '2months': 'شهرين',
        '3months': '3 أشهر',
        '4months': '4 أشهر',
        '5months': '5 أشهر',
        '6months': '6 أشهر',
    };

    // نتائج أسعار من المبيعات مع عدم تكرار الصنف وعرض أحدث سعر وتاريخه
    const salesPricesResults = useMemo(() => {
        if (!salesPriceBranch) return [];
        const days = periodDaysMap[salesPricePeriod] || 7;
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);

        const relevantSales = salesList.filter(s => {
            if (!s.market || s.market.trim() !== salesPriceBranch.trim()) return false;
            const ts = s.timestamp || (s.date ? new Date(s.date).getTime() : 0);
            return ts >= cutoff;
        }).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

        const seen = new Set<string>();
        const results: { name: string; price: number; date: string; timestamp: number }[] = [];

        relevantSales.forEach(s => {
            (s.items || []).forEach((item: any) => {
                const name = (item.name || '').trim();
                if (!name || /[a-zA-Z]/.test(name)) return;
                if (!seen.has(name)) {
                    seen.add(name);
                    let displayDate = s.date || '';
                    if (!displayDate && s.timestamp) {
                        displayDate = new Date(s.timestamp).toLocaleDateString('ar-EG');
                    }
                    results.push({
                        name,
                        price: Number(item.price) || 0,
                        date: displayDate || '-',
                        timestamp: s.timestamp || 0
                    });
                }
            });
        });

        return results.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    }, [salesPriceBranch, salesPricePeriod, salesList]);

    const handleExportSalesPricesExcel = () => {
        if (salesPricesResults.length === 0) return alert("لا توجد أصناف مسجلة للتصدير");
        const rows = salesPricesResults.map(r => ({
            "اسم الصنف": r.name,
            "السعر (ج.م)": r.price,
            "التاريخ المسجل به": r.date,
            "الفرع / الماركت": salesPriceBranch,
            "الفترة": periodLabelsMap[salesPricePeriod] || salesPricePeriod
        }));
        exportToExcel([{ sheetName: "أسعار من المبيعات", data: rows }], `اسعار_من_المبيعات_${salesPriceBranch.replace(/\s+/g, '_')}_${salesPricePeriod}`);
    };

    const handlePrintSalesPricesPDF = () => {
        const printContent = document.getElementById('sales-prices-print-table');
        if (!printContent) {
            window.print();
            return;
        }
        const win = window.open('', '_blank');
        if (!win) {
            window.print();
            return;
        }
        win.document.write(`
            <!DOCTYPE html>
            <html dir="rtl" lang="ar">
            <head>
                <meta charset="utf-8"/>
                <title>أسعار من المبيعات - ${salesPriceBranch}</title>
                <style>
                    body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; direction: rtl; text-align: right; }
                    h2 { text-align: center; margin-bottom: 6px; }
                    .info { text-align: center; color: #555; margin-bottom: 20px; font-size: 14px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th, td { border: 1px solid #ccc; padding: 10px 14px; text-align: center; font-size: 13px; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                    .text-right { text-align: right; font-weight: bold; }
                </style>
            </head>
            <body>
                <h2>تقرير أسعار من المبيعات - ${salesPriceBranch}</h2>
                <div class="info">الفترة المستعلم عنها: ${periodLabelsMap[salesPricePeriod] || salesPricePeriod} | تاريخ الاستخراج: ${new Date().toLocaleDateString('ar-EG')}</div>
                ${printContent.innerHTML}
            </body>
            </html>
        `);
        win.document.close();
        win.focus();
        setTimeout(() => {
            win.print();
            win.close();
        }, 300);
    };

    const inputClass = "w-full p-2.5 rounded-xl bg-gray-700 text-white border border-white/10 text-base font-bold";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h2 className="text-2xl font-bold flex items-center gap-2 text-white">
                    <Building className="text-blue-500" /> تقارير أسعار المنافسين
                </h2>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {user.role === 'admin' && (
                        <button 
                            onClick={() => {
                                if (salesBranches.length > 0 && !salesPriceBranch) {
                                    setSalesPriceBranch(salesBranches[0]);
                                }
                                setShowSalesPricesModal(true);
                            }} 
                            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-3 sm:px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 font-bold shadow-lg transition active:scale-95 text-xs sm:text-sm cursor-pointer"
                        >
                            <Receipt size={17}/> أسعار من المبيعات
                        </button>
                    )}
                    <button 
                        onClick={() => setShowComparisonModal(true)} 
                        className="flex-1 sm:flex-none bg-indigo-600 hover:bg-indigo-700 text-white px-3 sm:px-4 py-2 rounded-xl flex items-center justify-center gap-1.5 font-bold shadow-lg transition active:scale-95 text-xs sm:text-sm cursor-pointer"
                    >
                        <Scale size={17}/> مقارنة الأسعار
                    </button>
                </div>
            </div>
            
            <div className="bg-gray-800 p-3.5 sm:p-5 rounded-2xl space-y-4 border border-white/10 shadow-xl">
                <div className="grid grid-cols-2 gap-2 sm:gap-4">
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-[10px] sm:text-xs font-bold opacity-60 text-white truncate">الماركت / الفرع</label>
                            {user.role === 'admin' && (
                                <button onClick={handleAddMarket} className="text-[9px] sm:text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 shrink-0">
                                    <Plus size={11}/> إضافة
                                </button>
                            )}
                        </div>
                        <select className={inputClass} value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}>
                            <option value="">كل الماركتات</option>
                            {markets.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="block text-[10px] sm:text-xs font-bold opacity-60 text-white truncate">الشركة المنافسة</label>
                            {user.role === 'admin' && (
                                <button onClick={handleAddCompany} className="text-[9px] sm:text-[10px] text-blue-400 hover:text-blue-300 flex items-center gap-0.5 shrink-0">
                                    <Plus size={11}/> إضافة
                                </button>
                            )}
                        </div>
                        <select className={inputClass} value={selectedCompany} onChange={e => setSelectedCompany(e.target.value)}>
                            <option value="">كل الشركات</option>
                            {allCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>
                </div>
                <button onClick={handleExport} className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg transition active:scale-95">
                    <FileSpreadsheet size={20} /> تصدير التقرير التفصيلي (أحدث المبيعات)
                </button>
            </div>

            <div className="space-y-4">
                {filtered.map((record) => (
                    <div key={record.id} className="p-5 rounded-2xl border bg-gray-800 border-white/10 text-white shadow-lg">
                        <div className="flex justify-between items-start mb-4 border-b border-white/5 pb-3">
                            <div>
                                <h3 className="text-lg font-bold text-blue-400">{record.market}</h3>
                                <div className="flex flex-wrap gap-3 mt-1 text-[10px] opacity-70 text-white">
                                    <span className="flex items-center gap-1 font-bold"><Calendar size={12}/> {record.date}</span>
                                    <span className="flex items-center gap-1 font-bold"><UserIcon size={12}/> {record.employeeName}</span>
                                    <span className="font-black text-green-400">{record.company}</span>
                                </div>
                            </div>
                            <div className="flex gap-1">
                                {user.role === 'admin' && (
                                    <>
                                        <button onClick={() => setEditingReport(record)} className="p-2 text-indigo-400 hover:bg-indigo-500/20 rounded-lg transition"><Edit size={16}/></button>
                                        <button onClick={() => {
                                            if(confirm('هل أنت متأكد من حذف هذا التقرير؟')) {
                                                setData(prev => prev.filter(d => d.id !== record.id));
                                                remove(ref(db, `competitor_prices/${record.id!}`));
                                            }
                                        }} className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition"><Trash2 size={16}/></button>
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {(record.items || []).map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-2 px-3 bg-black/30 rounded-xl text-xs border border-white/5 group">
                                    <span className="opacity-80 truncate pr-2 font-bold text-white">{item.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-green-400">{item.price} ج.م</span>
                                        {user.role === 'admin' && (
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => handleInlineEdit(record, idx)} className="p-1 text-blue-400 hover:bg-blue-500/20 rounded-lg transition" title="تعديل السعر">
                                                    <Edit size={14}/>
                                                </button>
                                                <button onClick={() => handleInlineDelete(record, idx)} className="p-1 text-red-400 hover:bg-red-500/20 rounded-lg transition" title="حذف الصنف">
                                                    <Trash2 size={14}/>
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {/* مودال مقارنة الأسعار */}
            {showComparisonModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/90 flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="w-full max-w-4xl bg-gray-900 border border-white/20 rounded-3xl p-6 flex flex-col max-h-[95vh] shadow-2xl animate-in zoom-in-95 my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-xl text-white flex items-center gap-2"><Scale className="text-indigo-400"/> مقارنة أحدث الأسعار المسجلة</h3>
                            <button onClick={() => setShowComparisonModal(false)} className="text-white/50 hover:text-white"><X size={20}/></button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">الماركت</label>
                                <select className="w-full p-3 rounded-xl bg-[#808080] text-white border border-white/10 text-xs font-bold" value={compMarket} onChange={e => setCompMarket(e.target.value)}>
                                    <option value="all">كل الماركتات</option>
                                    {markets.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">الشركة</label>
                                <select className="w-full p-3 rounded-xl bg-[#808080] text-white border border-white/10 text-xs font-bold" value={compCompany} onChange={e => setCompCompany(e.target.value)}>
                                    {allCompanies.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black opacity-40 uppercase mb-1 text-white">المنتج</label>
                                <select className="w-full p-3 rounded-xl bg-[#808080] text-white border border-white/10 text-xs font-bold" value={compProduct} onChange={e => setCompProduct(e.target.value)}>
                                    <option value="all">كل المنتجات</option>
                                    {Object.entries(groupedAvailableProducts).map(([cat, items]) => {
                                        if (items.length === 0) return null;
                                        if (compCompany !== 'Soft Rose' && cat === 'Dolphin') {
                                            // Ensure dolphin only for soft rose? The user didn't explicitly restrict Dolphin to Soft Rose only, 
                                            // but said "وفي باقي الشركات تقسم ... السحب ، المطبخ ، تواليت". We will just render whatever categories exist.
                                        }
                                        const label = categoryLabels[cat] || cat;
                                        return (
                                            <optgroup key={cat} label={label}>
                                                {items.map(name => <option key={name} value={name}>{name}</option>)}
                                            </optgroup>
                                        );
                                    })}
                                </select>
                            </div>
                        </div>
                        <button onClick={() => setShowComparisonDataModal(true)} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition shadow-lg mt-4">اظهر البيانات</button>
                    </div>
                </div>
            )}
            
            {showComparisonDataModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/90 flex items-center justify-center p-2 sm:p-4 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="w-full max-w-4xl bg-gray-900 border border-white/20 rounded-3xl p-3 sm:p-6 flex flex-col max-h-[95vh] shadow-2xl animate-in zoom-in-95 my-auto overflow-hidden">
                        <div className="flex justify-between items-center mb-3 sm:mb-6 shrink-0">
                            <h3 className="font-bold text-base sm:text-xl text-white flex items-center gap-2"><Scale className="text-indigo-400 shrink-0"/> بيانات أحدث الأسعار</h3>
                            <button onClick={() => setShowComparisonDataModal(false)} className="text-white/50 hover:text-white p-1 rounded-lg"><X size={20}/></button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar border border-white/5 rounded-2xl bg-black/20 p-1 sm:p-2 w-full min-w-0">
                             <table className="w-full table-fixed text-[11px] sm:text-xs text-center border-collapse">
                                <thead className="bg-white/5 sticky top-0 z-10 backdrop-blur-sm">
                                    <tr className="text-white opacity-80">
                                        <th className="py-2.5 px-1 sm:px-1.5 text-right w-[28%] sm:w-[25%] font-bold">الفرع</th>
                                        <th className="py-2.5 px-1 sm:px-1.5 text-right w-[34%] sm:w-[35%] font-bold">المنتج</th>
                                        <th className="py-2.5 px-0.5 sm:px-1 text-center w-[18%] sm:w-[20%] font-bold">السعر</th>
                                        <th className="py-2.5 px-0.5 sm:px-1 text-center w-[20%] sm:w-[20%] font-bold">التاريخ</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {comparisonResults.length === 0 ? (
                                        <tr><td colSpan={4} className="py-10 opacity-30 italic text-white">لا توجد بيانات مطابقة للبحث</td></tr>
                                    ) : comparisonResults.map((r, i) => (
                                        <tr key={i} className="border-t border-white/5 hover:bg-white/5 transition-colors text-white">
                                            <td className="py-2.5 px-1 sm:px-1.5 text-right font-bold text-indigo-300 break-words leading-tight">{r.market}</td>
                                            <td className="py-2.5 px-1 sm:px-1.5 text-right font-semibold break-words leading-tight">{r.product}</td>
                                            <td className="py-2.5 px-0.5 sm:px-1 text-center font-black text-green-400 whitespace-nowrap">{(Number(r.price) || 0).toLocaleString()}</td>
                                            <td className="py-2.5 px-0.5 sm:px-1 text-center opacity-70 text-[10px] sm:text-xs whitespace-nowrap font-mono">{r.date}</td>
                                        </tr>
                                    ))}
                                </tbody>
                             </table>
                        </div>
                        {comparisonResults.length > 0 && (
                            <button 
                                onClick={handleExportComparison}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 sm:py-4 rounded-2xl shadow-xl transition active:scale-95 flex items-center justify-center gap-2 mt-3 sm:mt-4 text-xs sm:text-base shrink-0 cursor-pointer"
                            >
                                <FileSpreadsheet size={18}/> تصدير مقارنة الأسعار (أحدث سعر)
                            </button>
                        )}
    
                    </div>
                </div>
            )}

            {editingReport && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 flex items-center justify-center p-4 backdrop-blur-md overflow-y-auto my-auto">
                    <div className="w-full max-w-2xl bg-gray-900 border border-white/10 rounded-3xl p-6 flex flex-col max-h-[85vh] my-auto">
                        <div className="flex justify-between items-center mb-6 border-b border-white/10 pb-4">
                            <h3 className="font-bold text-xl text-blue-400 flex items-center gap-2"><Edit size={20}/> تعديل تقرير المنافس</h3>
                            <button onClick={() => setEditingReport(null)} className="p-2 hover:bg-white/10 rounded-full text-white"><X/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                            {editingReport.items.map((item, idx) => (
                                <div key={idx} className="bg-black/20 p-4 rounded-xl space-y-3 border border-white/5">
                                    <input 
                                        type="text" 
                                        className="w-full bg-gray-800 text-white p-2.5 rounded-lg border border-white/10 text-xs font-bold"
                                        value={item.name || ''}
                                        onChange={e => updateEditingItem(idx, 'name', e.target.value)}
                                        placeholder="اسم الصنف"
                                    />
                                    <div className="flex items-center gap-3">
                                        <label className="text-[10px] font-black opacity-40 uppercase text-white">السعر</label>
                                        <input 
                                            type="number" 
                                            value={item.price || ''} 
                                            onChange={e => updateEditingItem(idx, 'price', Number(e.target.value))} 
                                            className="flex-1 p-2.5 rounded-lg bg-gray-700 text-white text-center border border-white/10 text-xs font-black"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button onClick={handleUpdate} className="mt-6 w-full bg-blue-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2 active:scale-95 transition">
                            <Save size={20}/> حفظ بيانات التعديل
                        </button>
                    </div>
                </div>
            )}

            {showSalesPricesModal && (
                <div className="fixed top-0 left-0 w-full h-full z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
                    <div className="bg-gray-900 border border-white/20 w-full max-w-3xl rounded-3xl p-4 sm:p-6 shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[92vh] my-auto">
                        <div className="flex justify-between items-center mb-4 sm:mb-6 border-b border-white/10 pb-3">
                            <h3 className="font-bold text-lg sm:text-xl text-white flex items-center gap-2">
                                <Receipt className="text-emerald-400" size={22}/> أسعار من المبيعات
                            </h3>
                            <button onClick={() => setShowSalesPricesModal(false)} className="text-white/50 hover:text-white p-1 rounded-full"><X size={20}/></button>
                        </div>

                        {/* شاشة منسدلة بها أسامي الأفرع التي تم تسجيل مبيعات لها وخانة الفترة من */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                            <div>
                                <label className="block text-xs font-bold opacity-60 text-white mb-1">الفرع / الماركت (الفروع المسجل لها مبيعات)</label>
                                <select 
                                    className="w-full p-2.5 sm:p-3 rounded-xl bg-gray-800 text-white border border-white/10 text-xs sm:text-sm font-bold outline-none cursor-pointer" 
                                    value={salesPriceBranch} 
                                    onChange={e => setSalesPriceBranch(e.target.value)}
                                >
                                    {salesBranches.length === 0 ? (
                                        <option value="">لا توجد فروع مسجل لها مبيعات</option>
                                    ) : (
                                        salesBranches.map(b => <option key={b} value={b}>{b}</option>)
                                    )}
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold opacity-60 text-white mb-1">الفترة من</label>
                                <select 
                                    className="w-full p-2.5 sm:p-3 rounded-xl bg-gray-800 text-white border border-white/10 text-xs sm:text-sm font-bold outline-none cursor-pointer" 
                                    value={salesPricePeriod} 
                                    onChange={e => setSalesPricePeriod(e.target.value)}
                                >
                                    <option value="week">أسبوع</option>
                                    <option value="month">شهر</option>
                                    <option value="2months">شهرين</option>
                                    <option value="3months">3 أشهر</option>
                                    <option value="4months">4 أشهر</option>
                                    <option value="5months">5 أشهر</option>
                                    <option value="6months">6 أشهر</option>
                                </select>
                            </div>
                        </div>

                        {/* قائمة المنتجات والأسعار والتاريخ مع عدم تكرار الصنف */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar border border-white/10 rounded-2xl bg-black/30 p-2 sm:p-3 min-h-[200px]" id="sales-prices-print-table">
                            {salesPricesResults.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-center text-white/50">
                                    <Clock size={36} className="mb-2 opacity-40"/>
                                    <p className="text-sm font-bold">لا توجد أسعار مبيعات مسجلة لهذا الفرع في هذه الفترة.</p>
                                    <p className="text-xs text-white/40 mt-1">يمكنك اختيار فترة أطول (شهر، شهرين، حتى 6 أشهر) لإظهار الأصناف المسجلة قبل نفاذها.</p>
                                </div>
                            ) : (
                                <table className="w-full text-xs sm:text-sm text-center">
                                    <thead className="bg-white/5 text-white/60 sticky top-0 backdrop-blur-md">
                                        <tr>
                                            <th className="py-2.5 px-3 text-right">اسم الصنف</th>
                                            <th className="py-2.5 px-3">السعر المسجل</th>
                                            <th className="py-2.5 px-3">تاريخ التسجيل</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {salesPricesResults.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-white/5 transition">
                                                <td className="py-2.5 px-3 text-right font-bold text-white">{item.name}</td>
                                                <td className="py-2.5 px-3 font-black text-emerald-400">{item.price.toLocaleString()} ج.م</td>
                                                <td className="py-2.5 px-3 text-white/70 font-medium">{item.date}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>

                        {/* أزرار التصدير: إكسيل أو PDF */}
                        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 pt-3 border-t border-white/10">
                            <button 
                                onClick={handleExportSalesPricesExcel}
                                disabled={salesPricesResults.length === 0}
                                className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
                            >
                                <FileSpreadsheet size={18}/> تصدير إكسيل
                            </button>
                            <button 
                                onClick={handlePrintSalesPricesPDF}
                                disabled={salesPricesResults.length === 0}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-3 rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
                            >
                                <Printer size={18}/> تصدير PDF / طباعة
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CompetitorReports;
