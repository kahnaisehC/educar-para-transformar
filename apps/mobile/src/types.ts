export type UserRole = "student" | "parent" | "teacher" | "admin" | "director";
export type UserStatus = "active" | "inactive";

export interface User {
  id: number;
  username: string;
  displayName: string;
  role: UserRole;
  status: UserStatus;
}

export interface Child {
  id: number;
  fullName: string;
  recordNumber: string;
  level: string;
  course: string;
  status: string;
}

export interface BankDetails {
  alias: string;
  cbu: string;
  holder: string;
}

export type InvoiceItemStatus = "pending" | "partial" | "paid";
export type InvoiceStatus = "pending" | "partial" | "paid" | "cancelled";
export type InvoiceDisplayStatus = InvoiceStatus | "overdue";
export type ReceiptStatus = "pending" | "approved" | "rejected";

export interface InvoiceItem {
  id: number;
  kind: "monthly" | "sport" | "transport" | "cafeteria";
  description: string;
  sportId: number | null;
  transportRouteId: number | null;
  amount: number;
  paidAmount: number;
  status: InvoiceItemStatus;
}

export interface ReceiptItem {
  invoiceItemId: number;
  description: string;
  amount: number;
  paidAmount: number;
}

export interface Receipt {
  id: number;
  invoiceId: number;
  uploadedBy: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  claimedAmount: number;
  status: ReceiptStatus;
  rejectionReason: string | null;
  reviewedBy: number | null;
  reviewedAt: string | null;
  createdAt: string;
  items: ReceiptItem[];
}

export interface Invoice {
  id: number;
  studentId: number;
  studentName: string;
  periodYear: number;
  periodMonth: number;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: InvoiceStatus;
  displayStatus: InvoiceDisplayStatus;
  items: InvoiceItem[];
  receipts: Receipt[];
}

export interface BillingSummary {
  studentId: number;
  studentName: string;
  totalPending: number;
  totalOverdue: number;
  totalPaid: number;
  currentInvoice: Invoice | null;
  invoices: Invoice[];
}

export interface AdminReceipt extends Receipt {
  studentName: string;
  periodYear: number;
  periodMonth: number;
}

export interface Tariff {
  id: number;
  kind: "monthly" | "sport" | "transport" | "cafeteria";
  sportId: number | null;
  sport: string | null;
  transportRouteId: number | null;
  route: string | null;
  amount: number;
  validFrom: string;
  validTo: string | null;
  createdAt: string;
}

export interface ServicesCatalog {
  sports: Array<{ id: number; name: string; groupCount: number }>;
  transportRoutes: Array<{ id: number; name: string; description: string; active: boolean; enrolledCount: number }>;
}

export interface IncomeReport {
  total: number;
  count: number;
  rows: Array<{ paymentId: number; amount: number; paidAt: string; student: string; periodYear: number; periodMonth: number }>;
}

export interface PaymentsReport {
  rows: Array<{
    invoiceId: number;
    student: string;
    periodYear: number;
    periodMonth: number;
    totalAmount: number;
    paidAmount: number;
    balance: number;
    status: string;
    complete: boolean;
  }>;
  complete: PaymentsReport["rows"];
  incomplete: PaymentsReport["rows"];
}

export interface ServicesReport {
  rows: Array<{
    kind: "sport" | "transport";
    student: string;
    level: string;
    course: string;
    service: string;
    weekday: string | null;
    schedule: string | null;
    teacher: string | null;
    paidAmount: number;
  }>;
}

export interface DelinquencyReport {
  year: number;
  month: number;
  billed: number;
  collected: number;
  pending: number;
  collectionRate: number;
  projectedClosingDebt: number;
  assumption: string;
  evolution: Array<{ periodYear: number; periodMonth: number; billed: number; collected: number; collectionRate: number }>;
  students: Array<{
    invoiceId: number;
    student: string;
    dueDate: string;
    totalAmount: number;
    paidAmount: number;
    balance: number;
    daysLate: number;
  }>;
}
