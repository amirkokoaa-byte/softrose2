
export interface ProductItem {
    id: string;
    name: string;
    price: number;
    qty: number;
    category: string;
}

export interface SaleRecord {
    id?: string;
    date: string;
    timestamp: number;
    market: string;
    employeeName: string;
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
    employeeName?: string; // Added field
    items: { category: string; name: string; price: number }[];
}

export interface User {
    username: string;
    role: 'admin' | 'user';
    name: string;
    code?: string;
    phone?: string;
    canViewAllSales?: boolean;
}

export interface AppSettings {
    appName: string;
    tickerText: string;
    tickerEnabled: boolean;
    whatsappNumber: string;
    // Permissions (defaults to false for sensitive data)
    permissions: {
        showSalesLog: boolean;
        showInventoryLog: boolean;
        showInventoryReg: boolean;
        showCompetitorReports: boolean;
    };
}

export interface LeaveBalance {
    userId: string;
    employeeName: string;
    annual: number; // سنوي
    casual: number; // عارضة
    sick: number;   // مرضي
    exams: number;  // امتحانات
}

export interface LeaveRecord {
    id?: string;
    userId: string;
    employeeName: string;
    date: string; // تاريخ الاجازة
    days: number;
    type: 'annual' | 'casual' | 'sick' | 'exams';
    timestamp: number;
}

export interface AppNotification {
    id?: string;
    message: string;
    sender: string;
    timestamp: number;
    isRead: boolean;
}