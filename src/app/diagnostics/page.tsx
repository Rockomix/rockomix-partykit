"use client";

import { useCallback, useEffect, useState } from "react";
import { clearDiagnostics, getDiagnostics, getDiagnosticsInfo, type DiagnosticEvent } from "~/lib/diagnostics";

export default function DiagnosticsPage() {
  const [events, setEvents] = useState<DiagnosticEvent[]>([]);
  const [info, setInfo] = useState({ count: 0, approximateBytes: 0, persistenceAvailable: false });
  const [message, setMessage] = useState("");

  const refresh = useCallback(() => {
    const next = getDiagnostics();
    setEvents(next);
    setInfo(getDiagnosticsInfo());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const allJson = JSON.stringify(events, null, 2);
  const copy = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(allJson);
      else throw new Error("Clipboard API unavailable");
      setMessage("Diagnósticos copiados.");
    } catch {
      setMessage("No se pudo copiar automáticamente. Selecciona y copia el texto de abajo.");
    }
  };
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([allJson], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `rockomix-diagnostics-${Date.now()}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch { setMessage("No se pudo descargar el archivo."); }
  };
  const clear = () => { clearDiagnostics(); refresh(); setMessage("Diagnósticos limpiados."); };

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-white sm:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <h1 className="text-2xl font-bold">Diagnósticos</h1>
        <p className={info.persistenceAvailable ? "text-emerald-300" : "text-amber-300"}>
          Persistencia local: {info.persistenceAvailable ? "disponible" : "no disponible (solo memoria)"}
        </p>
        <div className="flex flex-wrap gap-2 text-sm"><span>Eventos: {info.count}</span><span>Tamaño aprox.: {Math.round(info.approximateBytes / 1024)} KB</span><span>Mostrando los últimos {Math.min(50, events.length)}</span></div>
        <div className="rounded bg-black/30 p-3 text-sm"><span className="font-semibold">Último evento: </span>{events.at(-1)?.event ?? "ninguno"}</div>
        <div className="flex flex-wrap gap-2">
          <button className="rounded bg-white px-3 py-2 text-black" onClick={refresh}>Actualizar</button>
          <button className="rounded bg-white px-3 py-2 text-black" onClick={copy}>Copiar todos</button>
          <button className="rounded bg-white px-3 py-2 text-black" onClick={download}>Descargar JSON</button>
          <button className="rounded bg-red-700 px-3 py-2" onClick={clear}>Limpiar</button>
        </div>
        {message ? <p className="text-sm text-amber-200">{message}</p> : null}
        <pre className="max-h-[70vh] overflow-auto rounded bg-black/50 p-3 text-xs">{JSON.stringify(events.slice(-50), null, 2)}</pre>
        <textarea className="min-h-32 w-full rounded bg-black/50 p-3 font-mono text-xs text-white" readOnly value={allJson} aria-label="Diagnósticos para copia manual" />
      </div>
    </main>
  );
}
