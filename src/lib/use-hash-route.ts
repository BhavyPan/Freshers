"use client";

import { useCallback, useEffect, useState } from "react";

export type AppRoute =
  | { area: "public"; step: "landing" | "verify" | "result" | "kiosk" | "status" }
  | { area: "admin"; section: "login" | "dashboard" | "registry" | "qr" | "reports" };

function parseHash(hash: string): AppRoute {
  const clean = hash.replace(/^#\/?/, "").split("?")[0].replace(/\/$/, "");
  if (clean === "admin" || clean.startsWith("admin/")) {
    const sub = clean.replace("admin", "").replace("/", "");
    switch (sub) {
      case "dashboard":
        return { area: "admin", section: "dashboard" };
      case "registry":
        return { area: "admin", section: "registry" };
      case "qr":
        return { area: "admin", section: "qr" };
      case "reports":
        return { area: "admin", section: "reports" };
      default:
        return { area: "admin", section: "login" };
    }
  }
  if (clean === "verify") return { area: "public", step: "verify" };
  if (clean === "result") return { area: "public", step: "result" };
  if (clean === "kiosk") return { area: "public", step: "kiosk" };
  if (clean === "status") return { area: "public", step: "status" };
  return { area: "public", step: "landing" };
}

export function useHashRoute() {
  // Hydration-safe: the first (server + client) render always shows the landing
  // route; we sync to the real hash right after mount to avoid mismatches on
  // deep links like /#/admin.
  const [route, setRoute] = useState<AppRoute>({ area: "public", step: "landing" });

  useEffect(() => {
    const sync = () => setRoute(parseHash(window.location.hash));
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  const navigate = useCallback((to: string) => {
    if (window.location.hash === to) {
      setRoute(parseHash(to));
    } else {
      window.location.hash = to;
    }
  }, []);

  return { route, navigate };
}

export function routeToHash(route: AppRoute): string {
  if (route.area === "admin") {
    return route.section === "login" ? "#/admin" : `#/admin/${route.section}`;
  }
  if (route.step === "landing") return "#/";
  return `#/${route.step}`;
}
