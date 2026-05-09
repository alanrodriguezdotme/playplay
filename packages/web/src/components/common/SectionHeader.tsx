export default function SectionHeader({
  title,
  subtitle,
  showTopBorder,
  muted = false,
}: {
  title: string;
  subtitle?: string | React.ReactNode;
  showTopBorder?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex p-4 pb-2 text-xs font-semibold uppercase tracking-wider ${showTopBorder ? "border-t border-border" : ""}`}
    >
      <div
        className={`flex-1 ${muted ? "text-on-surface-muted" : "text-primary"}`}
      >
        {title}
      </div>
      {subtitle && <div className="text-on-surface-muted">{subtitle}</div>}
    </div>
  );
}
