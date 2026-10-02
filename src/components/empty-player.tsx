import { QrCode } from "./qr-code";
import { cn } from "~/lib/utils";
import { LogoBrand } from "./logo-brand";
import { toast } from "sonner";

type Props = {
  joinPartyUrl: string;
  className?: string;
};

export function EmptyPlayer({ joinPartyUrl, className }: Props) {
  const copyRoomHash = async () => {
    const hash = joinPartyUrl.split("/").pop() ?? "";
    await navigator.clipboard.writeText(hash);
    toast.success("ID copiado", { duration: 3000 });
  };

  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center p-6 pb-1",
        className
      )}
    >
      <div className="flex w-full basis-3/4 items-center justify-center">
        <LogoBrand
          size="lg"
          className="mx-auto duration-1000 animate-in zoom-in-150 spin-in-180 max-h-[40vh]"
        />
      </div>
      <div className="relative flex w-full basis-1/4 items-end text-center">
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => void copyRoomHash()}
          >
            ID Sala: {joinPartyUrl.split("/").pop()}
          </button>
          <QrCode url={joinPartyUrl} />
        </div>
        <a
          href={joinPartyUrl}
          target="_blank"
          className="font-mono text-xl text-white pl-4"
        >
          {joinPartyUrl.split("//")[1]}
        </a>
      </div>
    </div>
  );
}
