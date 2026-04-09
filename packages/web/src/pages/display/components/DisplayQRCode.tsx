import { QRCodeSVG } from "qrcode.react";
import { DisplayVenueCode } from "./DisplayVenueOtp";

interface DisplayQRCodeProps {
  venueSlug: string;
  size?: number;
}

export function DisplayQRCode({ venueSlug, size = 120 }: DisplayQRCodeProps) {
  const patronUrl = `${window.location.origin}/venue/${venueSlug}`;

  return (
    <div className="flex items-center gap-4">
      <div className="shrink-0 rounded-xl bg-white p-3">
        <QRCodeSVG value={patronUrl} size={size} level="M" />
      </div>
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-primary">
            Scan to add songs
          </p>
          <p className="mt-1 text-xs text-on-surface-muted">{patronUrl}</p>
        </div>
        <DisplayVenueCode venueSlug={venueSlug} />
      </div>
    </div>
  );
}
