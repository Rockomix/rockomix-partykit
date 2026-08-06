"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useEffect, useState, type ReactElement } from "react";
import { toast } from "sonner";
import { QrCode } from "./qr-code";

type Props = {
  url: string;
  trigger?: ReactElement;
};

export function InvitePartyDialog({ url, trigger }: Props) {
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && "share" in navigator);
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Enlace copiado al portapapeles.");
    } catch {
      toast.error("No se pudo copiar el enlace.");
    }
  };

  const shareParty = async () => {
    if (!navigator.share) {
      await copyLink();
      return;
    }

    try {
      await navigator.share({
        title: "Invita a la fiesta",
        text: "Invita a tus amigos para que puedan pedir canciones desde su celular.",
        url,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      toast.error("No se pudo compartir la fiesta.");
    }
  };

  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="shrink-0 text-sm font-semibold text-white/75 transition-colors hover:text-white"
          >
            Invitar
          </button>
        )}
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[200] bg-black/40 backdrop-blur-sm animate-in fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[201] flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col items-center overflow-hidden rounded-xl bg-background/95 p-5 text-center text-white shadow-xl animate-in fade-in zoom-in-95 duration-200 sm:p-6">
          <Dialog.Close asChild>
            <button
              type="button"
              className="absolute right-3 top-3 inline-flex h-11 w-11 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
              aria-label="Cerrar"
            >
              <X className="h-6 w-6" />
            </button>
          </Dialog.Close>

          <Dialog.Title className="text-xl font-bold">Invita a la fiesta</Dialog.Title>
          <Dialog.Description className="mt-3 max-w-sm text-sm leading-relaxed text-white/65">
            Comparte este código QR para que tus invitados
            <br />
            se unan y pidan canciones desde su celular.
          </Dialog.Description>

          <div className="mt-6 bg-white p-3 animate-in fade-in duration-300">
            <QrCode url={url} size={224} />
          </div>

          <p className="mt-4 max-w-full break-all font-mono text-xs text-white/50">
            {url}
          </p>

          {canShare ? (
            <button
              type="button"
              className="mt-6 rounded-md bg-primary px-5 py-2.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              onClick={() => void shareParty()}
            >
              Invitar
            </button>
          ) : (
            <button
              type="button"
              className="mt-6 rounded-md px-4 py-2 text-sm font-semibold text-white/75 transition-colors hover:bg-white/5 hover:text-white"
              onClick={() => void copyLink()}
            >
              📋 Copiar enlace
            </button>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
