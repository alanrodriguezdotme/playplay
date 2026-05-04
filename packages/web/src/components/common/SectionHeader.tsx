export default function SectionHeader({
  title,
  subtitle,
  showTopBorder,
}: {
  title: string;
  subtitle?: string | React.ReactNode;
  showTopBorder?: boolean;
}) {
  return (
    <div className={`flex p-4 pb-2 text-xs font-semibold uppercase tracking-wider ${showTopBorder ? "border-t border-border" : ""}`}>
      <div className="flex-1 text-primary">{title}</div>
      {subtitle && <div className="text-on-surface-muted">{subtitle}</div>}
    </div>
  );
}
