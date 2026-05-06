interface BriefHeaderProps {
  periodLabel: string;
  subject: string | null;
}

export function BriefHeader({ periodLabel, subject }: BriefHeaderProps) {
  return (
    <div className="min-w-0 space-y-1">
      {/* shadcn h2 scale — scroll-m-20 kept off since this isn't a doc heading */}
      <h1 className="text-2xl font-semibold tracking-tight leading-tight">
        {subject ?? "Your Brief"}
      </h1>
      <p className="text-sm text-muted-foreground">{periodLabel}</p>
    </div>
  );
}
