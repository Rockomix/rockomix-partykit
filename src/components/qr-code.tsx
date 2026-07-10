import QRCode from "react-qr-code";
import { cn } from "~/lib/utils";

type Props = {
  url: string;
  size?: number;
  className?: string;
};

export function QrCode({ url, size = 128, className }: Props) {
  return (
    <div className={cn("w-fit bg-white p-2", className)}>
      <QRCode
        size={size}
        // style={{ height: "auto", maxWidth: "100%", width: "100%" }}
        value={url} // Create ID
        // viewBox={`0 0 256 256`}
      />
    </div>
  );
}
