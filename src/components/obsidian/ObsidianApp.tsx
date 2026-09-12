"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useHashRoute, type AppRoute } from "@/lib/use-hash-route";
import { captureEventTokenOnce, useObsidianStore } from "@/lib/client-store";
import { api } from "@/lib/api-client";
import { ContourBackground } from "./ContourBackground";
import { Landing } from "./Landing";
import { VerifyView } from "./VerifyView";
import { ResultView } from "./ResultView";
import { KioskView } from "./KioskView";
import { AdminLogin } from "./AdminLogin";
import { AdminShell, type AdminSection } from "./AdminShell";
import { DashboardView } from "./DashboardView";
import { RegistryView } from "./RegistryView";
import { QRView } from "./QRView";
import { ReportsView } from "./ReportsView";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/** Admin area bootstrapper — handles session restore + section guarding */
function AdminArea({ route, navigate }: { route: Extract<AppRoute, { area: "admin" }>; navigate: (to: string) => void }) {
  const admin = useObsidianStore((s) => s.admin);
  const booted = useObsidianStore((s) => s.adminBooted);
  const setAdmin = useObsidianStore((s) => s.setAdmin);
  const setAdminBooted = useObsidianStore((s) => s.setAdminBooted);
  const qc = useQueryClient();

  useEffect(() => {
    if (booted) return;
    let cancelled = false;
    api
      .me()
      .then((res) => {
        if (!cancelled) setAdmin(res.ok ? res.user ?? null : null);
      })
      .catch(() => {
        if (!cancelled) setAdmin(null);
      })
      .finally(() => {
        if (!cancelled) setAdminBooted();
      });
    return () => {
      cancelled = true;
    };
  }, [booted, setAdmin, setAdminBooted]);

  // redirect to default section once logged in and sitting on the bare #/admin route
  useEffect(() => {
    if (admin && route.section === "login") navigate("#/admin/dashboard");
  }, [admin, route.section, navigate]);

  if (!booted) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <span className="obs-live-dot h-2.5 w-2.5 rounded-full bg-purple-400" />
          <p className="text-xs uppercase tracking-[0.3em] text-purple-200/50">Restoring session…</p>
        </div>
      </div>
    );
  }

  if (!admin) {
    return <AdminLogin onLoggedIn={() => navigate("#/admin/dashboard")} />;
  }

  const section = route.section === "login" ? "dashboard" : route.section;

  return (
    <AdminShell
      section={section}
      onNavigate={(s: AdminSection) => navigate(`#/admin/${s}`)}
      onLogout={() => {
        qc.clear();
        navigate("#/admin");
      }}
    >
      {section === "dashboard" && <DashboardView />}
      {section === "registry" && <RegistryView />}
      {section === "qr" && <QRView />}
      {section === "reports" && <ReportsView />}
    </AdminShell>
  );
}

/** Public entry flow — landing → verify → result */
function PublicArea({ route, navigate }: { route: Extract<AppRoute, { area: "public" }>; navigate: (to: string) => void }) {
  const clearVerify = useObsidianStore((s) => s.clearVerify);

  useEffect(() => {
    if (route.step === "verify") clearVerify();
  }, [route.step, clearVerify]);

  if (route.step === "kiosk") {
    return <KioskView onExit={() => navigate("#/")} />;
  }
  if (route.step === "verify") {
    return <VerifyView onResult={() => navigate("#/result")} onBack={() => navigate("#/")} />;
  }
  if (route.step === "result") {
    return (
      <ResultView
        onVerifyAnother={() => navigate("#/verify")}
        onDone={() => {
          clearVerify();
          navigate("#/");
        }}
      />
    );
  }
  return <Landing onBegin={() => navigate("#/verify")} />;
}

export default function ObsidianApp() {
  const { route, navigate } = useHashRoute();
  const [queryClient] = useState(makeQueryClient);

  useEffect(() => {
    captureEventTokenOnce();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="relative min-h-svh bg-[#05030a] text-purple-50 selection:bg-purple-500/40 selection:text-white">
        <ContourBackground />
        {route.area === "admin" ? (
          <AdminArea route={route} navigate={navigate} />
        ) : (
          <PublicArea route={route} navigate={navigate} />
        )}
      </div>
    </QueryClientProvider>
  );
}
