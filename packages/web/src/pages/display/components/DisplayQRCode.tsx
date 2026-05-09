import { QRCodeSVG } from "qrcode.react";
import { DisplayVenueCode } from "./DisplayVenueOtp";

interface DisplayQRCodeProps {
  size?: number;
  lanIp?: string | null;
}

export function DisplayQRCode({ size = 120, lanIp }: DisplayQRCodeProps) {
  const origin = lanIp
    ? `${window.location.protocol}//${lanIp}:${window.location.port}`
    : window.location.origin;
  const patronUrl = origin;

  return (
    <div className="flex items-center gap-4 w-fit shrink-0">
      <div className="shrink-0 bg-white p-3">
        <QRCodeSVG value={patronUrl} size={size} level="M" />
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Scan to add a song
          </p>
          <p className="mt-1 text-xs text-on-surface-muted">{patronUrl}</p>
        </div>
        <DisplayVenueCode />
      </div>
    </div>
  );
}
