export interface SaleComment {
    id: string;
    text: string;
    senderId: string;
    senderName: string;
    timestamp: number;
    isLiked?: boolean;
}


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
    likes?: string[];
    dislikes?: string[];
    comments?: SaleComment[];
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
    showDailySales: boolean;
    showSalesLog: boolean;
    showInventoryReg: boolean;
    showInventoryLog: boolean;
    showCompetitorPrices: boolean;
    showCompetitorReports: boolean;
    showProductsRegistry?: boolean;
    showCustomerFeedback?: boolean;
    showLeaveBalance?: boolean;
    showAttendance?: boolean;
    showBranchNumbers?: boolean;
    showEmployees?: boolean;
    showSettings?: boolean;
    [key: string]: boolean | undefined;
}

export interface ContactPerson {
    id: string;
    name: string;
    phone: string;
}

export interface BranchContactRecord {
    branchName: string;
    supervisors: ContactPerson[];
    managers: ContactPerson[];
    updatedAt?: number;
    updatedBy?: string;
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
    isArchived?: boolean;
}

export interface AppSettings {
    appName: string;
    tickerText: string;
    tickerEnabled: boolean;
    whatsappNumber: string;
    appDownloadLink?: string;
    appStoreLink?: string;
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
    deductedFromAnnual?: number;
    deductedFromCasual?: number;
    deductedFromUnpaid?: number;
    deductedFromAnnualFlag?: boolean;
    notes?: string;
}

export interface AppNotification {
    id?: string;
    message: string;
    sender: string;
    timestamp: number;
    isRead: boolean;
    dateString?: string;
    timeString?: string;
    actionType?: string;
    saleId?: string;
    comment?: any;
    notifPath?: string;
    type?: string;
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

export interface CustomerFeedback {
    id: string;
    branchName: string;
    customerName: string;
    phoneNumber: string;
    complaint: string;
    opinionType?: 'مقترح' | 'شكوى' | string;
    dayName: string;
    date: string;
    time: string;
    timestamp: number;
    createdBy: string;
    createdByRole?: string;
}

export interface AttendanceRecord {
    id?: string;
    userId?: string;
    username: string;
    employeeName: string;
    branchName?: string;
    date: string; // YYYY-MM-DD
    checkInTime?: string; // e.g. "10:05:22 AM" or "10:05:22 ص"
    checkInTimestamp?: number;
    checkOutTime?: string; // e.g. "06:15:10 PM" or "06:15:10 م"
    checkOutTimestamp?: number;
    status?: 'present' | 'departed' | 'absent' | string;
    note?: string;
    isLate?: boolean;
    delayPenalty?: string; // e.g. "خصم ربع يوم"
    penaltyAmount?: number; // e.g. 0.25
    autoAbsent?: boolean;
    distanceMeters?: number;
    locationCoords?: string;
}

export interface AttendanceScheduleSettings {
    checkInTime: string; // e.g. "10:00"
    checkOutTime: string; // e.g. "18:00"
    gracePeriodMinutes: number; // e.g. 15
}

export interface EmployeeBranchLocation {
    id?: string;
    branchName: string;
    coordinates: string;
}

export interface EmployeeProfile {
    id?: string;
    userId: string;
    accountUsername: string;
    fullName: string;
    nationalId: string;
    wallet: string;
    instapay: string;
    createdAt?: number;
    updatedAt?: number;
}
