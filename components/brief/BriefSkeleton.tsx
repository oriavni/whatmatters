import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

interface BriefSkeletonProps {
  /** When true, renders blocks only — used inside BriefContainer for the generating state */
  inline?: boolean;
}

function SkeletonBlocks() {
  return (
    <div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i}>
          <div className="py-8 space-y-3">
            <Skeleton className={i === 0 ? "h-5 w-4/5" : "h-4 w-3/4"} />
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-3 w-36" />
          </div>
          {i < 2 && <Separator />}
        </div>
      ))}

      <div className="space-y-6 pt-8">
        <Separator />
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function BriefSkeleton({ inline }: BriefSkeletonProps) {
  if (inline) return <SkeletonBlocks />;

  return (
    <div className="max-w-2xl mx-auto pb-12">
      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-7 w-24 rounded-lg" />
      </div>
      <SkeletonBlocks />
    </div>
  );
}
