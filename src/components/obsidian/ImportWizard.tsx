"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Database,
  FileDown,
  FileSpreadsheet,
  FileUp,
  Loader2,
  RefreshCw,
  Table2,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api, ApiError, importTemplateUrl } from "@/lib/api-client";
import type { ImportMapping, ImportPreviewResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const FIELDS: { key: keyof ImportMapping; label: string; required?: boolean }[] = [
  { key: "studentId", label: "Student / College ID", required: true },
  { key: "name", label: "Full Name", required: true },
  { key: "mobile", label: "Mobile" },
  { key: "department", label: "Department / Branch" },
  { key: "email", label: "Email" },
  { key: "year", label: "Year" },
];

type Phase = "upload" | "mapping" | "done";

export function ImportWizard({ onDone }: { onDone: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [mapping, setMapping] = useState<ImportMapping | null>(null);
  const [mode, setMode] = useState<"MERGE" | "REPLACE">("MERGE");
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState<"preview" | "commit" | null>(null);
  const [commitResult, setCommitResult] = useState<{ inserted: number; updated: number; skipped: number; deletedAll: boolean; totalInDb: number } | null>(null);

  async function handleFile(f: File) {
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) {
      toast({ title: "Unsupported file", description: "Upload an .xlsx, .xls or .csv registration sheet.", variant: "destructive" });
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum size is 8 MB.", variant: "destructive" });
      return;
    }
    setFile(f);
    setBusy("preview");
    try {
      const res = await api.importPreview(f);
      setPreview(res);
      setMapping(res.autoMap);
      setPhase("mapping");
    } catch (err) {
      toast({ title: "Preview failed", description: err instanceof ApiError ? err.message : "Could not read the file.", variant: "destructive" });
      setFile(null);
    } finally {
      setBusy(null);
    }
  }

  async function handleCommit() {
    if (!file || !mapping || mapping.studentId == null || mapping.name == null) return;
    setBusy("commit");
    try {
      const res = await api.importCommit(file, mapping as unknown as Record<string, number | null>, mode, preview?.activeSheet);
      setCommitResult(res);
      setPhase("done");
      await qc.invalidateQueries({ queryKey: ["students"] });
      await qc.invalidateQueries({ queryKey: ["stats"] });
    } catch (err) {
      toast({ title: "Import failed", description: err instanceof ApiError ? err.message : "Unknown error.", variant: "destructive" });
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setPhase("upload");
    setFile(null);
    setPreview(null);
    setMapping(null);
    setCommitResult(null);
    setMode("MERGE");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-5">
      {/* stepper */}
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em]">
        {["Upload sheet", "Map & validate", "Complete"].map((label, i) => {
          const idx = phase === "upload" ? 0 : phase === "mapping" ? 1 : 2;
          const state = i < idx ? "done" : i === idx ? "active" : "todo";
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <div className={cn("h-px w-6 sm:w-10", state === "todo" ? "bg-purple-500/20" : "bg-purple-500/60")} />}
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full border text-[10px]",
                  state === "active" && "border-purple-300/70 bg-purple-500/25 text-purple-100",
                  state === "done" && "border-purple-400/40 bg-purple-600/40 text-purple-100",
                  state === "todo" && "border-purple-500/25 text-purple-200/40"
                )}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span className={cn("hidden sm:inline", state === "todo" ? "text-purple-200/40" : "text-purple-200/80")}>{label}</span>
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {phase === "upload" && (
          <motion.div key="upload" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => inputRef.current?.click()}
              onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className={cn(
                "obs-card-hover flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all",
                dragOver ? "border-purple-300/70 bg-purple-500/10" : "border-purple-500/35 bg-[#0b0514]/60"
              )}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                }}
              />
              {busy === "preview" ? (
                <>
                  <Loader2 className="h-11 w-11 animate-spin text-purple-300" />
                  <p className="font-display mt-4 text-sm font-semibold tracking-wide text-purple-100">Parsing registration sheet…</p>
                  <p className="mt-1.5 text-xs text-purple-200/50">Validating rows on the server — data never leaves it.</p>
                </>
              ) : (
                <>
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl border border-purple-400/30 bg-purple-500/10">
                    <FileUp className="h-7 w-7 text-purple-300" />
                  </span>
                  <p className="font-display mt-5 text-base font-bold tracking-wide text-purple-50">Drop your registration sheet</p>
                  <p className="mt-1.5 text-sm text-purple-200/55">
                    Excel (.xlsx / .xls) or CSV — the form-response spreadsheet
                  </p>
                  <p className="mt-4 flex items-center gap-1.5 rounded-full border border-purple-500/25 px-3.5 py-1.5 text-[11px] text-purple-200/60">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-purple-300/70" />
                    Max 8 MB · parsed securely server-side
                  </p>
                  <a
                    href={importTemplateUrl}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="mt-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-purple-300/80 underline decoration-purple-400/40 underline-offset-4 transition-colors hover:text-purple-200 hover:decoration-purple-300"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    Download the official Excel template
                  </a>
                </>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Database, title: "Server-side import", desc: "Personal data is parsed and stored on the server only." },
                { icon: Table2, title: "Column mapping", desc: "Auto-detects Student ID, Name, Department and more." },
                { icon: Copy, title: "Duplicate-safe", desc: "Re-imports update existing records without losing check-ins." },
              ].map((f) => (
                <div key={f.title} className="rounded-xl border border-purple-500/15 bg-purple-500/5 p-3.5">
                  <f.icon className="h-4 w-4 text-purple-300/80" />
                  <p className="mt-2 text-xs font-semibold text-purple-100">{f.title}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-purple-200/50">{f.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {phase === "mapping" && preview && mapping && (
          <motion.div key="mapping" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="space-y-5">
            {/* file summary */}
            <div className="obs-card flex flex-wrap items-center gap-3 rounded-2xl p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15">
                <FileSpreadsheet className="h-5 w-5 text-purple-300" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-purple-50">{file?.name}</p>
                <p className="text-xs text-purple-200/55">
                  {preview.rowCount.toLocaleString()} rows{file ? ` · ${(file.size / 1024).toFixed(0)} KB` : ""}
                </p>
              </div>
              {preview.sheets.length > 1 && (
                <Select
                  value={preview.activeSheet}
                  onValueChange={(sheet) => {
                    if (file) {
                      setBusy("preview");
                      api.importPreview(file, sheet).then((res) => {
                        setPreview(res);
                        setMapping(res.autoMap);
                      }).finally(() => setBusy(null));
                    }
                  }}
                >
                  <SelectTrigger className="h-9 w-40 rounded-xl border-purple-500/30 bg-[#0b0517]/80 text-xs text-purple-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-purple-500/30 bg-[#0e0819] text-purple-100">
                    {preview.sheets.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" size="sm" onClick={reset} className="border-purple-500/30 text-xs text-purple-200">
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Change file
              </Button>
            </div>

            {/* mapping */}
            <div className="obs-card rounded-2xl p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-purple-100">
                <Table2 className="h-4 w-4 text-purple-300" /> Map columns to registry fields
              </p>
              <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-purple-200/65">
                      {f.label}
                      {f.required && <span className="text-rose-400">*</span>}
                    </label>
                    <Select
                      value={mapping[f.key] != null ? String(mapping[f.key]) : "none"}
                      onValueChange={(v) =>
                        setMapping({ ...mapping, [f.key]: v === "none" ? null : Number(v) })
                      }
                    >
                      <SelectTrigger className={cn(
                        "h-10 w-full rounded-xl border text-sm",
                        f.required && mapping[f.key] == null
                          ? "border-rose-500/50 bg-rose-950/20"
                          : "border-purple-500/30 bg-[#0b0517]/80"
                      )}>
                        <SelectValue placeholder="Not mapped" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64 border-purple-500/30 bg-[#0e0819] text-purple-100">
                        <SelectItem value="none">— Not mapped —</SelectItem>
                        {preview.headers.map((h, i) => (
                          <SelectItem key={i} value={String(i)}>{h || `Column ${i + 1}`}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* validation chips */}
              <div className="mt-5 flex flex-wrap gap-2">
                <VChip tone="ok" label={`${preview.validation.valid} valid rows`} />
                {preview.validation.missingId > 0 && <VChip tone="bad" label={`${preview.validation.missingId} missing ID`} />}
                {preview.validation.invalidId > 0 && <VChip tone="bad" label={`${preview.validation.invalidId} invalid ID`} />}
                {preview.validation.missingName > 0 && <VChip tone="bad" label={`${preview.validation.missingName} missing name`} />}
                {preview.validation.duplicateIdsInFile > 0 && <VChip tone="warn" label={`${preview.validation.duplicateIdsInFile} duplicate IDs in file`} />}
                {preview.validation.existingInDb > 0 && <VChip tone="info" label={`${preview.validation.existingInDb} already in DB`} />}
                {preview.extraColumns.length > 0 && <VChip tone="info" label={`${preview.extraColumns.length} extra columns preserved`} />}
              </div>
              {preview.issues.length > 0 && (
                <div className="mt-4 max-h-40 overflow-y-auto rounded-xl border border-rose-500/20 bg-rose-950/15 p-3">
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-rose-200/70">
                    Rows skipped during import
                  </p>
                  <div className="space-y-1.5">
                    {preview.issues.map((issue, index) => (
                      <p key={issue.row + "-" + issue.code + "-" + index} className="text-[11px] text-rose-100/70">
                        <span className="font-mono font-semibold text-rose-200">Row {issue.row}</span>
                        {" - "}{issue.message}{issue.value ? ": " + issue.value : ""}
                      </p>
                    ))}
                  </div>
                  {preview.issuesTruncated && (
                    <p className="mt-2 text-[10px] text-rose-200/50">Only the first 100 issues are shown.</p>
                  )}
                </div>
              )}
            </div>

            {/* sample preview */}
            <div className="obs-card overflow-hidden rounded-2xl">
              <p className="border-b border-purple-500/15 bg-purple-500/5 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-purple-200/70">
                Preview — first {preview.sample.length} rows
              </p>
              <div className="obs-scrollbar overflow-x-auto">
                <table className="w-full min-w-[560px] text-xs">
                  <thead>
                    <tr className="border-b border-purple-500/15 text-left text-[10px] uppercase tracking-wider text-purple-200/50">
                      {preview.headers.map((h, i) => {
                        const used = Object.values(mapping).includes(i);
                        return (
                          <th key={i} className={cn("px-4 py-2.5 font-semibold", used && "text-purple-200")}>
                            {h || `Col ${i + 1}`}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((row, ri) => (
                      <tr key={ri} className="border-b border-purple-500/8 text-purple-100/70">
                        {preview.headers.map((_, ci) => (
                          <td key={ci} className="max-w-40 truncate px-4 py-2.5">{row[ci] ?? "—"}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* mode + commit */}
            <div className="obs-card rounded-2xl p-5">
              <p className="text-sm font-semibold text-purple-100">Import mode</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <ModeCard
                  active={mode === "MERGE"}
                  onClick={() => setMode("MERGE")}
                  title="Merge"
                  desc="Insert new students and update existing records. Check-in status is always preserved."
                  icon={Database}
                />
                <ModeCard
                  active={mode === "REPLACE"}
                  onClick={() => setMode("REPLACE")}
                  title="Replace all"
                  desc="Wipe the current registry and import fresh. Destructive — check-in history is lost."
                  icon={Trash2}
                  danger
                />
              </div>

              {mode === "REPLACE" && (
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-950/25 px-3.5 py-2.5 text-xs text-rose-200/80">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
                  Replacing deletes every existing student record and its check-in time. Audit logs are kept.
                </p>
              )}

              <Button
                onClick={handleCommit}
                disabled={busy === "commit" || mapping.studentId == null || mapping.name == null}
                className="obs-glow-btn mt-5 h-12 w-full rounded-xl border border-purple-300/40 bg-gradient-to-r from-violet-700 via-purple-500 to-violet-700 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
              >
                {busy === "commit" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ArrowRight className="mr-2 h-4 w-4" />}
                {busy === "commit" ? "Importing…" : `Import ${preview.validation.valid.toLocaleString()} students`}
              </Button>
              {(mapping.studentId == null || mapping.name == null) && (
                <p className="mt-2 text-center text-xs text-rose-300/80">Map the required fields marked * to continue.</p>
              )}
            </div>
          </motion.div>
        )}

        {phase === "done" && commitResult && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="obs-card rounded-2xl p-8 text-center"
          >
            <motion.div
              initial={{ scale: 0.4, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 15 }}
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-purple-300/50 bg-purple-500/15"
            >
              <CheckCircle2 className="h-10 w-10 text-purple-200 drop-shadow-[0_0_14px_rgba(192,132,252,0.8)]" />
            </motion.div>
            <h2 className="font-display obs-gradient-text mt-5 text-xl font-black tracking-wide">IMPORT COMPLETE</h2>
            <p className="mt-2 text-sm text-purple-200/60">
              {commitResult.deletedAll ? "Registry replaced with" : "Registry updated with"} the fresh registration list.
            </p>
            <div className="mx-auto mt-6 grid max-w-md grid-cols-3 gap-3">
              <Stat label="Inserted" value={commitResult.inserted} />
              <Stat label="Updated" value={commitResult.updated} />
              <Stat label="Skipped" value={commitResult.skipped} />
            </div>
            <p className="mt-4 text-xs text-purple-200/50">
              Total registry: <span className="font-semibold text-purple-100">{commitResult.totalInDb.toLocaleString()}</span> students
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button onClick={onDone} className="obs-glow-btn rounded-xl bg-gradient-to-r from-violet-700 to-purple-500 text-white hover:brightness-110">
                <Table2 className="mr-2 h-4 w-4" /> View student registry
              </Button>
              <Button variant="outline" onClick={reset} className="rounded-xl border-purple-500/30 text-purple-200">
                <RefreshCw className="mr-2 h-4 w-4" /> Import another file
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function VChip({ tone, label }: { tone: "ok" | "bad" | "warn" | "info"; label: string }) {
  const tones = {
    ok: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
    bad: "border-rose-400/40 bg-rose-500/10 text-rose-300",
    warn: "border-amber-400/30 bg-amber-500/10 text-amber-300",
    info: "border-purple-400/30 bg-purple-500/10 text-purple-200",
  }[tone];
  return <span className={cn("rounded-full border px-3 py-1 text-[11px] font-medium", tones)}>{label}</span>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 px-3 py-3">
      <p className="font-display text-2xl font-black tabular-nums text-purple-50">{value.toLocaleString()}</p>
      <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-purple-200/55">{label}</p>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  title,
  desc,
  icon: Icon,
  danger,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border p-4 text-left transition-all",
        active
          ? danger
            ? "border-rose-400/60 bg-rose-500/12"
            : "border-purple-400/60 bg-purple-500/12"
          : "border-purple-500/20 bg-[#0b0514]/60 hover:border-purple-400/35"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn("h-4 w-4", active ? (danger ? "text-rose-300" : "text-purple-300") : "text-purple-300/50")} />
        <p className={cn("text-sm font-bold", active ? (danger ? "text-rose-100" : "text-purple-50") : "text-purple-100/80")}>{title}</p>
        {active && <span className={cn("ml-auto h-2 w-2 rounded-full", danger ? "bg-rose-400" : "bg-purple-400")} />}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-purple-200/55">{desc}</p>
    </button>
  );
}
