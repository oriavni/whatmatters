import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

interface BriefSkeletonProps {
  /** When true, renders blocks only (no page-level header skeleton) */
  inline?: boolean;
}

function StoryCardSkeleton({ isLead }: { isLead?: boolean }) {
  return (
    <Card>
      <CardHeader>
        <Skeleton className={isLead ? "h-6 w-4/5" : "h-5 w-3/4"} />
        <div className="space-y-2 mt-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 pt-0">
        <Separator />
        <Skeleton className="h-3 w-28" />
      </CardContent>
    </Card>
  );
}

function MentionsCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-3 w-24" />
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}

export function BriefSkeleton({ inline }: BriefSkeletonProps) {
  const blocks = (
    <div className="space-y-6">
      <StoryCardSkeleton isLead />
      <StoryCardSkeleton />
      <StoryCardSkeleton />
      <MentionsCardSkeleton />
    </div>
  );

  if (inline) return blocks;

  return (
    <div className="max-w-2xl mx-auto pb-12">
      {/* Header row skeleton */}
      <div className="flex items-start justify-between gap-4 mb-10">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md" />
      </div>
      {blocks}
    </div>
  );
}
