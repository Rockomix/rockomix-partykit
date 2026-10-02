"use client";

import { useEffect } from "react";
import { recordDiagnostic } from "~/lib/diagnostics";

export function DiagnosticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      recordDiagnostic({
        level: "error",
        event: "window.error",
        component: "window",
        error: event.error ?? {
          message: event.message,
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
        },
        context: { filename: event.filename, line: event.lineno, column: event.colno },
      });
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      recordDiagnostic({ level: "error", event: "window.unhandledrejection", component: "window", error: event.reason });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return children;
}
