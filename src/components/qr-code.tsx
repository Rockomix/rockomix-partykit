"use client";

import { useEffect, useRef } from "react";
import { useLocalStorage } from "@mantine/hooks";
import QRCode from "react-qr-code";
import qrcode from "qrcode-generator";
import { cn } from "~/lib/utils";

type Props = {
  url: string;
  size?: number;
  className?: string;
};

const QR_RENDER_KEY = "qrRender";

export function QrCode({ url, size = 120, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [renderMode, setRenderMode] = useLocalStorage<"svg" | "canvas">({
    key: QR_RENDER_KEY,
    defaultValue: "svg",
  });

  useEffect(() => {
    if (renderMode !== "canvas") {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const qr = qrcode(0, "L");
    qr.addData(url);
    qr.make();

    const moduleCount = qr.getModuleCount();
    // El wrapper ya proporciona el margen blanco exterior.
    // Canvas no añade una quiet zone interna para igualar el tamaño visual del SVG.
    const quietZoneModules = 0;
    const totalModules = moduleCount + quietZoneModules * 2;
    const cellSize = size / totalModules;
    const offset = 0;

    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.clearRect(0, 0, size, size);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, size, size);
    context.fillStyle = "#000000";

    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount; col += 1) {
        if (!qr.isDark(row, col)) {
          continue;
        }

        const x = offset + (col + quietZoneModules) * cellSize;
        const y = offset + (row + quietZoneModules) * cellSize;
        const w = Math.ceil((col + quietZoneModules + 1) * cellSize) - Math.floor(
          (col + quietZoneModules) * cellSize,
        );
        const h = Math.ceil((row + quietZoneModules + 1) * cellSize) - Math.floor(
          (row + quietZoneModules) * cellSize,
        );

        context.fillRect(Math.round(x), Math.round(y), w, h);
      }
    }
  }, [renderMode, size, url]);

  return (

    <div
      className={cn("inline-flex shrink-0 bg-white p-2", className)}
      onClick={() => {
        setRenderMode((current) => (current === "svg" ? "canvas" : "svg"));
      }}
    >
      {renderMode === "svg" ? (
        <QRCode
          size={size}
          className="block h-auto w-auto shrink-0"
          value={url}
        />
      ) : (
        <canvas
          ref={canvasRef}
          width={size}
          height={size}
          className="block h-auto w-auto shrink-0"
          aria-label="QR code"
        />
      )}
    </div>
  );
}
