export type AdminRole = "ADMIN" | "VOLUNTEER";

export type VerifyResult = "GRANTED" | "ALREADY_CHECKED_IN" | "DENIED";
export type VerifyOutcome = VerifyResult | "RATE_LIMITED" | "INVALID" | "EVENT_CLOSED" | "QR_REQUIRED";
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
  id: string;
  username: string;
  displayName: string | null;
  role: AdminRole;
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

export interface StudentProfileResponse {
  ok: boolean;
  student: StudentRow;
  history: AuditRow[];
}

export interface ImportMapping {
  studentId: number | null;
  name: number | null;
  mobile: number | null;
  department: number | null;
  email: number | null;
  year: number | null;
}

export interface ImportIssue {
  row: number;
  code: "MISSING_ID" | "INVALID_ID" | "MISSING_NAME" | "DUPLICATE_ID";
  field: "studentId" | "name";
  message: string;
  value?: string;
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
    invalidId: number;
    missingName: number;
    duplicateIdsInFile: number;
    existingInDb: number;
  };
  issues: ImportIssue[];
  issuesTruncated: boolean;
  extraColumns: string[];
}

export interface ImportCommitResponse {
  ok: boolean;
  inserted: number;
  updated: number;
  skipped: number;
  deletedAll: boolean;
  totalInDb: number;
  message: string;
  issues: ImportIssue[];
  issuesTruncated: boolean;
}

export interface AuditRow {
  id: string;
  rawInput: string;
  lookupId: string;
  result: string;
  studentKey: string | null;
  actor: string | null;
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
  requireQrToken: boolean;
  kioskUrl: string;
  announcement: string | null;
  announcementExpiresAt: string | null;
  announcementHistory: { text: string; at: string }[];
}

export interface EventStatusResponse {
  ok: boolean;
  status: EventStatus;
  eventName: string;
  tagline: string;
  requireQrToken: boolean;
  announcement: string | null;
  announcementExpiresAt: string | null;
  announcementHistory: { text: string; at: string }[];
}

export interface PublicPulseResponse {
  ok: boolean;
  eventName: string;
  tagline: string;
  status: EventStatus;
  announcement: string | null;
  announcementExpiresAt: string | null;
  checkedIn: number;
  totalRegistered: number;
  /** Students currently inside who arrived within the last hour. */
  checkedInLastHour: number;
  recent: { id: string; firstName: string; lastInitial: string; department: string | null; at: string }[];
}

export interface EntryStatusResponse {
  ok: boolean;
  found: boolean;
  message?: string;
  student?: {
    studentId: string;
    name: string;
    department: string | null;
    year: string | null;
  };
  checkedIn?: boolean;
  checkinAt?: string | null;
  /** "Self scan at the venue QR" | "Checked in at the desk" | null */
  checkinByLabel?: string | null;
  event?: {
    name: string;
    tagline: string;
    status: EventStatus;
    announcement: string | null;
    announcementExpiresAt: string | null;
  };
  inside?: number;
  totalRegistered?: number;
  checkedInLastHour?: number;
}

export interface LookupMatch {
  studentId: string;
  name: string;
  department: string | null;
  year: string | null;
  checkedIn: boolean;
  mobileMasked: string;
}

export interface LookupResponse {
  ok: boolean;
  found?: boolean;
  message?: string;
  matches?: LookupMatch[];
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

export interface ActivityResponse {
  ok: boolean;
  desks: {
    actor: string; // username, or "SELF" for student self-scans
    label: string; // display label
    entries: number; // checked-in students attributed
    lastAt: string | null; // most recent attributed check-in
  }[];
  manualActions: {
    actor: string;
    checkins: number;
    reversals: number;
    edits: number;
    lastAt: string | null;
  }[];
  leaderboard: {
    actor: string;
    displayName: string | null;
    role: string | null;
    entries: number; // attributed check-ins, whole event
    grants24h: number; // manual grants in the recent window
    lastAt: string | null;
  }[];
  windowHours: number;
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
    years: string[];
    studentsByDept: { dept: string; total: number; checkedIn: number }[];
    timeline: { bucket: string; count: number }[];
    checkedInLastHour: number;
    busiestWindow: { startsAt: string; count: number } | null;
    heatmap: { bucket: string; count: number }[];
  };
  recent: {
    id: string;
    studentId: string;
    name: string;
    department: string | null;
    checkinAt: string;
  }[];
}

export interface AuditDigestResponse {
  ok: boolean;
  message?: string;
  /** Server-local day key: YYYY-MM-DD */
  day: string;
  total: number;
  byResult: { result: string; count: number }[];
  busiestHour: { hourLabel: string; count: number } | null;
  topActor: { actor: string; count: number } | null;
  uniqueStudents: number;
  firstAt: string | null;
  lastAt: string | null;
}
