import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";

interface BriefSkeletonProps {
  /** When true, renders blocks only (no outer wrapper/header — used inside BriefContainer) */
  inline?: boolean;
}

function SkeletonBlocks() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="py-8 first:pt-0">
          <Skeleton className={i === 0 ? "h-5 w-4/5 mb-3" : "h-[17px] w-3/4 mb-3"} />
          <div className="space-y-2 mb-4">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
          <Skeleton className="h-3 w-36" />
          <Separator className="mt-8" />
        </div>
      ))}

      {/* Quick mentions skeleton */}
      <Separator className="mb-8" />
      <Skeleton className="h-2.5 w-28 mb-5" />
      <div className="space-y-3.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 w-full" />
        ))}
      </div>
    </>
  );
}

export function BriefSkeleton({ inline }: BriefSkeletonProps) {
  if (inline) return <SkeletonBlocks />;

  return (
    <div className="max-w-2xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-10">
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
