import { QRCodeSVG } from "qrcode.react";

interface DisplayQRCodeProps {
  venueSlug: string;
}

export function DisplayQRCode({ venueSlug }: DisplayQRCodeProps) {
  const patronUrl = `${window.location.origin}/venue/${venueSlug}`;

  return (
    <div className="flex items-center gap-4">
      <div className="shrink-0 rounded-xl bg-white p-3">
        <QRCodeSVG value={patronUrl} size={120} level="M" />
      </div>
      <div>
        <p className="text-sm font-bold uppercase tracking-widest text-primary">
          Scan to add songs
        </p>
        <p className="mt-1 text-xs text-on-surface-muted">{patronUrl}</p>
      </div>
    </div>
  );
}
