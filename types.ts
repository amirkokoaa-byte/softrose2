
export interface ProductItem {
    id: string;
    name: string;
    price: number;
    qty: number;
    category: string;
    isCustom?: boolean;
}

export interface SaleRecord {
    id?: string;
    date: string;
    timestamp: number;
    market: string;
    employeeName: string;
    username?: string;
    items: ProductItem[];
    total: number;
}

export interface InventoryRecord {
    id?: string;
    date: string;
    timestamp: number;
    market: string;
    employeeName: string;
    items: { name: string; qty: number; category: string }[];
}

export interface CompetitorPrice {
    id?: string;
    market: string;
    company: string;
    date: string;
    timestamp: number;
    employeeName?: string;
    items: { category: string; name: string; price: number }[];
}

export interface UserPermissions {
    showSalesLog: boolean;
    showInventoryLog: boolean;
    showInventoryReg: boolean;
    showCompetitorReports: boolean;
    showDailySales: boolean;
    showCompetitorPrices: boolean;
}

export interface User {
    key?: string;
    username: string;
    role: 'admin' | 'user' | 'merchandiser' | 'supervisor' | string;
    name: string;
    code?: string;
    phone?: string;
    canViewAllSales?: boolean;
    password?: string;
    permissions?: UserPermissions;
}

export interface AppSettings {
    appName: string;
    tickerText: string;
    tickerEnabled: boolean;
    whatsappNumber: string;
    permissions: UserPermissions;
}

export interface LeaveBalance {
    userId: string;
    employeeName: string;
    annual: number;
    casual: number;
    sick: number;
    exams: number;
    unpaid: number;
    weeklyDays?: string[];
    lastUnpaidReset?: string; // تتبع آخر شهر تم فيه تصفير الغياب "YYYY-MM"
}

export interface LeaveRecord {
    id?: string;
    userId: string;
    employeeName: string;
    date: string;
    days: number;
    type: 'annual' | 'casual' | 'sick' | 'exams' | 'unpaid' | 'custom' | 'penalty' | 'official';
    customLabel?: string;
    timestamp: number;
}

export interface AppNotification {
    id?: string;
    message: string;
    sender: string;
    timestamp: number;
    isRead: boolean;
}

export interface UserTarget {
    userId: string;
    employeeName: string;
    market: string;
    suggestedAmount: number;
    growthPercent: number;
    finalTarget: number;
    achieved: number;
    lastResetMonth: string; // "YYYY-MM"
}

export interface TargetHistory {
    id?: string;
    userId: string;
    employeeName: string;
    month: string;
    targetAmount: number;
    achievedAmount: number;
}
