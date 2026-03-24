interface BriefHeaderProps {
  periodLabel: string;
  subject: string | null;
}

export function BriefHeader({ periodLabel, subject }: BriefHeaderProps) {
  return (
    <div className="space-y-1 min-w-0">
      <h1 className="text-xl font-semibold tracking-tight leading-tight">
        {subject ?? "Your Brief"}
      </h1>
      <p className="text-sm text-muted-foreground">{periodLabel}</p>
    </div>
  );
}
