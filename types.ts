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
}