"use client";

import type {
  AdminSessionInfo,
  ActivityResponse,
  AuditResponse,
  EventStatus,
  EventStatusResponse,
  ImportCommitResponse,
  ImportPreviewResponse,
  LoginResponse,
  PublicPulseResponse,
  QrResponse,
  QuickCheckinResponse,
  StatsResponse,
  StudentProfileResponse,
  StudentsResponse,
  VerifyResponse,
} from "./types";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.body instanceof FormData
      ? init?.headers
      : { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      (data && typeof data === "object" && "message" in data && typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : null) ?? `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export const api = {
  verify: (studentId: string, token?: string | null) =>
    request<VerifyResponse>("/api/verify", {
      method: "POST",
      body: JSON.stringify({ studentId, ...(token ? { token } : {}) }),
    }),

  login: (username: string, password: string) =>
    request<LoginResponse>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  logout: () => request<{ ok: boolean }>("/api/admin/logout", { method: "POST" }),

  me: () => request<LoginResponse>("/api/admin/me"),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/api/admin/password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  stats: () => request<StatsResponse>("/api/admin/stats"),

  students: (params: {
    q?: string;
    status?: string;
    dept?: string;
    page?: number;
    pageSize?: number;
    sort?: string;
  }) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.status && params.status !== "ALL") sp.set("status", params.status);
    if (params.dept && params.dept !== "ALL") sp.set("dept", params.dept);
    sp.set("page", String(params.page ?? 1));
    sp.set("pageSize", String(params.pageSize ?? 25));
    if (params.sort) sp.set("sort", params.sort);
    return request<StudentsResponse>(`/api/admin/students?${sp.toString()}`);
  },

  studentAction: (
    id: string,
    body: {
      action: "checkin" | "uncheckin" | "edit";
      name?: string;
      mobile?: string;
      department?: string;
      email?: string;
      year?: string;
      reason?: string;
    }
  ) =>
    request<{ ok: boolean; student: StudentsResponse["students"][number] }>(
      `/api/admin/students/${id}`,
      { method: "PATCH", body: JSON.stringify(body) }
    ),

  deleteStudent: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/students/${id}`, { method: "DELETE" }),

  studentProfile: (id: string) =>
    request<StudentProfileResponse>(`/api/admin/students/${id}`),

  importPreview: (file: File, sheet?: string) => {
    const fd = new FormData();
    fd.append("file", file);
    if (sheet) fd.append("sheet", sheet);
    return request<ImportPreviewResponse>("/api/admin/import/preview", {
      method: "POST",
      body: fd,
    });
  },

  importCommit: (
    file: File,
    mapping: Record<string, number | null>,
    mode: "MERGE" | "REPLACE",
    sheet?: string
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("mapping", JSON.stringify(mapping));
    fd.append("mode", mode);
    if (sheet) fd.append("sheet", sheet);
    return request<ImportCommitResponse>("/api/admin/import/commit", {
      method: "POST",
      body: fd,
    });
  },

  audit: (params: { q?: string; result?: string; studentKey?: string; page?: number; pageSize?: number }) => {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.result && params.result !== "ALL") sp.set("result", params.result);
    if (params.studentKey) sp.set("studentKey", params.studentKey);
    sp.set("page", String(params.page ?? 1));
    sp.set("pageSize", String(params.pageSize ?? 20));
    return request<AuditResponse>(`/api/admin/audit?${sp.toString()}`);
  },

  qr: () => request<QrResponse>("/api/qr"),

  qrRegenerate: () => request<QrResponse>("/api/qr/regenerate", { method: "POST" }),

  pulse: () => request<PublicPulseResponse>("/api/public/pulse"),

  setEventStatus: (status: EventStatus) =>
    request<EventStatusResponse>("/api/admin/event", {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  setAnnouncement: (text: string | null, expiresInMinutes?: number | null) =>
    request<EventStatusResponse>("/api/admin/event", {
      method: "PATCH",
      body: JSON.stringify({
        announcement: text,
        ...(expiresInMinutes !== undefined ? { expiresInMinutes } : {}),
      }),
    }),

  activity: (windowHours = 24) =>
    request<ActivityResponse>(`/api/admin/activity?window=${windowHours}`),

  quickCheckin: (studentId: string) =>
    request<QuickCheckinResponse>("/api/admin/quick-checkin", {
      method: "POST",
      body: JSON.stringify({ studentId }),
    }),
};

export function exportUrl(scope: "checkedin" | "notarrived" | "full" | "audit", format: "csv" | "xlsx" | "pdf") {
  return `/api/admin/export?scope=${scope}&format=${format}`;
}

export const importTemplateUrl = "/api/admin/import/template";

export function qrDownloadUrl(format: "png" | "svg" | "pdf") {
  return `/api/qr/download?format=${format}`;
}

export function passSheetsUrl(scope: "notarrived" | "checkedin" | "full") {
  return `/api/admin/export/pass-sheets?scope=${scope}`;
}
