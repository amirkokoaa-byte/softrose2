
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
    employeeName?: string;
    items: { category: string; name: string; price: number }[];
}

export interface UserPermissions {
    showSalesLog: boolean;
    showInventoryLog: boolean;
    showInventoryReg: boolean;
    showCompetitorReports: boolean;
}

export interface User {
    key?: string;
    username: string;
    role: 'admin' | 'user';
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
    permissions: UserPermissions; // Default permissions for system
}

export interface LeaveBalance {
    userId: string;
    employeeName: string;
    annual: number;
    casual: number;
    sick: number;
    exams: number;
    unpaid: number;
}

export interface LeaveRecord {
    id?: string;
    userId: string;
    employeeName: string;
    date: string;
    days: number;
    type: 'annual' | 'casual' | 'sick' | 'exams' | 'unpaid';
    timestamp: number;
}

export interface AppNotification {
    id?: string;
    message: string;
    sender: string;
    timestamp: number;
    isRead: boolean;
}
