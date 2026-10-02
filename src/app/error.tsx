"use client";

import { useEffect } from "react";
import { recordDiagnostic } from "~/lib/diagnostics";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const digest = error.digest;
  useEffect(() => {
    recordDiagnostic({ level: "error", event: "react.app.error", component: "AppRouterErrorBoundary", error, context: { digest, route: typeof window !== "undefined" ? window.location.pathname : undefined } });
  }, [digest, error]);
  return (
    <html lang="en">
      <body className="bg-slate-950 p-8 text-white">
        <main className="mx-auto max-w-lg space-y-4">
          <h1 className="text-2xl font-bold">Algo salió mal</h1>
          <p>Se registró el error. Puedes intentar cargar la página nuevamente.</p>
          <button className="rounded bg-white px-4 py-2 text-black" onClick={() => reset()}>Reintentar</button>
        </main>
      </body>
    </html>
  );
}
