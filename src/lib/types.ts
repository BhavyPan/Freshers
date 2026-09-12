export type AdminRole = "ADMIN" | "VOLUNTEER";

export type VerifyResult = "GRANTED" | "ALREADY_CHECKED_IN" | "DENIED";
export type VerifyOutcome = VerifyResult | "RATE_LIMITED" | "INVALID" | "EVENT_CLOSED";
export type EventStatus = "OPEN" | "PAUSED" | "CLOSED";

export interface StudentPublicInfo {
  studentId: string;
  name: string;
  department: string | null;
  year: string | null;
}

export interface VerifyResponse {
  ok: boolean;
  result: VerifyOutcome;
  message: string;
  student?: StudentPublicInfo;
  checkinAt?: string | null;
  tokenValid?: boolean;
}

export interface AdminSessionInfo {
  username: string;
  displayName: string | null;
  role: AdminRole;
}

export interface StatsResponse {
  ok: boolean;
  stats: {
    totalRegistered: number;
    checkedIn: number;
    notArrived: number;
    deniedAttempts: number;
    checkinRate: number;
    lastCheckinAt: string | null;
    departments: string[];
    studentsByDept: { dept: string; total: number; checkedIn: number }[];
    timeline: { bucket: string; count: number }[];
  };
  recent: {
    id: string;
    studentId: string;
    name: string;
    department: string | null;
    checkinAt: string;
  }[];
}

export interface StudentRow {
  id: string;
  studentId: string;
  name: string;
  mobile: string | null;
  department: string | null;
  email: string | null;
  year: string | null;
  checkedIn: boolean;
  checkinAt: string | null;
  checkinBy: string | null;
  createdAt: string;
  attempts: number;
}

export interface StudentsResponse {
  ok: boolean;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  students: StudentRow[];
}

export interface ImportMapping {
  studentId: number | null;
  name: number | null;
  mobile: number | null;
  department: number | null;
  email: number | null;
  year: number | null;
}

export interface ImportPreviewResponse {
  ok: boolean;
  sheets: string[];
  activeSheet: string;
  headers: string[];
  rowCount: number;
  sample: string[][];
  autoMap: ImportMapping;
  validation: {
    valid: number;
    missingId: number;
    missingName: number;
    duplicateIdsInFile: number;
    existingInDb: number;
  };
}

export interface ImportCommitResponse {
  ok: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  deletedAll: boolean;
  totalInDb: number;
  message: string;
}

export interface AuditRow {
  id: string;
  rawInput: string;
  lookupId: string;
  result: string;
  studentKey: string | null;
  createdAt: string;
}

export interface AuditResponse {
  ok: boolean;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  logs: AuditRow[];
}

export interface QrResponse {
  ok: boolean;
  event: { name: string; tagline: string; status: EventStatus };
  token: string;
  url: string;
  qrDataUrl: string;
  generatedAt: string;
}

export interface EventStatusResponse {
  ok: boolean;
  status: EventStatus;
  eventName: string;
  tagline: string;
}

export interface PublicPulseResponse {
  ok: boolean;
  eventName: string;
  tagline: string;
  status: EventStatus;
  checkedIn: number;
  totalRegistered: number;
  recent: { id: string; firstName: string; lastInitial: string; department: string | null; at: string }[];
}

export interface QuickCheckinResponse {
  ok: boolean;
  result: "GRANTED" | "ALREADY_CHECKED_IN" | "DENIED";
  message: string;
  student?: { studentId: string; name: string; department: string | null; checkinAt: string };
}

export interface LoginResponse {
  ok: boolean;
  user?: AdminSessionInfo;
  message?: string;
}
