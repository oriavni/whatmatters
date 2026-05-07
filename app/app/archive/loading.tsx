import { Skeleton } from "@/components/ui/skeleton";

export default function ArchiveLoading() {
  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page header */}
      <div className="space-y-1.5">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-4 w-48" />
      </div>

      {/* Tab bar */}
      <Skeleton className="h-9 w-52 rounded-md" />

      {/* Digest rows */}
      <div className="divide-y">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="py-4 flex items-center justify-between gap-4">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
